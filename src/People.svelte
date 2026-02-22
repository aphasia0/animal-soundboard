<script>
    import { onMount, onDestroy } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { people, getRandomPerson } from "./people.js";
    import { getPersonName } from "./i18n.js";
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
    preloadSounds(people.map((p) => p.sound));
    const dispatch = createEventDispatcher();
    const locale = "it";

    let shuffleMode = true;
    let seqIndex = 0;
    let seqIndexA = 0;
    let seqIndexB = 1 % people.length;

    let currentPerson = getRandomPerson();
    let progress = 0,
        accumulatedTime = 0,
        isPressed = false,
        pressStartTime = null;
    let isTouchDevice = false,
        animationFrameId = null;

    let itemA = getRandomPerson(),
        itemB = getRandomPerson(itemA.id);
    let progressA = 0,
        progressB = 0,
        accumulatedTimeA = 0,
        accumulatedTimeB = 0;
    let isPressedA = false,
        isPressedB = false;
    let pressStartTimeA = null,
        pressStartTimeB = null;
    let animationFrameIdA = null,
        animationFrameIdB = null;
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
        playAudio(currentPerson.sound);
        updateProgress();
    }
    function handlePressEnd() {
        if (!isPressed) return;
        isPressed = false;
        accumulatedTime += Date.now() - pressStartTime;
        stopAudio();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (accumulatedTime >= MAX_TIME) nextPerson();
        else progress = (accumulatedTime / MAX_TIME) * 100;
    }
    function updateProgress() {
        if (!isPressed) return;
        const t = accumulatedTime + (Date.now() - pressStartTime);
        progress = Math.min((t / MAX_TIME) * 100, 100);
        if (t >= MAX_TIME) {
            handlePressEnd();
            nextPerson();
            return;
        }
        animationFrameId = requestAnimationFrame(updateProgress);
    }
    function nextPerson() {
        if (shuffleMode) {
            currentPerson = getRandomPerson(currentPerson.id);
        } else {
            seqIndex = (seqIndex + 1) % people.length;
            currentPerson = people[seqIndex];
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
        accumulatedTimeA += Date.now() - pressStartTimeA;
        stopAudioChannel("cardA");
        if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
        if (accumulatedTimeA >= MAX_TIME) nextItemA();
        else progressA = (accumulatedTimeA / MAX_TIME) * 100;
    }
    function updateProgressA() {
        if (!isPressedA) return;
        const t = accumulatedTimeA + (Date.now() - pressStartTimeA);
        progressA = Math.min((t / MAX_TIME) * 100, 100);
        if (t >= MAX_TIME) {
            handlePressEndA();
            nextItemA();
            return;
        }
        animationFrameIdA = requestAnimationFrame(updateProgressA);
    }
    function nextItemA() {
        if (shuffleMode) {
            itemA = getRandomPerson(itemA.id);
        } else {
            seqIndexA = (seqIndexA + 1) % people.length;
            itemA = people[seqIndexA];
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
        accumulatedTimeB += Date.now() - pressStartTimeB;
        stopAudioChannel("cardB");
        if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
        if (accumulatedTimeB >= MAX_TIME) nextItemB();
        else progressB = (accumulatedTimeB / MAX_TIME) * 100;
    }
    function updateProgressB() {
        if (!isPressedB) return;
        const t = accumulatedTimeB + (Date.now() - pressStartTimeB);
        progressB = Math.min((t / MAX_TIME) * 100, 100);
        if (t >= MAX_TIME) {
            handlePressEndB();
            nextItemB();
            return;
        }
        animationFrameIdB = requestAnimationFrame(updateProgressB);
    }
    function nextItemB() {
        if (shuffleMode) {
            itemB = getRandomPerson(itemB.id);
        } else {
            seqIndexB = (seqIndexB + 1) % people.length;
            itemB = people[seqIndexB];
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
        if (category === "people") {
            currentPerson = item;
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
    <div class="soundboard">
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
                class:pressed={isPressed}
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
                    src={currentPerson.image}
                    alt={getPersonName(currentPerson.key, locale)}
                />
                <div class="item-name">
                    {getPersonName(currentPerson.key, locale)}
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
                        class:pressed={isPressedA}
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
                            alt={getPersonName(itemA.key, locale)}
                        />
                        <div class="item-name">
                            {getPersonName(itemA.key, locale)}
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
                        class:pressed={isPressedB}
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
                            alt={getPersonName(itemB.key, locale)}
                        />
                        <div class="item-name">
                            {getPersonName(itemB.key, locale)}
                        </div>
                    </button>
                </div>
            </div>
        {/if}
    </div>
</main>

{#if showSelector}
    <CardSelector
        currentCategory="people"
        currentItemId={cardMode === 1 ? currentPerson?.id : null}
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
    .back-button,
    .select-btn,
    .shuffle-btn {
        position: absolute;
        top: 1rem;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 15px;
        height: 3.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        z-index: 10;
        padding: 0 1.5rem;
        font-size: 1.1rem;
    }
    .back-button {
        left: 1rem;
    }
    .select-btn {
        right: 1rem;
    }
    .shuffle-btn {
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.4);
        padding: 0 1rem;
        opacity: 0.5;
        font-size: 1.4rem;
    }
    .back-button:hover,
    .select-btn:hover {
        background: white;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
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
            transform 0.1s ease,
            box-shadow 0.1s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        position: relative;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        outline: none;
        -webkit-tap-highlight-color: transparent;
    }
    .item-button:active,
    .item-button.pressed {
        transform: scale(0.93);
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    }
    .item-button img {
        max-width: 90%;
        max-height: 80%;
        object-fit: cover;
        border-radius: 20px;
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
        .back-button,
        .select-btn,
        .shuffle-btn {
            padding: 0 1rem;
            font-size: 0.9rem;
            height: 2.8rem;
            top: 0.75rem;
        }
        .shuffle-btn {
            font-size: 1.2rem;
            padding: 0 0.8rem;
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
        .dual-container {
            margin-top: 3.5rem;
        }
        .dual-container .item-name {
            font-size: 1.5rem;
            bottom: 0.5rem;
        }
    }
</style>
