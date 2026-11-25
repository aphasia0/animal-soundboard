<script>
    import { createEventDispatcher, onMount } from "svelte";
    import { getSupabase } from "./supabaseClient.js";
    import { user } from "./authStore.js";
    import { cachedQuery, dbCacheKeys } from "./dbCache.js";
    import { loadPublicContent, publicContent } from "./publicContentStore.js";

    export let currentCategory = null;
    export let currentItemId = null;
    export let slot = null; // 'A', 'B', or null

    const dispatch = createEventDispatcher();

    let publicCategories = [];
    let userCategories = [];
    let extendedCategories = [];

    // Current category is expanded by default, others collapsed
    let expandedId = currentCategory;
    let activeUserId;
    let latestLoadId = 0;

    function toSelectorCategory(category) {
        return {
            id: category.id,
            label: category.name,
            emoji: category.emoji || "✨",
            items: category.items.map((item) => ({
                id: item.id,
                image: item.image,
                sound: item.sound,
                name: item.name,
            })),
            getName: (item) => item.name,
        };
    }

    // Auto-sottoscrizione Svelte: si pulisce da sola alla distruzione.
    $: publicCategories = $publicContent.categories.map(toSelectorCategory);
    $: extendedCategories = [...publicCategories, ...userCategories];
    $: if (
        currentCategory
        && extendedCategories.some((category) => category.id === currentCategory)
    ) {
        expandedId = currentCategory;
    }

    onMount(() => {
        loadPublicContent().catch((error) => {
            console.error("Public content fetch error:", error);
        });

        // La sessione può essere ripristinata dopo l'apertura del selettore.
        // Restiamo iscritti per caricare le categorie appena l'utente è pronto.
        return user.subscribe((currentUser) => {
            const userId = currentUser?.id ?? null;
            if (userId === activeUserId) return;

            activeUserId = userId;
            const loadId = ++latestLoadId;
            userCategories = [];

            if (userId) loadCustomCategories(userId, loadId);
        });
    });

    async function loadCustomCategories(userId, loadId) {
        const supabase = getSupabase();
        if (!supabase) return;

        try {
            const remoteCategories = await cachedQuery(
                dbCacheKeys.selector(userId),
                async () => {
                    const { data, error } = await supabase
                        .from("user_categories")
                        .select("*, user_cards(*)")
                        .eq("user_id", userId)
                        .order("created_at", { ascending: true });

                    // Non trasformare un errore temporaneo in una cache vuota.
                    if (error) throw error;
                    return (data || []).map((cat) => ({
                        id: cat.id,
                        label: cat.name,
                        emoji: cat.emoji || "✨",
                        // L'ordine delle risorse annidate non è garantito da
                        // PostgREST; allinealo a quello di CategoryView
                        // (created_at crescente). La selezione comunque usa
                        // l'id, non l'indice.
                        items: (cat.user_cards || [])
                            .slice()
                            .sort((a, b) => {
                                const ta = Date.parse(a.created_at || "");
                                const tb = Date.parse(b.created_at || "");
                                return (
                                    (Number.isNaN(ta) ? 0 : ta) -
                                    (Number.isNaN(tb) ? 0 : tb)
                                );
                            })
                            .map((card) => ({
                                id: card.id,
                                image: card.image_url,
                                sound: card.sound_url,
                                name: card.name,
                            })),
                    }));
                },
            );

            // Ignora risposte arrivate dopo logout o cambio utente.
            if (loadId !== latestLoadId || activeUserId !== userId) return;

            // JSON non conserva le funzioni: va ricreata anche per i dati in cache.
            userCategories = (remoteCategories || []).map((cat) => ({
                ...cat,
                getName: (item) => item.name,
            }));
        } catch (error) {
            if (loadId !== latestLoadId || activeUserId !== userId) return;
            console.error("Card selector categories fetch error:", error);
        }
    }

    function toggleCategory(id) {
        expandedId = expandedId === id ? null : id;
    }

    function selectCard(categoryId, item, index) {
        dispatch("select", { category: categoryId, item, index });
    }

    function close() {
        dispatch("close");
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" on:click|self={close}>
    <div class="panel">
        <div class="panel-header">
            <h2>{slot ? `Seleziona Card ${slot}` : "Seleziona Card"}</h2>
            <button class="close-btn" on:click={close}>✕</button>
        </div>

        <div class="categories-list">
            {#each extendedCategories as cat}
                <div
                    class="category-section"
                    class:current={cat.id === currentCategory}
                >
                    <button
                        class="category-header"
                        class:expanded={expandedId === cat.id}
                        on:click={() => toggleCategory(cat.id)}
                    >
                        <span class="cat-emoji">{cat.emoji}</span>
                        <span class="cat-label">{cat.label}</span>
                        <span class="cat-count">{cat.items.length}</span>
                        <span class="chevron" class:open={expandedId === cat.id}
                            >▶</span
                        >
                    </button>

                    {#if expandedId === cat.id}
                        <div class="items-list">
                            {#each cat.items as item, idx}
                                <button
                                    class="item-row"
                                    class:active={cat.id === currentCategory &&
                                        item.id === currentItemId}
                                    on:click={() =>
                                        selectCard(cat.id, item, idx)}
                                >
                                    <img
                                        src={item.image}
                                        alt={cat.getName(item)}
                                        class="thumb"
                                    />
                                    <span class="item-label"
                                        >{cat.getName(item)}</span
                                    >
                                    {#if cat.id === currentCategory && item.id === currentItemId}
                                        <span class="current-badge">●</span>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: stretch;
        justify-content: flex-end;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .panel {
        width: 380px;
        max-width: 90vw;
        height: 100%;
        min-height: 0;
        background: white;
        display: flex;
        flex-direction: column;
        box-shadow: -10px 0 40px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.25s ease-out;
    }

    @keyframes slideIn {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(0);
        }
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: calc(1.25rem + env(safe-area-inset-top)) calc(1.5rem + env(safe-area-inset-right)) 1.25rem calc(1.5rem + env(safe-area-inset-left));
        border-bottom: 1px solid #eee;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        flex-shrink: 0;
    }

    .panel-header h2 {
        color: white;
        font-size: 1.3rem;
        margin: 0;
        font-weight: bold;
    }

    .close-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.35);
    }

    .categories-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0.5rem env(safe-area-inset-right) calc(0.5rem + env(safe-area-inset-bottom)) env(safe-area-inset-left);
    }

    .category-section {
        border-bottom: 1px solid #f0f0f0;
    }

    .category-section.current {
        border-left: 4px solid #667eea;
    }

    .category-header {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.05rem;
        transition: background 0.15s;
        text-align: left;
    }

    .category-header:hover {
        background: #f8f8ff;
    }

    .category-header.expanded {
        background: #f0f0ff;
    }

    .cat-emoji {
        font-size: 1.5rem;
        flex-shrink: 0;
    }

    .cat-label {
        font-weight: 600;
        color: #333;
        flex: 1;
    }

    .cat-count {
        font-size: 0.8rem;
        color: #999;
        background: #f0f0f0;
        border-radius: 10px;
        padding: 0.15rem 0.5rem;
    }

    .chevron {
        font-size: 0.7rem;
        color: #999;
        transition: transform 0.2s;
        flex-shrink: 0;
    }

    .chevron.open {
        transform: rotate(90deg);
    }

    .items-list {
        padding: 0.25rem 0;
        background: #fafafe;
    }

    .item-row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem 1.25rem 0.6rem 2rem;
        background: none;
        border: none;
        cursor: pointer;
        transition: background 0.12s;
        text-align: left;
    }

    .item-row:hover {
        background: #eef0ff;
    }

    .item-row.active {
        background: linear-gradient(90deg, #eef0ff 0%, #f0edff 100%);
    }

    .thumb {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        object-fit: cover;
        background: #f0f0f0;
        flex-shrink: 0;
    }

    .item-label {
        flex: 1;
        font-size: 0.95rem;
        color: #333;
        font-weight: 500;
    }

    .current-badge {
        color: #667eea;
        font-size: 1.2rem;
        flex-shrink: 0;
    }

    @media (max-width: 480px) {
        .panel {
            width: 100%;
            max-width: 100%;
        }
        .item-row {
            padding-left: 1.5rem;
        }
    }
</style>
