<script>
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    function selectMode(cardMode) {
        dispatch("select", cardMode);
    }
</script>

<main>
    <div class="mode-select">
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

    .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2rem;
        max-width: 800px;
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
            gap: 1rem;
            max-width: 600px;
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
