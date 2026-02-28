<script>
    import { createEventDispatcher, onMount, onDestroy } from "svelte";

    export let story; // The story object

    const dispatch = createEventDispatcher();

    let currentIndex = 0;
    let currentChunk = story.chunks[0];
    let audioEl;
    let isPlaying = false;
    let showText = true;

    // We start at chunk 0, paused.
    $: currentChunk = story.chunks[currentIndex];

    onMount(() => {
        // Wait for user click to start
    });

    onDestroy(() => {
        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
    });

    function playCurrentChunk() {
        if (!audioEl) return;

        // If we are already playing this audio and just paused it, resume.
        if (audioEl.src.endsWith(currentChunk.sound)) {
            audioEl
                .play()
                .then(() => {
                    isPlaying = true;
                    showText = true;
                })
                .catch((e) => {
                    console.log("Play prevented:", e.message);
                });
            return;
        }

        // Otherwise load new audio and play
        audioEl.src = currentChunk.sound;
        audioEl
            .play()
            .then(() => {
                isPlaying = true;
                showText = true;
            })
            .catch((e) => {
                console.log("Play prevented:", e.message);
                isPlaying = false;
            });
    }

    function pauseCurrentChunk() {
        if (!audioEl) return;
        audioEl.pause();
        isPlaying = false;
    }

    function handleAudioEnded() {
        if (currentIndex < story.chunks.length - 1) {
            currentIndex++;
            showText = false; // Hide briefly before next chunk
            setTimeout(() => {
                playCurrentChunk();
            }, 300); // small delay between chunks
        } else {
            // End of story
            isPlaying = false;
        }
    }

    function goBack() {
        dispatch("back");
    }

    // Toggle play/pause
    function handleClick() {
        // If end screen, don't do anything here
        if (currentIndex === story.chunks.length - 1 && !isPlaying && showText)
            return;

        if (!isPlaying) {
            playCurrentChunk();
        } else {
            pauseCurrentChunk();
        }
    }
</script>

<main>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="story-container"
        style="background-image: url('{currentChunk.image}')"
        on:click={handleClick}
    >
        <button class="back-button" on:click|stopPropagation={goBack}
            >← Indietro</button
        >

        {#if currentIndex === story.chunks.length - 1 && !isPlaying && showText}
            <div class="end-screen">
                <h1>Fine!</h1>
                <p>Spero ti sia piaciuta la storia di {story.name}</p>
                <button
                    class="restart-btn"
                    on:click|stopPropagation={() => {
                        currentIndex = 0;
                        showText = false;
                        playCurrentChunk();
                    }}>Riascolta</button
                >
            </div>
        {:else}
            <!-- svelte-ignore a11y-media-has-caption -->
            <audio bind:this={audioEl} on:ended={handleAudioEnded}></audio>

            {#if showText || isPlaying}
                <div class="text-overlay {isPlaying ? 'visible' : ''}">
                    <p>{currentChunk.text}</p>
                </div>
            {/if}
        {/if}
    </div>
</main>

<style>
    main {
        width: 100vw;
        height: 100vh;
        background: #000;
        overflow: hidden;
    }

    .story-container {
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        cursor: pointer;
        transition: background-image 0.5s ease-in-out;
    }

    .back-button {
        position: absolute;
        top: 1rem;
        left: 1rem;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 15px;
        padding: 0.75rem 1.5rem;
        font-size: 1.1rem;
        font-weight: bold;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 100;
    }

    .text-overlay {
        background: rgba(0, 0, 0, 0.65);
        color: white;
        padding: 2.5rem 3rem 2.5rem 3rem;
        width: 100%;
        text-align: center;
        backdrop-filter: blur(8px);
        box-sizing: border-box;
        margin: 0;
        transform: translateY(100%);
        opacity: 0;
        transition:
            transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
            opacity 0.6s ease;
    }

    .text-overlay.visible {
        transform: translateY(0);
        opacity: 1;
    }

    .text-overlay p {
        margin: 0;
        font-size: 1.8rem;
        line-height: 1.4;
        font-weight: bold;
        text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.5);
    }

    .end-screen {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 50;
    }
    .end-screen h1 {
        font-size: 5rem;
        margin-bottom: 1rem;
        color: #4ade80;
    }
    .end-screen p {
        font-size: 2rem;
        margin-bottom: 3rem;
    }
    .restart-btn {
        background: #667eea;
        color: white;
        border: none;
        border-radius: 20px;
        padding: 1rem 3rem;
        font-size: 1.5rem;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.5);
    }

    @keyframes pulse {
        0% {
            transform: translate(-50%, -50%) scale(0.95);
        }
        50% {
            transform: translate(-50%, -50%) scale(1.05);
        }
        100% {
            transform: translate(-50%, -50%) scale(0.95);
        }
    }

    @media (max-width: 768px) {
        .text-overlay p {
            font-size: 1.3rem;
        }
        .text-overlay {
            padding: 1.5rem 1rem 1.5rem 1rem;
        }
    }
</style>
