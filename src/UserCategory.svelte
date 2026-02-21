<script>
    import { onMount, onDestroy } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { getSupabase } from "./supabaseClient.js";
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

    export let categoryId;
    export let cardMode = 1;

    const dispatch = createEventDispatcher();

    let shuffleMode = true;

    let cards = [];
    let loadingCards = true;
    let isTouchDevice = false;
    let isLandscape = false;

    // Single card state
    let currentIndex = 0;
    let progress = 0,
        accumulatedTime = 0,
        isPressed = false,
        pressStartTime = null;
    let animationFrameId = null;

    // Dual card state
    let indexA = 0,
        indexB = 1;
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

    const MAX_TIME = 5000;

    function checkOrientation() {
        isLandscape = window.innerWidth > window.innerHeight;
    }

    function getRandomIndex(excludeIdx) {
        if (cards.length <= 1) return 0;
        let idx;
        do {
            idx = Math.floor(Math.random() * cards.length);
        } while (idx === excludeIdx);
        return idx;
    }

    onMount(async () => {
        checkOrientation();
        window.addEventListener("resize", checkOrientation);
        const supabase = getSupabase();
        if (supabase) {
            const { data } = await supabase
                .from("user_cards")
                .select("*")
                .eq("category_id", categoryId)
                .order("created_at");
            cards = data || [];
            if (cards.length > 0) {
                preloadSounds(cards.map((c) => c.sound_url));
                currentIndex = 0;
                indexA = 0;
                indexB = cards.length > 1 ? 1 : 0;
            }
        }
        loadingCards = false;
    });

    // Single card handlers
    function handlePressStart() {
        if (isPressed || cards.length === 0) return;
        isPressed = true;
        pressStartTime = Date.now();
        resumeAudioContext();
        playAudio(cards[currentIndex].sound_url);
        updateProgress();
    }
    function handlePressEnd() {
        if (!isPressed) return;
        isPressed = false;
        accumulatedTime += Date.now() - pressStartTime;
        stopAudio();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (accumulatedTime >= MAX_TIME) nextCard();
        else progress = (accumulatedTime / MAX_TIME) * 100;
    }
    function updateProgress() {
        if (!isPressed) return;
        const t = accumulatedTime + (Date.now() - pressStartTime);
        progress = Math.min((t / MAX_TIME) * 100, 100);
        if (t >= MAX_TIME) {
            handlePressEnd();
            nextCard();
            return;
        }
        animationFrameId = requestAnimationFrame(updateProgress);
    }
    function nextCard() {
        if (shuffleMode) {
            currentIndex = getRandomIndex(currentIndex);
        } else {
            currentIndex = (currentIndex + 1) % cards.length;
        }
        accumulatedTime = 0;
        progress = 0;
        stopAudio();
    }

    // Dual card A
    function handlePressStartA() {
        if (isPressedA || cards.length === 0) return;
        isPressedA = true;
        pressStartTimeA = Date.now();
        resumeAudioContext();
        playAudioChannel(cards[indexA].sound_url, "cardA");
        updateProgressA();
    }
    function handlePressEndA() {
        if (!isPressedA) return;
        isPressedA = false;
        accumulatedTimeA += Date.now() - pressStartTimeA;
        stopAudioChannel("cardA");
        if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
        if (accumulatedTimeA >= MAX_TIME) nextA();
        else progressA = (accumulatedTimeA / MAX_TIME) * 100;
    }
    function updateProgressA() {
        if (!isPressedA) return;
        const t = accumulatedTimeA + (Date.now() - pressStartTimeA);
        progressA = Math.min((t / MAX_TIME) * 100, 100);
        if (t >= MAX_TIME) {
            handlePressEndA();
            nextA();
            return;
        }
        animationFrameIdA = requestAnimationFrame(updateProgressA);
    }
    function nextA() {
        if (shuffleMode) {
            indexA = getRandomIndex(indexA);
        } else {
            indexA = (indexA + 1) % cards.length;
        }
        accumulatedTimeA = 0;
        progressA = 0;
        stopAudioChannel("cardA");
    }

    // Dual card B
    function handlePressStartB() {
        if (isPressedB || cards.length === 0) return;
        isPressedB = true;
        pressStartTimeB = Date.now();
        resumeAudioContext();
        playAudioChannel(cards[indexB].sound_url, "cardB");
        updateProgressB();
    }
    function handlePressEndB() {
        if (!isPressedB) return;
        isPressedB = false;
        accumulatedTimeB += Date.now() - pressStartTimeB;
        stopAudioChannel("cardB");
        if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
        if (accumulatedTimeB >= MAX_TIME) nextB();
        else progressB = (accumulatedTimeB / MAX_TIME) * 100;
    }
    function updateProgressB() {
        if (!isPressedB) return;
        const t = accumulatedTimeB + (Date.now() - pressStartTimeB);
        progressB = Math.min((t / MAX_TIME) * 100, 100);
        if (t >= MAX_TIME) {
            handlePressEndB();
            nextB();
            return;
        }
        animationFrameIdB = requestAnimationFrame(updateProgressB);
    }
    function nextB() {
        if (shuffleMode) {
            indexB = getRandomIndex(indexB);
        } else {
            indexB = (indexB + 1) % cards.length;
        }
        accumulatedTimeB = 0;
        progressB = 0;
        stopAudioChannel("cardB");
    }

    // Touch handlers
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
    function addCard() {
        dispatch("addCard");
    }

    let showSelector = false;

    function handleCardSelect(e) {
        const { category, item, index } = e.detail;
        showSelector = false;
        dispatch("jumpTo", { category, item, index });
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
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"
                ><path
                    d="M18 9l3 3-3 3v-2h-2.17a3 3 0 0 1-2.12-.88L12 8.41 9.29 11.12A3 3 0 0 1 7.17 12H4v-2h3.17a1 1 0 0 0 .71-.29L12 5.59l4.12 4.12a1 1 0 0 0 .71.29H18V9zM4 14h3.17a3 3 0 0 1 2.12.88L12 17.59l2.71-2.71A3 3 0 0 1 16.83 14H18v-1l3 3-3 3v-2h-1.17a1 1 0 0 0-.71.29L12 21.41l-4.12-4.12A1 1 0 0 0 7.17 17H4v-3z"
                /></svg
            >
        </button>
        <button class="add-card-btn" on:click={addCard}>＋</button>

        {#if loadingCards}
            <div class="empty-state">
                <div class="emoji-big">⏳</div>
                <p>Caricamento...</p>
            </div>
        {:else if cards.length === 0}
            <div class="empty-state">
                <div class="emoji-big">📭</div>
                <p>Nessuna card ancora</p>
                <button class="add-first-btn" on:click={addCard}
                    >＋ Aggiungi la prima card</button
                >
            </div>
        {:else if cardMode === 1}
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
                    src={cards[currentIndex].image_url}
                    alt={cards[currentIndex].name}
                />
                <div class="item-name">{cards[currentIndex].name}</div>
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
                            src={cards[indexA].image_url}
                            alt={cards[indexA].name}
                        />
                        <div class="item-name">{cards[indexA].name}</div>
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
                            src={cards[indexB].image_url}
                            alt={cards[indexB].name}
                        />
                        <div class="item-name">{cards[indexB].name}</div>
                    </button>
                </div>
            </div>
        {/if}
    </div>
</main>

{#if showSelector}
    <CardSelector
        currentCategory=""
        currentItemId={null}
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
    .add-card-btn {
        position: absolute;
        bottom: 1.5rem;
        right: 1.5rem;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 2rem;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    .add-card-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
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
        border-radius: 16px;
    }
    .item-name {
        position: absolute;
        bottom: 2rem;
        font-size: 2.5rem;
        font-weight: bold;
        color: #667eea;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        pointer-events: none;
        text-align: center;
        padding: 0 1rem;
    }
    .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
    }
    .emoji-big {
        font-size: 5rem;
        margin-bottom: 1rem;
    }
    .empty-state p {
        font-size: 1.5rem;
        margin: 0 0 2rem 0;
    }
    .add-first-btn {
        background: white;
        color: #667eea;
        border: none;
        border-radius: 16px;
        padding: 1rem 2rem;
        font-size: 1.2rem;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
    }
    .add-first-btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
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
        font-size: 1.8rem;
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
            font-size: 1.4rem;
            bottom: 0.5rem;
        }
    }
</style>
