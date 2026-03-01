<script>
    import { createEventDispatcher } from "svelte";
    import { signOut } from "./authStore.js";

    export let currentUser = null;
    let showUserMenu = false;
    const dispatch = createEventDispatcher();

    function selectMode(cardMode) {
        dispatch("select", cardMode);
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
    }
</script>

<main>
    <div class="mode-select">
        <!-- Auth button -->
        <div class="auth-area">
            <button
                class="auth-btn"
                on:click={handleLoginClick}
                title={currentUser ? "Account" : "Accedi"}
                data-tooltip={currentUser ? "Account" : "Accedi"}
            >
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

        <h3 class="title">Scegli Modalità</h3>

        <div class="grid">
            <button class="card enabled" on:click={() => selectMode(1)}>
                <div class="icon-container">
                    <svg class="mode-icon" viewBox="0 0 60 80" fill="none">
                        <rect
                            x="4"
                            y="4"
                            width="52"
                            height="72"
                            rx="8"
                            fill="#667eea"
                            stroke="#5a6fd6"
                            stroke-width="3"
                        />
                    </svg>
                </div>
                <div class="name">Una Card</div>
                <div class="description">Modalità classica</div>
            </button>

            <button class="card enabled" on:click={() => selectMode(2)}>
                <div class="icon-container">
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
                            fill="#667eea"
                            stroke="#5a6fd6"
                            stroke-width="3"
                        />
                        <rect
                            x="54"
                            y="4"
                            width="42"
                            height="72"
                            rx="7"
                            fill="#764ba2"
                            stroke="#6a3f96"
                            stroke-width="3"
                        />
                    </svg>
                </div>
                <div class="name">Due Card</div>
                <div class="description">Due card affiancate</div>
            </button>

            <button class="card enabled" on:click={() => selectMode("stories")}>
                <div class="icon-container">
                    <div class="emoji-icon">🐺</div>
                </div>
                <div class="name">Cantastorie</div>
                <div class="description">Storie interattive</div>
            </button>
        </div>
    </div>
</main>

<style>
    main {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        overflow-y: auto;
    }

    .mode-select {
        width: 100%;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        box-sizing: border-box;
        position: relative;
    }

    .card.enabled {
        background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
    }

    .title {
        color: white;
        font-size: 3rem;
        font-weight: bold;
        margin-bottom: 3rem;
        text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
        text-align: center;
    }

    /* ── Auth Button ─────────────────────────────── */
    .auth-area {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 100;
    }
    .auth-btn {
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 15px;
        height: 3.2rem;
        padding: 0 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        font-weight: bold;
    }
    .auth-btn:hover {
        background: white;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }
    .user-avatar {
        font-size: 1.5rem;
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

    .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2rem;
        max-width: 1000px;
        width: 100%;
    }

    .card {
        background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
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

    .card:hover {
        transform: translateY(-10px) scale(1.05);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .card:active {
        transform: translateY(-5px) scale(1.02);
    }

    .icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100px;
        margin-bottom: 1rem;
    }

    .mode-icon {
        width: 70px;
        height: 95px;
    }

    .mode-icon.dual-icon {
        width: 115px;
    }

    .emoji-icon {
        font-size: 5.5rem;
        line-height: 1;
    }

    .name {
        font-size: 2rem;
        font-weight: bold;
        color: #667eea;
        margin-bottom: 0.5rem;
        text-align: center;
    }

    .description {
        font-size: 1.2rem;
        color: #666;
        text-align: center;
    }

    @media (max-width: 768px) {
        .title {
            font-size: 2rem;
            margin-bottom: 2rem;
        }

        .grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
            max-width: 400px;
        }

        .card {
            padding: 2rem 1rem;
            min-height: 200px;
            border-radius: 20px;
        }

        .mode-icon {
            width: 50px;
            height: 70px;
        }

        .mode-icon.dual-icon {
            width: 85px;
        }

        .emoji-icon {
            font-size: 4rem;
        }

        .name {
            font-size: 1.5rem;
        }

        .description {
            font-size: 1rem;
        }

        .mode-select {
            padding: 1rem;
            padding-bottom: calc(1rem + env(safe-area-inset-bottom));
        }

        .title {
            font-size: 1.5rem;
            margin-bottom: 1.5rem;
        }

        .grid {
            gap: 0.75rem;
        }

        .card {
            padding: 1.5rem 1rem;
            min-height: 150px;
        }

        .mode-icon {
            width: 40px;
            height: 55px;
        }

        .mode-icon.dual-icon {
            width: 65px;
        }

        .name {
            font-size: 1.2rem;
        }

        .description {
            font-size: 0.9rem;
        }
    }
</style>
