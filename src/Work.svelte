<script>
    import { onDestroy } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { jobs, getRandomJob } from "./jobs.js";
    import { getJobName } from "./i18n.js";
    import {
        playAudio,
        stopAudio,
        preloadSounds,
        resumeAudioContext,
    } from "./audioUtils.js";

    // Preload all job sounds immediately for instant playback
    preloadSounds(jobs.map((j) => j.sound));

    const dispatch = createEventDispatcher();
    const locale = "it";

    let currentJob = getRandomJob();
    let progress = 0;
    let accumulatedTime = 0;
    let isPressed = false;
    let pressStartTime = null;
    let isTouchDevice = false;
    let animationFrameId = null;

    const MAX_TIME = 5000;

    function handlePressStart() {
        if (isPressed) return;

        isPressed = true;
        pressStartTime = Date.now();

        resumeAudioContext();
        playAudio(currentJob.sound);

        updateProgress();
    }

    function handlePressEnd() {
        if (!isPressed) return;

        isPressed = false;

        const timePressed = Date.now() - pressStartTime;
        accumulatedTime += timePressed;

        stopAudio();

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        if (accumulatedTime >= MAX_TIME) {
            nextJob();
        } else {
            progress = (accumulatedTime / MAX_TIME) * 100;
        }
    }

    function updateProgress() {
        if (!isPressed) return;

        const currentTime = Date.now();
        const totalTime = accumulatedTime + (currentTime - pressStartTime);
        progress = Math.min((totalTime / MAX_TIME) * 100, 100);

        if (totalTime >= MAX_TIME) {
            handlePressEnd();
            nextJob();
            return;
        }

        animationFrameId = requestAnimationFrame(updateProgress);
    }

    function nextJob() {
        currentJob = getRandomJob(currentJob.id);
        accumulatedTime = 0;
        progress = 0;

        stopAudio();
    }

    function handleTouchStart(e) {
        e.preventDefault();
        isTouchDevice = true;
        if (e.touches.length > 1) return;
        handlePressStart();
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        if (e.touches.length > 0) return;
        handlePressEnd();
    }

    function handleKeyDown(e) {
        if (e.repeat) return;
        handlePressStart();
    }

    function handleKeyUp(e) {
        handlePressEnd();
    }

    function goBack() {
        dispatch("back");
    }

    onDestroy(() => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        stopAudio();
    });
</script>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />

<main>
    <div class="soundboard">
        <button class="back-button" on:click={goBack}> ← Indietro </button>

        <div class="progress-container">
            <div class="progress-bar" style="width: {progress}%"></div>
        </div>

        <button
            class="item-button"
            on:mousedown={() => {
                if (!isTouchDevice) handlePressStart();
            }}
            on:mouseup={() => {
                if (!isTouchDevice) handlePressEnd();
            }}
            on:mouseleave={() => {
                if (!isTouchDevice) handlePressEnd();
            }}
            on:touchstart={handleTouchStart}
            on:touchend={handleTouchEnd}
            on:touchcancel={handleTouchEnd}
        >
            <img
                src={currentJob.image}
                alt={getJobName(currentJob.key, locale)}
            />
            <div class="item-name">
                {getJobName(currentJob.key, locale)}
            </div>
        </button>
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

    .soundboard {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 1rem;
        box-sizing: border-box;
        position: relative;
    }

    .back-button {
        position: absolute;
        top: 1rem;
        left: 1rem;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 15px;
        padding: 1rem 2rem;
        font-size: 1.2rem;
        font-weight: bold;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        z-index: 10;
    }

    .back-button:hover {
        background: white;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }

    .back-button:active {
        transform: translateY(0);
    }

    .progress-container {
        height: 8%;
        background-color: rgba(255, 255, 255, 0.3);
        border-radius: 20px;
        overflow: hidden;
        margin-bottom: 1rem;
        margin-top: 4rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
        transition: width 0.1s linear;
        border-radius: 20px;
        box-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
    }

    .item-button {
        flex: 1;
        border: none;
        border-radius: 30px;
        background: white;
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        transition:
            transform 0.01s,
            box-shadow 0.01s;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        position: relative;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .item-button:active {
        transform: scale(0.93);
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    }

    .item-button img {
        max-width: 90%;
        max-height: 80%;
        object-fit: contain;
        pointer-events: none;
    }

    .item-name {
        position: absolute;
        bottom: 2rem;
        font-size: 3rem;
        font-weight: bold;
        color: #667eea;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        pointer-events: none;
    }

    @media (max-width: 768px) {
        .back-button {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
        }

        .item-name {
            font-size: 2rem;
            bottom: 1rem;
        }

        .soundboard {
            padding: 0.5rem;
        }

        .item-button {
            padding: 1rem;
            border-radius: 20px;
        }

        .progress-container {
            margin-top: 3.5rem;
        }
    }
</style>
