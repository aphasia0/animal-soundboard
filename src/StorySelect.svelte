<script>
    import { createEventDispatcher } from "svelte";
    import { stories } from "./stories.js";

    const dispatch = createEventDispatcher();

    // Map story id to a representative emoji
    const storyEmojis = {
        "cappuccetto-rosso": "🐺",
        pinocchio: "🪵",
    };

    function selectStory(story) {
        dispatch("select", { story });
    }

    function goBack() {
        dispatch("back");
    }
</script>

<main>
    <div class="story-select">
        <div class="top-bar">
            <button class="back-button" on:click={goBack}>← Indietro</button>
        </div>

        <h3 class="title">🎭 Cantastorie</h3>

        <div class="grid">
            {#each stories as story}
                <button class="card" on:click={() => selectStory(story)}>
                    <div class="emoji">{storyEmojis[story.id] ?? "📖"}</div>
                    <div class="name">{story.name}</div>
                    <div class="description">
                        {story.chunks.length} capitoli
                    </div>
                </button>
            {/each}
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

    .story-select {
        width: 100%;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding: 2rem;
        box-sizing: border-box;
    }

    .top-bar {
        position: fixed;
        top: 1rem;
        left: 1rem;
        right: 1rem;
        display: flex;
        justify-content: space-between;
        z-index: 100;
    }

    .back-button {
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 15px;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: bold;
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
        margin-top: 4rem;
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

    .emoji {
        font-size: 6rem;
        margin-bottom: 1rem;
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
        .story-select {
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
    }
</style>
