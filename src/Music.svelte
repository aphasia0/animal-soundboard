<script>
    import { onMount, onDestroy } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { music, getRandomMusic } from "./music.js";
    import { getMusicName } from "./i18n.js";
    import CardSelector from "./CardSelector.svelte";
    import {
        playAudio,
        stopAudio,
        playAudioChannel,
        stopAudioChannel,
        stopAllChannels,
        preloadSounds,
        resumeAudioContext,
    } from "./audioUtils.js";

    export let cardMode = 1;

    preloadSounds(music.map((m) => m.sound));

    const dispatch = createEventDispatcher();
    const locale = "it";

    let shuffleMode = true;
    let seqIndex = 0;
    let seqIndexA = 0;
    let seqIndexB = 1 % music.length;

    let currentMusic = getRandomMusic();
    let progress = 0;
    let accumulatedTime = 0;
    let isPressed = false;
    let pressStartTime = null;
    let isTouchDevice = false;
    let animationFrameId = null;

    let itemA = getRandomMusic();
    let itemB = getRandomMusic(itemA.id);
    let progressA = 0;
    let progressB = 0;
    let accumulatedTimeA = 0;
    let accumulatedTimeB = 0;
    let isPressedA = false;
    let isPressedB = false;
    let pressStartTimeA = null;
    let pressStartTimeB = null;
    let animationFrameIdA = null;
    let animationFrameIdB = null;

    let isLandscape = false;

    function checkOrientation() {
        isLandscape = window.innerWidth > window.innerHeight;
    }

    onMount(() => {
        checkOrientation();
        window.addEventListener("resize", checkOrientation);
    });

    const MAX_TIME = 5000;

    function handlePressStart() {
        if (isPressed) return;
        isPressed = true;
        pressStartTime = Date.now();
        resumeAudioContext();
        playAudio(currentMusic.sound);
        updateProgress();
    }

    function handlePressEnd() {
        if (!isPressed) return;
        isPressed = false;
        const timePressed = Date.now() - pressStartTime;
        accumulatedTime += timePressed;
        stopAudio();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (accumulatedTime >= MAX_TIME) {
            nextMusic();
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
            nextMusic();
            return;
        }
        animationFrameId = requestAnimationFrame(updateProgress);
    }

    function nextMusic() {
        if (shuffleMode) {
            currentMusic = getRandomMusic(currentMusic.id);
        } else {
            seqIndex = (seqIndex + 1) % music.length;
            currentMusic = music[seqIndex];
        }
        accumulatedTime = 0;
        progress = 0;
        stopAudio();
    }

    function handlePressStartA() {
        if (isPressedA) return;
        isPressedA = true;
        pressStartTimeA = Date.now();
        resumeAudioContext();
        playAudioChannel(itemA.sound, "cardA");
        updateProgressA();
    }

    function handlePressEndA() {
        if (!isPressedA) return;
        isPressedA = false;
        const timePressed = Date.now() - pressStartTimeA;
        accumulatedTimeA += timePressed;
        stopAudioChannel("cardA");
        if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
        if (accumulatedTimeA >= MAX_TIME) {
            nextItemA();
        } else {
            progressA = (accumulatedTimeA / MAX_TIME) * 100;
        }
    }

    function updateProgressA() {
        if (!isPressedA) return;
        const currentTime = Date.now();
        const totalTime = accumulatedTimeA + (currentTime - pressStartTimeA);
        progressA = Math.min((totalTime / MAX_TIME) * 100, 100);
        if (totalTime >= MAX_TIME) {
            handlePressEndA();
            nextItemA();
            return;
        }
        animationFrameIdA = requestAnimationFrame(updateProgressA);
    }

    function nextItemA() {
        if (shuffleMode) {
            itemA = getRandomMusic(itemA.id);
        } else {
            seqIndexA = (seqIndexA + 1) % music.length;
            itemA = music[seqIndexA];
        }
        accumulatedTimeA = 0;
        progressA = 0;
        stopAudioChannel("cardA");
    }

    function handlePressStartB() {
        if (isPressedB) return;
        isPressedB = true;
        pressStartTimeB = Date.now();
        resumeAudioContext();
        playAudioChannel(itemB.sound, "cardB");
        updateProgressB();
    }

    function handlePressEndB() {
        if (!isPressedB) return;
        isPressedB = false;
        const timePressed = Date.now() - pressStartTimeB;
        accumulatedTimeB += timePressed;
        stopAudioChannel("cardB");
        if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
        if (accumulatedTimeB >= MAX_TIME) {
            nextItemB();
        } else {
            progressB = (accumulatedTimeB / MAX_TIME) * 100;
        }
    }

    function updateProgressB() {
        if (!isPressedB) return;
        const currentTime = Date.now();
        const totalTime = accumulatedTimeB + (currentTime - pressStartTimeB);
        progressB = Math.min((totalTime / MAX_TIME) * 100, 100);
        if (totalTime >= MAX_TIME) {
            handlePressEndB();
            nextItemB();
            return;
        }
        animationFrameIdB = requestAnimationFrame(updateProgressB);
    }

    function nextItemB() {
        if (shuffleMode) {
            itemB = getRandomMusic(itemB.id);
        } else {
            seqIndexB = (seqIndexB + 1) % music.length;
            itemB = music[seqIndexB];
        }
        accumulatedTimeB = 0;
        progressB = 0;
        stopAudioChannel("cardB");
    }

    function handleTouchStartA(e) {
        e.preventDefault();
        e.stopPropagation();
        isTouchDevice = true;
        handlePressStartA();
    }
    function handleTouchEndA(e) {
        e.preventDefault();
        e.stopPropagation();
        handlePressEndA();
    }
    function handleTouchStartB(e) {
        e.preventDefault();
        e.stopPropagation();
        isTouchDevice = true;
        handlePressStartB();
    }
    function handleTouchEndB(e) {
        e.preventDefault();
        e.stopPropagation();
        handlePressEndB();
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
        if (cardMode === 2 || e.repeat) return;
        handlePressStart();
    }
    function handleKeyUp(e) {
        if (cardMode === 2) return;
        handlePressEnd();
    }

    function goBack() {
        dispatch("back");
    }

    let showSelector = false;

    function handleCardSelect(e) {
        const { category, item, index } = e.detail;
        showSelector = false;
        if (category === "music") {
            currentMusic = item;
            seqIndex = index;
            accumulatedTime = 0;
            progress = 0;
            stopAudio();
            stopAllChannels();
        } else {
            dispatch("jumpTo", { category, item, index });
        }
    }

    onDestroy(() => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
        if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
        stopAudio();
        stopAllChannels();
        window.removeEventListener("resize", checkOrientation);
    });
</script>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />

<main>
    <div
        class="soundboard"
        class:dual={cardMode === 2}
        class:landscape={isLandscape}
    >
        <button class="back-button" on:click={goBack}> ← Indietro </button>
        <button class="select-btn" on:click={() => (showSelector = true)}
            >Seleziona</button
        >
        <button
            class="shuffle-btn"
            class:active={shuffleMode}
            on:click={() => (shuffleMode = !shuffleMode)}
            title={shuffleMode ? "Random" : "Sequenziale"}
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="28"
                height="28"
            >
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
        </button>

        {#if cardMode === 1}
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
                    src={currentMusic.image}
                    alt={getMusicName(currentMusic.key, locale)}
                />
                <div class="item-name">
                    {getMusicName(currentMusic.key, locale)}
                </div>
            </button>
        {:else}
            <div class="dual-container" class:landscape={isLandscape}>
                <div class="card-wrapper">
                    <div class="progress-container dual-progress">
                        <div
                            class="progress-bar"
                            style="width: {progressA}%"
                        ></div>
                    </div>
                    <button
                        class="item-button"
                        on:mousedown={() => {
                            if (!isTouchDevice) handlePressStartA();
                        }}
                        on:mouseup={() => {
                            if (!isTouchDevice) handlePressEndA();
                        }}
                        on:mouseleave={() => {
                            if (!isTouchDevice) handlePressEndA();
                        }}
                        on:touchstart={handleTouchStartA}
                        on:touchend={handleTouchEndA}
                        on:touchcancel={handleTouchEndA}
                    >
                        <img
                            src={itemA.image}
                            alt={getMusicName(itemA.key, locale)}
                        />
                        <div class="item-name">
                            {getMusicName(itemA.key, locale)}
                        </div>
                    </button>
                </div>
                <div class="card-wrapper">
                    <div class="progress-container dual-progress">
                        <div
                            class="progress-bar"
                            style="width: {progressB}%"
                        ></div>
                    </div>
                    <button
                        class="item-button"
                        on:mousedown={() => {
                            if (!isTouchDevice) handlePressStartB();
                        }}
                        on:mouseup={() => {
                            if (!isTouchDevice) handlePressEndB();
                        }}
                        on:mouseleave={() => {
                            if (!isTouchDevice) handlePressEndB();
                        }}
                        on:touchstart={handleTouchStartB}
                        on:touchend={handleTouchEndB}
                        on:touchcancel={handleTouchEndB}
                    >
                        <img
                            src={itemB.image}
                            alt={getMusicName(itemB.key, locale)}
                        />
                        <div class="item-name">
                            {getMusicName(itemB.key, locale)}
                        </div>
                    </button>
                </div>
            </div>
        {/if}
    </div>
</main>

{#if showSelector}
    <CardSelector
        currentCategory="music"
        currentItemId={cardMode === 1 ? currentMusic?.id : null}
        on:select={handleCardSelect}
        on:close={() => (showSelector = false)}
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
    .select-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
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
        z-index: 10;
    }
    .select-btn:hover {
        background: white;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }
    .shuffle-btn {
        position: absolute;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.4);
        border: none;
        border-radius: 15px;
        padding: 0.75rem 1.2rem;
        font-size: 1.4rem;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: all 0.2s;
        z-index: 10;
        opacity: 0.5;
    }
    .shuffle-btn.active {
        background: rgba(255, 255, 255, 0.9);
        opacity: 1;
    }
    .shuffle-btn:hover {
        transform: translateX(-50%) translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
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
        font-size: 2.5rem;
        font-weight: bold;
        color: #667eea;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        pointer-events: none;
    }
    .dual-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        flex: 1;
        margin-top: 4rem;
    }
    .dual-container.landscape {
        flex-direction: row;
    }
    .card-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }
    .dual-progress {
        height: 6%;
        margin-top: 0;
        margin-bottom: 0.5rem;
    }
    .dual-container .item-button {
        padding: 1rem;
        border-radius: 20px;
    }
    .dual-container .item-name {
        font-size: 2rem;
        bottom: 1rem;
    }
    .dual-container .item-button img {
        max-height: 70%;
    }
    @media (max-width: 768px) {
        .back-button {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
        }
        .item-name {
            font-size: 1.8rem;
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
        .dual-container {
            margin-top: 3.5rem;
        }
        .dual-container .item-name {
            font-size: 1.5rem;
            bottom: 0.5rem;
        }
    }
</style>
