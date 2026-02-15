<script>
    import { createEventDispatcher } from "svelte";

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
    ];

    function selectCategory(category) {
        if (category.enabled) {
            dispatch("select", category.id);
        }
    }
</script>

<main>
    <div class="home">
        <h3 class="title">SoundPadsss</h3>

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
    }

    .home {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        box-sizing: border-box;
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
