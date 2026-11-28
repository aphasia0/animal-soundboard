<script>
    import { createEventDispatcher } from "svelte";
    import { signOut } from "./authStore.js";
    import { triggerVibration } from "./audioUtils.js";
    import { fade, fly, scale } from "svelte/transition";

    export let currentUser = null;
    let showUserMenu = false;
    const dispatch = createEventDispatcher();

    function selectMode(cardMode) {
        triggerVibration(60);
        dispatch("select", cardMode);
    }

    function handleLoginClick() {
        triggerVibration(40);
        if (currentUser) {
            showUserMenu = !showUserMenu;
        } else {
            dispatch("showAuth");
        }
    }

    function handleInfoClick() {
        triggerVibration(40);
        dispatch("openInfo");
    }

    async function handleLogout() {
        triggerVibration(80);
        await signOut();
        showUserMenu = false;
    }
</script>

<main>
    <div class="mode-select">
        <!-- Auth button -->
        <div class="auth-area">
            <button
                class="login-text auth-btn"
                on:click={handleInfoClick}
                title="Informazioni"
                data-tooltip="Informazioni"
            >
                Info
            </button>
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

        <h3 class="title" in:scale={{ duration: 500, delay: 100 }}>Scegli Modalità</h3>

        <div class="grid">
            <button class="card enabled" on:click={() => selectMode(1)} in:fly={{ y: 50, duration: 600, delay: 150 }}>
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

            <button class="card enabled" on:click={() => selectMode(2)} in:fly={{ y: 50, duration: 600, delay: 250 }}>
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

            <button class="card enabled" on:click={() => selectMode("stories")} in:fly={{ y: 50, duration: 600, delay: 350 }}>
                <div class="icon-container">
                    <div class="emoji-icon">🐺</div>
                </div>
                <div class="name">Cantastorie</div>
                <div class="description">Storie interattive</div>
            </button>

            <button class="card enabled" on:click={() => selectMode("band")} in:fly={{ y: 50, duration: 600, delay: 450 }}>
                <div class="icon-container">
                    <div class="emoji-icon">🎺</div>
                </div>
                <div class="name">La Banda</div>
                <div class="description">Fai musica</div>
            </button>

            <button class="card enabled" on:click={() => selectMode("quiz")} in:fly={{ y: 50, duration: 600, delay: 450 }}>
                <div class="icon-container">
                    <div class="emoji-icon">👂</div>
                </div>
                <div class="name">Ascolta e indovina</div>
                <div class="description">Due carte, un suono</div>
            </button>

            <button class="card enabled" on:click={() => selectMode("calm")} in:fly={{ y: 50, duration: 600, delay: 550 }}>
                <div class="icon-container">
                    <div class="emoji-icon">🌙</div>
                </div>
                <div class="name">Calma</div>
                <div class="description">Rilassati</div>
            </button>

            <button class="card enabled" on:click={() => selectMode("games")} in:fly={{ y: 50, duration: 600, delay: 650 }}>
                <div class="icon-container">
                    <div class="emoji-icon">🎮</div>
                </div>
                <div class="name">Giochi</div>
                <div class="description">Giochi semplici</div>
            </button>
        </div>
    </div>
</main>

<style>
    main {
        width: 100%;
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        background: #667eea;
        padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }

    .mode-select {
        width: 100%;
        flex: 1;
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
        margin-top: auto;
        margin-bottom: 3rem;
        text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
        text-align: center;
    }

    /* ── Auth Button ─────────────────────────────── */
    .auth-area {
        position: relative;
        align-self: flex-end;
        z-index: 100;
        display: flex;
        flex-shrink: 0;
        gap: 0.5rem;
        margin-bottom: 1rem;
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
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: stretch;
        gap: 2rem;
        max-width: 1080px;
        width: 100%;
        margin-bottom: auto;
    }

    .grid .card {
        /* Tre per riga; la quinta card resta centrata da sola. */
        flex: 1 1 calc((100% - 4rem) / 3);
        max-width: 340px;
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
        transition:
            transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
            box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        min-height: 250px;
        position: relative;
        user-select: none;
        -webkit-user-select: none;
    }

    @media (hover: hover) and (pointer: fine) {
        .card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
    }

    .card:active {
        transform: translateY(1px) scale(0.985);
        box-shadow: 0 5px 18px rgba(0, 0, 0, 0.2);
        transition-duration: 90ms;
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
            gap: 1.5rem;
            max-width: 400px;
        }

        .grid .card {
            flex-basis: 100%;
            max-width: 100%;
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
