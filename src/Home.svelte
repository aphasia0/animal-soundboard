<script>
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { user, signOut } from "./authStore.js";
    import { getSupabase } from "./supabaseClient.js";

    const dispatch = createEventDispatcher();

    const categories = [
        {
            id: "animals",
            name: "Animali",
            emoji: "🦁",
            enabled: true,
            description: "50 animali",
        },
        {
            id: "work",
            name: "Lavoro",
            emoji: "🔨",
            enabled: true,
            description: "10 lavori",
        },
        {
            id: "people",
            name: "Persone",
            emoji: "👨‍👩‍👧‍👦",
            enabled: true,
            description: "5 persone",
        },
        {
            id: "music",
            name: "Musica",
            emoji: "🎵",
            enabled: true,
            description: "10 canzoni",
        },
        {
            id: "sentences",
            name: "Frasi",
            emoji: "💬",
            enabled: true,
            description: "8 frasi",
        },
    ];

    let cardMode = 1;
    let currentUser;
    user.subscribe((v) => (currentUser = v));

    let userCategories = [];
    let showUserMenu = false;

    onMount(() => {
        loadUserCategories();
        user.subscribe(() => loadUserCategories());
    });

    async function loadUserCategories() {
        if (!currentUser) {
            userCategories = [];
            return;
        }
        console.log("ciao");
        const supabase = getSupabase();
        if (!supabase) return;
        const { data } = await supabase
            .from("user_categories")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at");
        userCategories = data || [];
    }

    function selectCategory(category) {
        if (category.enabled) {
            dispatch("select", { categoryId: category.id, cardMode });
        }
    }

    function selectUserCategory(cat) {
        dispatch("selectUserCategory", { category: cat, cardMode });
    }

    function handleAddCategory() {
        if (!currentUser) {
            dispatch("showAuth");
        } else {
            dispatch("addCategory");
        }
    }

    function handleLoginClick() {
        if (currentUser) {
            showUserMenu = !showUserMenu;
        } else {
            dispatch("showAuth");
        }
    }

    async function handleLogout() {
        await signOut();
        showUserMenu = false;
        userCategories = [];
    }
</script>

<main>
    <div class="home">
        <!-- Auth button -->
        <div class="auth-area">
            <button class="auth-btn" on:click={handleLoginClick}>
                {#if currentUser}
                    <span class="user-avatar">👤</span>
                {:else}
                    <span class="login-text">Accedi</span>
                {/if}
            </button>
            {#if showUserMenu && currentUser}
                <div class="user-menu">
                    <div class="user-email">{currentUser.email}</div>
                    <button class="logout-btn" on:click={handleLogout}
                        >Esci</button
                    >
                </div>
            {/if}
        </div>

        <h3 class="title">Sound Pad</h3>

        <!-- Mode toggle -->
        <div class="mode-toggle">
            <button
                class="mode-btn"
                class:active={cardMode === 1}
                on:click={() => (cardMode = 1)}
            >
                <svg class="mode-icon" viewBox="0 0 60 80" fill="none">
                    <rect
                        x="4"
                        y="4"
                        width="52"
                        height="72"
                        rx="8"
                        fill={cardMode === 1 ? "#667eea" : "#ccc"}
                        stroke={cardMode === 1 ? "#5a6fd6" : "#bbb"}
                        stroke-width="3"
                    />
                </svg>
                <span class="mode-label">Una Card</span>
            </button>
            <button
                class="mode-btn"
                class:active={cardMode === 2}
                on:click={() => (cardMode = 2)}
            >
                <svg
                    class="mode-icon dual-icon"
                    viewBox="0 0 100 80"
                    fill="none"
                >
                    <rect
                        x="4"
                        y="4"
                        width="42"
                        height="72"
                        rx="7"
                        fill={cardMode === 2 ? "#667eea" : "#ccc"}
                        stroke={cardMode === 2 ? "#5a6fd6" : "#bbb"}
                        stroke-width="3"
                    />
                    <rect
                        x="54"
                        y="4"
                        width="42"
                        height="72"
                        rx="7"
                        fill={cardMode === 2 ? "#764ba2" : "#ccc"}
                        stroke={cardMode === 2 ? "#6a3f96" : "#bbb"}
                        stroke-width="3"
                    />
                </svg>
                <span class="mode-label">Due Card</span>
            </button>
        </div>

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
                <button
                    class="card enabled user-card"
                    on:click={() => selectUserCategory(ucat)}
                >
                    <div class="emoji">{ucat.emoji}</div>
                    <div class="name">{ucat.name}</div>
                    <div class="description">Personalizzata</div>
                </button>
            {/each}

            <button class="card add-card" on:click={handleAddCategory}>
                <div class="emoji">＋</div>
                <div class="name">Aggiungi</div>
                <div class="description">Nuova categoria</div>
            </button>
        </div>
    </div>
</main>

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
        align-items: center;
        justify-content: center;
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

    .auth-area {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 100;
    }
    .auth-btn {
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 15px;
        padding: 0.75rem 1.5rem;
        font-size: 1.1rem;
        font-weight: bold;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
    }
    .auth-btn:hover {
        background: white;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }
    .user-avatar {
        font-size: 1.3rem;
    }
    .login-text {
        font-size: 1rem;
    }
    .user-menu {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 0.5rem;
        background: white;
        border-radius: 16px;
        padding: 1rem;
        min-width: 200px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }
    .user-email {
        font-size: 0.85rem;
        color: #666;
        margin-bottom: 0.75rem;
        word-break: break-all;
    }
    .logout-btn {
        width: 100%;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0.6rem;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
    }
    .logout-btn:hover {
        background: #dc2626;
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

    /* Mode toggle */
    .mode-toggle {
        display: flex;
        gap: 1.5rem;
        margin-bottom: 2rem;
    }
    .mode-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        background: rgba(255, 255, 255, 0.15);
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 20px;
        padding: 1rem 2rem;
        cursor: pointer;
        transition: all 0.25s;
        backdrop-filter: blur(4px);
    }
    .mode-btn.active {
        background: rgba(255, 255, 255, 0.9);
        border-color: white;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
    }
    .mode-btn:not(.active):hover {
        background: rgba(255, 255, 255, 0.25);
        border-color: rgba(255, 255, 255, 0.5);
        transform: translateY(-3px);
    }
    .mode-icon {
        width: 50px;
        height: 60px;
    }
    .mode-icon.dual-icon {
        width: 80px;
    }
    .mode-label {
        font-size: 1rem;
        font-weight: bold;
        color: rgba(255, 255, 255, 0.9);
    }
    .mode-btn.active .mode-label {
        color: #667eea;
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
        .mode-toggle {
            gap: 1rem;
        }
        .mode-btn {
            padding: 0.75rem 1.25rem;
        }
        .mode-icon {
            width: 40px;
            height: 50px;
        }
        .mode-icon.dual-icon {
            width: 65px;
        }
    }

    @media (max-width: 480px) {
        .home {
            padding: 1rem;
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
        .mode-btn {
            padding: 0.6rem 1rem;
            border-radius: 14px;
        }
        .mode-icon {
            width: 32px;
            height: 42px;
        }
        .mode-icon.dual-icon {
            width: 55px;
        }
        .mode-label {
            font-size: 0.85rem;
        }
    }
</style>
