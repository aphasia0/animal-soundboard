<script>
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { user, signOut } from "./authStore.js";
    import { getSupabase } from "./supabaseClient.js";
    import { animals } from "./animals.js";
    import { jobs } from "./jobs.js";
    import { music } from "./music.js";
    import { people } from "./people.js";
    import { sentences } from "./sentences.js";

    import AddCategoryModal from "./AddCategoryModal.svelte";

    const dispatch = createEventDispatcher();

    let currentUser;
    user.subscribe((v) => {
        currentUser = v;
        loadUserCategories();
    });

    const categories = [
        {
            id: "animals",
            name: "Animali",
            emoji: "🦁",
            enabled: true,
            description: `${animals.length} animali`,
        },
        {
            id: "work",
            name: "Lavoro",
            emoji: "🔨",
            enabled: true,
            description: `${jobs.length} lavori`,
        },
        {
            id: "people",
            name: "Persone",
            emoji: "👨‍👩‍👧‍👦",
            enabled: true,
            description: `${people.length} persone`,
        },
        {
            id: "music",
            name: "Musica",
            emoji: "🎵",
            enabled: true,
            description: `${music.length} canzoni`,
        },
        {
            id: "sentences",
            name: "Frasi",
            emoji: "💬",
            enabled: true,
            description: `${sentences.length} frasi`,
        },
    ];

    let userCategories = [];

    // Category edit/delete state
    let showEditCatModal = false;
    let catToEdit = null;
    let showDeleteCatConfirm = false;
    let catToDelete = null;

    function openEditCategory(cat, e) {
        e.stopPropagation();
        catToEdit = cat;
        showEditCatModal = true;
    }

    function openDeleteCategory(cat, e) {
        e.stopPropagation();
        catToDelete = cat;
        showDeleteCatConfirm = true;
    }

    async function confirmDeleteCategory() {
        if (!catToDelete) return;
        const supabase = getSupabase();
        await supabase
            .from("user_categories")
            .delete()
            .eq("id", catToDelete.id);
        showDeleteCatConfirm = false;
        catToDelete = null;
        await loadUserCategories();
    }

    onMount(() => {
        loadUserCategories();
    });

    async function loadUserCategories() {
        if (!currentUser) {
            userCategories = [];
            return;
        }
        const supabase = getSupabase();
        if (!supabase) return;
        const { data } = await supabase
            .from("user_categories")
            .select("*, user_cards(count)")
            .eq("user_id", currentUser.id)
            .order("created_at");

        userCategories = (data || []).map((cat) => ({
            id: cat.id,
            name: cat.name,
            emoji: cat.emoji,
            cardCount: cat.user_cards?.[0]?.count || 0,
        }));
    }

    function selectCategory(category) {
        if (category.enabled) {
            dispatch("select", { categoryId: category.id });
        }
    }

    function selectUserCategory(cat) {
        dispatch("selectUserCategory", { category: cat });
    }

    function handleAddCategory() {
        // Assuming authentication is handled elsewhere or not required for adding categories in this context
        dispatch("addCategory");
    }

    function goBack() {
        dispatch("back");
    }
</script>

<main>
    <div class="home">
        <div class="top-nav">
            <button
                class="back-button"
                on:click={goBack}
                title="Cambia categoria"
                data-tooltip="Cambia categoria"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    width="24"
                    height="24"
                >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
            </button>
        </div>

        <h3 class="title">Sound Pad</h3>

        <div class="grid">
            {#each categories as category}
                <button
                    class="card"
                    class:enabled={category.enabled}
                    class:disabled={!category.enabled}
                    on:click={() => selectCategory(category)}
                    disabled={!category.enabled}
                >
                    <div class="emoji">{category.emoji}</div>
                    <div class="name">{category.name}</div>
                    <div class="description">{category.description}</div>
                </button>
            {/each}

            {#each userCategories as ucat}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div
                    class="card enabled user-card"
                    on:click={() => selectUserCategory(ucat)}
                >
                    <!-- Edit & Delete overlay icons -->
                    <div class="cat-actions">
                        <button
                            class="cat-action-btn cat-edit-btn"
                            title="Modifica"
                            on:click={(e) => openEditCategory(ucat, e)}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path
                                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                />
                                <path
                                    d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                />
                            </svg>
                        </button>
                        <button
                            class="cat-action-btn cat-delete-btn"
                            title="Elimina"
                            on:click={(e) => openDeleteCategory(ucat, e)}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <polyline points="3 6 5 6 21 6" />
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                />
                                <line x1="10" y1="11" x2="10" y2="17" /><line
                                    x1="14"
                                    y1="11"
                                    x2="14"
                                    y2="17"
                                />
                            </svg>
                        </button>
                    </div>
                    <div class="emoji">{ucat.emoji}</div>
                    <div class="name">{ucat.name}</div>
                    <div class="description">
                        {ucat.cardCount}
                        {ucat.cardCount === 1 ? "card" : "card"}
                    </div>
                </div>
            {/each}

            <button class="card add-card" on:click={handleAddCategory}>
                <div class="emoji">＋</div>
                <div class="name">Aggiungi</div>
                <div class="description">Nuova categoria</div>
            </button>
        </div>
    </div>
</main>

<!-- Category delete confirmation -->
{#if showDeleteCatConfirm && catToDelete}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
        class="cat-overlay"
        on:click|self={() => {
            showDeleteCatConfirm = false;
            catToDelete = null;
        }}
    >
        <div class="cat-modal">
            <h3>Elimina "{catToDelete.name}"?</h3>
            <p style="color:#666;font-size:0.9rem">
                Questa azione non può essere annullata.
            </p>
            <div class="cat-modal-actions">
                <button
                    class="cat-cancel-btn"
                    on:click={() => {
                        showDeleteCatConfirm = false;
                        catToDelete = null;
                    }}>Annulla</button
                >
                <button class="cat-confirm-btn" on:click={confirmDeleteCategory}
                    >Sì, elimina</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- Category edit modal -->
{#if showEditCatModal && catToEdit}
    <AddCategoryModal
        editCategory={catToEdit}
        on:saved={async () => {
            showEditCatModal = false;
            catToEdit = null;
            await loadUserCategories();
        }}
        on:close={() => {
            showEditCatModal = false;
            catToEdit = null;
        }}
    />
{/if}

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        overflow: hidden;
        font-family: "Arial", sans-serif;
    }

    main {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        overflow-y: auto;
    }

    .home {
        width: 100%;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding: 2rem;
        box-sizing: border-box;
    }

    /* ── Top Navigation ─────────────────────────────── */
    .top-nav {
        position: absolute;
        top: 1rem;
        left: 1rem;
        z-index: 100;
    }
    .back-button {
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 15px;
        width: 3.2rem;
        height: 3.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
    }
    .back-button:hover {
        background: white;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }

    .title {
        color: white;
        font-size: 3rem;
        font-weight: bold;
        margin-top: 1rem;
        margin-bottom: 1.5rem;
        text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
        text-align: center;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2rem;
        max-width: 800px;
        width: 100%;
        padding-bottom: 2rem;
    }

    .card {
        background: white;
        border: none;
        border-radius: 30px;
        padding: 3rem 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        min-height: 250px;
        position: relative;
        user-select: none;
        -webkit-user-select: none;
    }
    .card.enabled {
        background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
    }
    .card.enabled:hover {
        transform: translateY(-10px) scale(1.05);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .card.enabled:active {
        transform: translateY(-5px) scale(1.02);
    }
    .card.disabled {
        background: linear-gradient(135deg, #e0e0e0 0%, #d0d0d0 100%);
        cursor: not-allowed;
        opacity: 0.6;
    }

    .user-card {
        border: 3px solid rgba(102, 126, 234, 0.3);
        cursor: pointer;
    }

    /* Category action buttons — top-right of user-card */
    .cat-actions {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        display: flex;
        gap: 0.35rem;
        z-index: 10;
    }
    .cat-action-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0.85;
        transition:
            opacity 0.15s,
            transform 0.15s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    }
    .cat-action-btn:hover,
    .cat-action-btn:active {
        opacity: 1;
        transform: scale(1.12);
    }
    .cat-edit-btn {
        background: #f59e0b;
        color: white;
    }
    .cat-delete-btn {
        background: #ef4444;
        color: white;
    }

    /* Category delete confirm modal */
    .cat-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(3px);
    }
    .cat-modal {
        background: white;
        border-radius: 20px;
        padding: 2rem;
        width: 90%;
        max-width: 360px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
        text-align: center;
    }
    .cat-modal h3 {
        color: #1a1a1a;
        margin: 0 0 0.5rem;
        font-size: 1.2rem;
    }
    .cat-modal-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1.25rem;
    }
    .cat-cancel-btn,
    .cat-confirm-btn {
        flex: 1;
        padding: 0.7rem;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.15s;
    }
    .cat-cancel-btn {
        background: #f1f5f9;
        color: #475569;
    }
    .cat-confirm-btn {
        background: #ef4444;
        color: white;
    }
    .cat-confirm-btn:hover {
        background: #dc2626;
    }

    .add-card {
        background: rgba(255, 255, 255, 0.15) !important;
        border: 3px dashed rgba(255, 255, 255, 0.5) !important;
        backdrop-filter: blur(4px);
    }
    .add-card:hover {
        background: rgba(255, 255, 255, 0.25) !important;
        transform: translateY(-10px) scale(1.05);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .add-card .emoji {
        color: white;
    }
    .add-card .name {
        color: white !important;
    }
    .add-card .description {
        color: rgba(255, 255, 255, 0.8) !important;
    }

    .emoji {
        font-size: 6rem;
        margin-bottom: 1rem;
        line-height: 1;
    }
    .card.disabled .emoji {
        filter: grayscale(100%);
        opacity: 0.5;
    }
    .name {
        font-size: 2rem;
        font-weight: bold;
        color: #667eea;
        margin-bottom: 0.5rem;
        text-align: center;
    }
    .card.disabled .name {
        color: #999;
    }
    .description {
        font-size: 1.2rem;
        color: #666;
        text-align: center;
    }
    .card.disabled .description {
        color: #aaa;
        font-style: italic;
    }

    @media (max-width: 768px) {
        .home {
            padding-bottom: calc(2rem + env(safe-area-inset-bottom));
        }
        .title {
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        .grid {
            gap: 1rem;
            max-width: 600px;
        }
        .card {
            padding: 2rem 1rem;
            min-height: 200px;
            border-radius: 20px;
        }
        .emoji {
            font-size: 4rem;
        }
        .name {
            font-size: 1.5rem;
        }
        .description {
            font-size: 1rem;
        }
    }

    @media (max-width: 480px) {
        .home {
            padding: 1rem;
            padding-bottom: calc(1rem + env(safe-area-inset-bottom));
        }
        .title {
            font-size: 1.5rem;
            margin-bottom: 0.75rem;
        }
        .grid {
            gap: 0.75rem;
        }
        .card {
            padding: 1.5rem 1rem;
            min-height: 150px;
        }
        .emoji {
            font-size: 3rem;
        }
        .name {
            font-size: 1.2rem;
        }
        .description {
            font-size: 0.9rem;
        }
    }
</style>
