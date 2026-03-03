<script>
    import { createEventDispatcher } from "svelte";
    import { stories } from "./stories.js";

    const dispatch = createEventDispatcher();

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
            <button
                class="back-button"
                on:click={goBack}
                title="Indietro"
                data-tooltip="Indietro"
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

        <h3 class="title">🎭 Cantastorie</h3>

        <div class="grid">
            {#each stories as story}
                <button class="card" on:click={() => selectStory(story)}>
                    <div class="image-container">
                        {#if story.chunks && story.chunks[0]}
                            <img
                                src={story.chunks[0].imagePortrait}
                                alt={story.name}
                                class="story-image"
                            />
                        {:else}
                            <div class="emoji-fallback">📖</div>
                        {/if}
                    </div>
                    <div class="card-info">
                        <div class="name">{story.name}</div>
                        <div class="description">
                            {story.chunks.length} capitoli
                        </div>
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
        background: white;
        border: none;
        border-radius: 24px;
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        min-height: 280px;
        user-select: none;
    }
    .card:hover {
        transform: translateY(-8px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
    }

    .image-container {
        width: 100%;
        height: 180px;
        background: #f0f0f0;
        position: relative;
        overflow: hidden;
    }

    .story-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.5s ease;
    }
    .card:hover .story-image {
        transform: scale(1.1);
    }

    .emoji-fallback {
        font-size: 4rem;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    .card-info {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .name {
        font-size: 1.6rem;
        font-weight: 700;
        color: #333;
        margin-bottom: 0.25rem;
        text-align: center;
    }

    .description {
        font-size: 1rem;
        color: #888;
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
            min-height: 220px;
            border-radius: 18px;
        }
        .image-container {
            height: 130px;
        }
        .card-info {
            padding: 1rem;
        }
        .name {
            font-size: 1.3rem;
        }
        .description {
            font-size: 0.9rem;
        }
    }

    @media (max-width: 480px) {
        .story-select {
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
            min-height: 180px;
        }
        .image-container {
            height: 100px;
        }
        .name {
            font-size: 1.1rem;
        }
        .description {
            font-size: 0.8rem;
        }
    }
</style>
