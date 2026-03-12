<script>
    import { onMount, onDestroy } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { getSupabase } from "./supabaseClient.js";
    import CardSelector from "./CardSelector.svelte";
    import AddCardModal from "./AddCardModal.svelte";
    import { settingsStore } from "./settingsStore.js";
    import { user } from "./authStore.js";
    import {
        playAudio,
        stopAudio,
        playAudioChannel,
        stopAudioChannel,
        stopAllChannels,
        preloadSounds,
        resumeAudioContext,
        getAudioDuration,
    } from "./audioUtils.js";

    export let items = [];
    export let categoryId = null; // For custom categories
    export let categoryKey = ""; // For native categories (animals, etc.)
    export let cardMode = 1;
    export let cardNavMode = "shuffle"; // 'shuffle' | 'linear' | 'locked'
    export let isUserCategory = false;
    export let loading = false;

    const dispatch = createEventDispatcher();
    // maxTime in ms; null = infinite (no auto-advance)
    let maxTime = 5000;
    let isTouchDevice = false;
    let isLandscape = false;

    // Delete confirmation state
    let showDeleteConfirm = false;
    let cardToDelete = null;

    // FAB speed-dial state
    let showFab = false;

    // Edit modal state
    let showEditModal = false;
    let cardToEdit = null;

    function openEditCard() {
        if (items.length === 0) return;
        cardToEdit = items[currentIndex];
        showEditModal = true;
        showFab = false;
    }

    function handleEditSaved() {
        showEditModal = false;
        cardToEdit = null;
        dispatch("cardEdited");
    }

    // Single card state
    let currentIndex = 0;
    let progress = 0,
        accumulatedTime = 0,
        isPressed = false,
        pressStartTime = null;
    let animationFrameId = null;
    // Resolved max-time for the current press session (ms); null=infinite
    let activeMaxTime = null;

    // Dual card state
    let indexA = 0;
    let indexB = 1;

    // Safety check for indices when items change
    $: if (items.length > 0) {
        if (indexA >= items.length) indexA = 0;
        if (indexB >= items.length) indexB = Math.max(0, items.length - 1);
        if (currentIndex >= items.length) currentIndex = 0;
    }
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
    let activeMaxTimeA = null;
    let activeMaxTimeB = null;

    let overrideA = null;
    let overrideB = null;

    $: displayItem = items[currentIndex];
    $: displayItemA = indexA === -1 ? overrideA : items[indexA];
    $: displayItemB = indexB === -1 ? overrideB : items[indexB];

    function checkOrientation() {
        isLandscape = window.innerWidth > window.innerHeight;
    }

    function getRandomIndex(excludeIdx) {
        if (items.length <= 1) return 0;
        let idx;
        do {
            idx = Math.floor(Math.random() * items.length);
        } while (idx === excludeIdx);
        return idx;
    }

    onMount(() => {
        checkOrientation();
        window.addEventListener("resize", checkOrientation);
        isTouchDevice =
            "ontouchstart" in window || navigator.maxTouchPoints > 0;

        if (items.length > 0) {
            preloadSounds(items.map((i) => i.sound));
            resetIndices();
        }
    });

    function resetIndices() {
        if (items.length === 0) return;
        currentIndex = 0;
        indexA = 0;
        indexB = items.length > 1 ? 1 : 0;
    }

    $: if (
        items.length > 0 &&
        (currentIndex >= items.length ||
            indexA >= items.length ||
            indexB >= items.length)
    ) {
        resetIndices();
    }

    function goBack() {
        dispatch("back");
    }

    function addCard() {
        dispatch("addCard", categoryId);
    }

    let showSelector = false;
    let selectorSlot = null; // null = single mode, 'A' or 'B' for dual mode
    let showColorPicker = false;
    let showPlaybackPicker = false;

    // --- State variables (declared BEFORE subscribe to avoid TDZ) ---
    let primaryColor = "#39ff14";
    let secondaryColor = "#ff0000";
    let currentUser = null;
    let playbackMode = "restart"; // 'restart' | 'resume' | 'autoplay' | 'once'

    // Audio offset tracking for resume mode (seconds)
    let audioOffset = 0;
    let audioOffsetA = 0;
    let audioOffsetB = 0;

    user.subscribe((u) => {
        currentUser = u;
    });
    settingsStore.subscribe((s) => {
        primaryColor = s.primaryColor || "#39ff14";
        secondaryColor = s.secondaryColor || "#ff0000";
        maxTime = s.maxTimeMs !== undefined ? s.maxTimeMs : "auto";
        playbackMode = s.playbackMode || "once";
    });

    async function savePlaybackMode(mode) {
        // Clear saved offsets when leaving resume mode
        if (mode !== "resume") {
            audioOffset = 0;
            audioOffsetA = 0;
            audioOffsetB = 0;
        }
        // Stop any active autoplay
        if (playbackMode === "autoplay") {
            stopAllAutoplay();
        }
        // Singolo Click always uses sound duration — force maxTimeMs to auto
        const extra = mode === "once" ? { maxTimeMs: "auto" } : {};
        await settingsStore.updateSettings(
            { playbackMode: mode, ...extra },
            currentUser?.id,
        );
        showPlaybackPicker = false;
    }

    async function saveMaxTime(time) {
        await settingsStore.updateSettings(
            { maxTimeMs: time },
            currentUser?.id,
        );
    }

    function stopAllAutoplay() {
        if (isPressed) {
            isPressed = false;
            stopAudio();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            progress = 0;
            accumulatedTime = 0;
        }
        if (isPressedA) {
            isPressedA = false;
            stopAudioChannel("cardA");
            if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
            progressA = 0;
            accumulatedTimeA = 0;
        }
        if (isPressedB) {
            isPressedB = false;
            stopAudioChannel("cardB");
            if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
            progressB = 0;
            accumulatedTimeB = 0;
        }
    }

    function timeLabel(ms) {
        if (ms === "auto") return "Auto";
        if (ms === null) return "\u221e";
        return ms < 1000 ? ms + "ms" : ms / 1000 + "s";
    }

    /** Resolve the effective ms duration for a given sound URL. */
    function resolveMaxTime(soundSrc) {
        if (maxTime === "auto") {
            const dur = getAudioDuration(soundSrc);
            return dur > 0 ? dur * 1000 : 5000; // fallback 5s if not cached yet
        }
        return maxTime;
    }

    async function saveColors() {
        await settingsStore.updateSettings(
            { primaryColor, secondaryColor },
            currentUser?.id,
        );
        showColorPicker = false;
    }
    async function resetColors() {
        primaryColor = "#39ff14";
        secondaryColor = "#ff0000";
        await settingsStore.updateSettings(
            { primaryColor, secondaryColor },
            currentUser?.id,
        );
        showColorPicker = false;
    }

    function handleCardSelect(e) {
        const { category, item, index } = e.detail;
        showSelector = false;

        const isCurrentCat = category === (categoryId || categoryKey);

        if (selectorSlot === "A") {
            if (isCurrentCat) {
                indexA = index;
                overrideA = null;
                // Avoid clash
                if (indexB === indexA && items.length > 1) {
                    indexB = (indexA + 1) % items.length;
                    overrideB = null;
                }
            } else {
                indexA = -1;
                overrideA = item;
            }
            progressA = 0;
            accumulatedTimeA = 0;
            // Two-step flow: auto-open for B
            selectorSlot = "B";
            showSelector = true;
            return;
        } else if (selectorSlot === "B") {
            if (isCurrentCat) {
                indexB = index;
                overrideB = null;
                // Avoid clash
                if (indexA === indexB && items.length > 1) {
                    indexA = (indexB + 1) % items.length;
                    overrideA = null;
                }
            } else {
                indexB = -1;
                overrideB = item;
            }
            progressB = 0;
            accumulatedTimeB = 0;
        } else {
            // Single card mode
            if (isCurrentCat) {
                currentIndex = index;
                indexA = 0; // Ensure we are not in a dual-mode state
                progress = 0;
                accumulatedTime = 0;
            } else {
                // In single mode we still prefer jumping to the new category
                dispatch("jumpTo", { category, item, index });
            }
        }
        selectorSlot = null;
    }

    function openSelectorForSlot(slot) {
        selectorSlot = slot;
        showSelector = true;
    }

    function confirmDeleteCard() {
        if (!cardToDelete) return;
        dispatch("deleteCard", { card: cardToDelete });
        showDeleteConfirm = false;
        cardToDelete = null;
    }

    // ─── Single card ───────────────────────────────────────────────────────────
    async function handlePressStart() {
        const currentItem = displayItem;
        if (!currentItem) return;

        // If item has no sound (e.g. story covers), treat press as navigation
        if (!currentItem.sound) {
            dispatch("jumpTo", {
                category: categoryId || categoryKey,
                item: currentItem,
                index: currentIndex,
            });
            return;
        }

        if (playbackMode === "autoplay") {
            if (isPressed) {
                isPressed = false;
                stopAudio();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                progress = 0;
                accumulatedTime = 0;
                return;
            }
            isPressed = true;
            pressStartTime = Date.now();
            accumulatedTime = 0;
            resumeAudioContext();
            await playAudio(currentItem.sound, 0);
            activeMaxTime = resolveMaxTime(currentItem.sound);
            updateProgress();
            return;
        }

        if (playbackMode === "once") {
            if (isPressed) {
                isPressed = false;
                stopAudio();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                progress = 0;
                accumulatedTime = 0;
                return;
            }
            isPressed = true;
            pressStartTime = Date.now();
            accumulatedTime = 0;
            resumeAudioContext();
            await playAudio(currentItem.sound, 0, false); // No loop
            activeMaxTime = resolveMaxTime(currentItem.sound);
            updateProgress();
            return;
        }

        if (isPressed) return;
        isPressed = true;
        pressStartTime = Date.now();
        resumeAudioContext();
        await playAudio(
            currentItem.sound,
            playbackMode === "resume" ? audioOffset : 0,
        );
        activeMaxTime = resolveMaxTime(currentItem.sound);
        updateProgress();
    }
    function handlePressEnd() {
        if (!isPressed) return;
        if (playbackMode === "autoplay" || playbackMode === "once") return; // autoplay/once ignores release
        isPressed = false;
        accumulatedTime += Date.now() - pressStartTime;
        const offset = stopAudio();
        if (playbackMode === "resume") audioOffset = offset;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (activeMaxTime !== null && accumulatedTime >= activeMaxTime) next();
        else if (activeMaxTime !== null)
            progress = (accumulatedTime / activeMaxTime) * 100;
    }
    function updateProgress() {
        if (!isPressed) return;
        const currentItem = displayItem;
        const t = accumulatedTime + (Date.now() - pressStartTime);
        if (activeMaxTime === null) {
            animationFrameId = requestAnimationFrame(updateProgress);
            return;
        }
        progress = Math.min((t / activeMaxTime) * 100, 100);
        if (t >= activeMaxTime) {
            if (playbackMode === "autoplay") {
                // Auto-advance without stopping
                accumulatedTime = 0;
                pressStartTime = Date.now();
                progress = 0;
                stopAudio();
                next();
                activeMaxTime = resolveMaxTime(displayItem.sound);
                resumeAudioContext();
                playAudio(displayItem.sound, 0);
                animationFrameId = requestAnimationFrame(updateProgress);
            } else if (playbackMode === "once") {
                // One-shot playback completed - advance to next card if not locked
                isPressed = false;
                stopAudio();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                progress = 100;
                accumulatedTime = activeMaxTime;
                if (cardNavMode !== "locked") {
                    next();
                }
            } else {
                handlePressEnd();
            }
        } else {
            animationFrameId = requestAnimationFrame(updateProgress);
        }
    }
    function next() {
        progress = 0;
        accumulatedTime = 0;
        audioOffset = 0;
        if (cardNavMode === "locked") {
            // locked: stay on same card, just reset progress
            return;
        }

        if (cardNavMode === "shuffle")
            currentIndex = getRandomIndex(currentIndex);
        else currentIndex = (currentIndex + 1) % items.length;
    }

    // ─── Dual card A ───────────────────────────────────────────────────────────
    async function handlePressStartA() {
        const currentItem = displayItemA;
        if (!currentItem) return;

        if (playbackMode === "autoplay") {
            if (isPressedA) {
                isPressedA = false;
                stopAudioChannel("cardA");
                if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
                progressA = 0;
                accumulatedTimeA = 0;
                return;
            }
            isPressedA = true;
            pressStartTimeA = Date.now();
            accumulatedTimeA = 0;
            resumeAudioContext();
            await playAudioChannel(currentItem.sound, "cardA", 0);
            activeMaxTimeA = resolveMaxTime(currentItem.sound);
            updateProgressA();
            return;
        }

        if (playbackMode === "once") {
            if (isPressedA) {
                isPressedA = false;
                stopAudioChannel("cardA");
                if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
                progressA = 0;
                accumulatedTimeA = 0;
                return;
            }
            isPressedA = true;
            pressStartTimeA = Date.now();
            accumulatedTimeA = 0;
            resumeAudioContext();
            await playAudioChannel(currentItem.sound, "cardA", 0, false);
            activeMaxTimeA = resolveMaxTime(currentItem.sound);
            updateProgressA();
            return;
        }

        if (isPressedA) return;
        isPressedA = true;
        pressStartTimeA = Date.now();
        resumeAudioContext();
        await playAudioChannel(
            currentItem.sound,
            "cardA",
            playbackMode === "resume" ? audioOffsetA : 0,
        );
        activeMaxTimeA = resolveMaxTime(currentItem.sound);
        updateProgressA();
    }
    function handlePressEndA() {
        if (!isPressedA) return;
        if (playbackMode === "autoplay" || playbackMode === "once") return;
        isPressedA = false;
        accumulatedTimeA += Date.now() - pressStartTimeA;
        const offset = stopAudioChannel("cardA");
        if (playbackMode === "resume") audioOffsetA = offset;
        if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
        if (activeMaxTimeA !== null && accumulatedTimeA >= activeMaxTimeA)
            nextA();
        else if (activeMaxTimeA !== null)
            progressA = (accumulatedTimeA / activeMaxTimeA) * 100;
    }
    function updateProgressA() {
        if (!isPressedA) return;
        const t = accumulatedTimeA + (Date.now() - pressStartTimeA);
        if (activeMaxTimeA === null) {
            animationFrameIdA = requestAnimationFrame(updateProgressA);
            return;
        }
        progressA = Math.min((t / activeMaxTimeA) * 100, 100);
        if (t >= activeMaxTimeA) {
            if (playbackMode === "autoplay") {
                accumulatedTimeA = 0;
                pressStartTimeA = Date.now();
                progressA = 0;
                stopAudioChannel("cardA");
                nextA();
                audioOffsetA = 0;
                activeMaxTimeA = resolveMaxTime(displayItemA.sound);
                resumeAudioContext();
                playAudioChannel(displayItemA.sound, "cardA", 0);
                animationFrameIdA = requestAnimationFrame(updateProgressA);
            } else if (playbackMode === "once") {
                isPressedA = false;
                stopAudioChannel("cardA");
                if (animationFrameIdA) cancelAnimationFrame(animationFrameIdA);
                progressA = 100;
                accumulatedTimeA = activeMaxTimeA;
                if (cardNavMode !== "locked") {
                    nextA();
                }
            } else {
                handlePressEndA();
            }
        } else {
            animationFrameIdA = requestAnimationFrame(updateProgressA);
        }
    }
    function nextA() {
        progressA = 0;
        accumulatedTimeA = 0;
        audioOffsetA = 0;
        if (cardNavMode === "locked") return; // stay on same card
        overrideA = null;
        if (cardNavMode === "shuffle") indexA = getRandomIndex(indexA);
        else indexA = (indexA + 1) % items.length;
    }

    // ─── Dual card B ───────────────────────────────────────────────────────────
    async function handlePressStartB() {
        const currentItem = displayItemB;
        if (!currentItem) return;

        if (playbackMode === "autoplay") {
            if (isPressedB) {
                isPressedB = false;
                stopAudioChannel("cardB");
                if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
                progressB = 0;
                accumulatedTimeB = 0;
                return;
            }
            isPressedB = true;
            pressStartTimeB = Date.now();
            accumulatedTimeB = 0;
            resumeAudioContext();
            await playAudioChannel(currentItem.sound, "cardB", 0);
            activeMaxTimeB = resolveMaxTime(currentItem.sound);
            updateProgressB();
            return;
        }

        if (playbackMode === "once") {
            if (isPressedB) {
                isPressedB = false;
                stopAudioChannel("cardB");
                if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
                progressB = 0;
                accumulatedTimeB = 0;
                return;
            }
            isPressedB = true;
            pressStartTimeB = Date.now();
            accumulatedTimeB = 0;
            resumeAudioContext();
            await playAudioChannel(currentItem.sound, "cardB", 0, false);
            activeMaxTimeB = resolveMaxTime(currentItem.sound);
            updateProgressB();
            return;
        }

        if (isPressedB) return;
        isPressedB = true;
        pressStartTimeB = Date.now();
        resumeAudioContext();
        await playAudioChannel(
            currentItem.sound,
            "cardB",
            playbackMode === "resume" ? audioOffsetB : 0,
        );
        activeMaxTimeB = resolveMaxTime(currentItem.sound);
        updateProgressB();
    }
    function handlePressEndB() {
        if (!isPressedB) return;
        if (playbackMode === "autoplay" || playbackMode === "once") return;
        isPressedB = false;
        accumulatedTimeB += Date.now() - pressStartTimeB;
        const offset = stopAudioChannel("cardB");
        if (playbackMode === "resume") audioOffsetB = offset;
        if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
        if (activeMaxTimeB !== null && accumulatedTimeB >= activeMaxTimeB)
            nextB();
        else if (activeMaxTimeB !== null)
            progressB = (accumulatedTimeB / activeMaxTimeB) * 100;
    }
    function updateProgressB() {
        if (!isPressedB) return;
        const t = accumulatedTimeB + (Date.now() - pressStartTimeB);
        if (activeMaxTimeB === null) {
            animationFrameIdB = requestAnimationFrame(updateProgressB);
            return;
        }
        progressB = Math.min((t / activeMaxTimeB) * 100, 100);
        if (t >= activeMaxTimeB) {
            if (playbackMode === "autoplay") {
                accumulatedTimeB = 0;
                pressStartTimeB = Date.now();
                progressB = 0;
                stopAudioChannel("cardB");
                nextB();
                audioOffsetB = 0;
                activeMaxTimeB = resolveMaxTime(displayItemB.sound);
                resumeAudioContext();
                playAudioChannel(displayItemB.sound, "cardB", 0);
                animationFrameIdB = requestAnimationFrame(updateProgressB);
            } else if (playbackMode === "once") {
                isPressedB = false;
                stopAudioChannel("cardB");
                if (animationFrameIdB) cancelAnimationFrame(animationFrameIdB);
                progressB = 100;
                accumulatedTimeB = activeMaxTimeB;
                if (cardNavMode !== "locked") {
                    nextB();
                }
            } else {
                handlePressEndB();
            }
        } else {
            animationFrameIdB = requestAnimationFrame(updateProgressB);
        }
    }
    function nextB() {
        progressB = 0;
        accumulatedTimeB = 0;
        audioOffsetB = 0;
        if (cardNavMode === "locked") return; // stay on same card
        overrideB = null;
        if (cardNavMode === "shuffle") indexB = getRandomIndex(indexB);
        else indexB = (indexB + 1) % items.length;
    }

    // Keyboard support
    async function handleKeyDown(e) {
        if (e.repeat) return;
        if (cardMode === 1) {
            if (e.code === "Space" || e.code === "KeyA")
                await handlePressStart();
        } else {
            if (e.code === "KeyA") await handlePressStartA();
            if (e.code === "Space") await handlePressStartB();
        }
    }
    function handleKeyUp(e) {
        if (cardMode === 1) {
            if (e.code === "Space" || e.code === "KeyA") handlePressEnd();
        } else {
            if (e.code === "KeyA") handlePressEndA();
            if (e.code === "Space") handlePressEndB();
        }
    }

    // Touch events
    async function handleTouchStart(e) {
        e.preventDefault();
        await handlePressStart();
    }
    function handleTouchEnd(e) {
        e.preventDefault();
        handlePressEnd();
    }
    async function handleTouchStartA(e) {
        e.preventDefault();
        await handlePressStartA();
    }
    function handleTouchEndA(e) {
        e.preventDefault();
        handlePressEndA();
    }
    async function handleTouchStartB(e) {
        e.preventDefault();
        await handlePressStartB();
    }
    function handleTouchEndB(e) {
        e.preventDefault();
        handlePressEndB();
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

<main
    style="--primary-color:{primaryColor}; --secondary-color:{secondaryColor};"
>
    <div class="soundboard">
        <div class="center-btns">
            <!-- Back Button (Icon Only) -->
            <button
                class="palette-btn"
                on:click={goBack}
                title="Indietro"
                data-tooltip="Indietro"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    width="26"
                    height="26"
                >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
            </button>
            <!-- 3-state nav button: shuffle → linear → locked → shuffle -->
            <button
                    class="shuffle-btn"
                    class:nav-linear={cardNavMode === "linear"}
                    class:nav-locked={cardNavMode === "locked"}
                    class:active={cardNavMode !== "linear"}
                    on:click={() => {
                        const next =
                            cardNavMode === "shuffle"
                                ? "linear"
                                : cardNavMode === "linear"
                                  ? "locked"
                                  : "shuffle";
                        dispatch("setNavMode", next);
                    }}
                    title={cardNavMode === "shuffle"
                        ? "Casuale"
                        : cardNavMode === "linear"
                          ? "Lineare"
                          : "Bloccato"}
                    data-tooltip={cardNavMode === "shuffle"
                        ? "Ordine: Casuale"
                        : cardNavMode === "linear"
                          ? "Ordine: Lineare"
                          : "Ordine: Bloccato"}
                >
                    {#if cardNavMode === "shuffle"}
                        <!-- Shuffle icon -->
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
                    {:else if cardNavMode === "linear"}
                        <!-- Right-arrow icon (linear) -->
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
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                    {:else}
                        <!-- Padlock icon (locked) -->
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
                            <rect
                                x="3"
                                y="11"
                                width="18"
                                height="11"
                                rx="2"
                                ry="2"
                            />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    {/if}
                </button>

            <!-- Palette / Color Picker button -->
            <button
                class="palette-btn"
                on:click={() => (showColorPicker = !showColorPicker)}
                title="Colori card"
                data-tooltip="Colori card"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    width="26"
                    height="26"
                >
                    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                    <path
                        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
                    />
                </svg>
            </button>

            <!-- Playback Mode button -->
            <button
                class="palette-btn"
                class:playback-autoplay={playbackMode === "autoplay" ||
                    playbackMode === "autoplay_loop"}
                class:playback-resume={playbackMode === "resume"}
                class:playback-restart={playbackMode === "restart"}
                on:click={() => (showPlaybackPicker = !showPlaybackPicker)}
                title="Modalità riproduzione"
                data-tooltip="Modalità riproduzione"
            >
                <!-- Play-settings icon -->
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    width="26"
                    height="26"
                >
                    <polygon
                        points="5 3 19 12 5 21 5 3"
                        fill="currentColor"
                        opacity="0.15"
                    />
                    <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
            </button>

            <!-- Card Selector (Icon Only) -->
            <button
                class="palette-btn"
                on:click={() =>
                    openSelectorForSlot(cardMode === 1 ? null : "A")}
                title="Seleziona card"
                data-tooltip="Seleziona card"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    width="26"
                    height="26"
                >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                </svg>
            </button>
        </div>

        {#if showColorPicker}
            <div class="color-picker-popup">
                <div class="color-picker-title">🎨 Colori Card</div>
                <div class="color-row">
                    <label for="color-primary">Principale</label>
                    <input
                        id="color-primary"
                        type="color"
                        bind:value={primaryColor}
                    />
                    <span
                        class="color-preview"
                        style="background:{primaryColor}"
                    ></span>
                </div>
                <div class="color-row">
                    <label for="color-secondary">Secondaria</label>
                    <input
                        id="color-secondary"
                        type="color"
                        bind:value={secondaryColor}
                    />
                    <span
                        class="color-preview"
                        style="background:{secondaryColor}"
                    ></span>
                </div>
                <div class="color-actions">
                    <button class="color-reset" on:click={resetColors}
                        >Predefinito</button
                    >
                    <button
                        class="color-cancel"
                        on:click={() => (showColorPicker = false)}
                        >Annulla</button
                    >
                    <button class="color-save" on:click={saveColors}
                        >Salva</button
                    >
                </div>
            </div>
        {/if}

        {#if showPlaybackPicker}
            <div class="color-picker-popup" style="min-width:300px">
                <div class="color-picker-title">▶ Modalità Gioco</div>
                <div class="playback-options">
                    <button
                        class="playback-opt-btn"
                        class:active={playbackMode === "once"}
                        on:click={() => savePlaybackMode("once")}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            width="24"
                            height="24"
                            ><polygon points="5 3 19 12 5 21 5 3" /></svg
                        >
                        <div>
                            <strong>Singolo Click</strong><br /><small
                                >Suona una volta sola</small
                            >
                        </div>
                    </button>

                    <button
                        class="playback-opt-btn"
                        class:active={playbackMode === "restart"}
                        on:click={() => savePlaybackMode("restart")}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            width="24"
                            height="24"
                            ><polyline points="1 4 1 10 7 10" /><path
                                d="M3.51 15a9 9 0 1 0 .49-4.5"
                            /></svg
                        >
                        <div>
                            <strong>Ricomincia</strong><br /><small
                                >Ogni click riparte dall'inizio</small
                            >
                        </div>
                    </button>
                    <button
                        class="playback-opt-btn"
                        class:active={playbackMode === "resume"}
                        on:click={() => savePlaybackMode("resume")}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            width="24"
                            height="24"
                            ><rect x="6" y="4" width="4" height="16" /><rect
                                x="14"
                                y="4"
                                width="4"
                                height="16"
                            /></svg
                        >
                        <div>
                            <strong>Riprendi</strong><br /><small
                                >Pausa/riprendi da dove era</small
                            >
                        </div>
                    </button>
                    <button
                        class="playback-opt-btn"
                        class:active={playbackMode === "autoplay"}
                        on:click={() => savePlaybackMode("autoplay")}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            width="24"
                            height="24"
                            ><polyline points="17 1 21 5 17 9" /><path
                                d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"
                            /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg
                        >
                        <div>
                            <strong>Autoplay</strong><br /><small
                                >Un click, scorre da solo</small
                            >
                        </div>
                    </button>
                </div>

                <div class="time-options">
                    <div class="time-label">Tempo max:</div>
                    <div class="time-buttons">
                        {#if playbackMode === "once"}
                            <button class="time-btn active">auto</button>
                        {:else}
                            <button
                                class="time-btn"
                                class:active={maxTime === 3000}
                                on:click={() => saveMaxTime(3000)}>3s</button
                            >
                            <button
                                class="time-btn"
                                class:active={maxTime === 5000}
                                on:click={() => saveMaxTime(5000)}>5s</button
                            >
                            <button
                                class="time-btn"
                                class:active={maxTime === 10000}
                                on:click={() => saveMaxTime(10000)}>10s</button
                            >
                            <button
                                class="time-btn"
                                class:active={maxTime === 30000}
                                on:click={() => saveMaxTime(30000)}>30s</button
                            >
                            <button
                                class="time-btn"
                                class:active={maxTime === "auto"}
                                on:click={() => saveMaxTime("auto")}>auto</button
                            >
                        {/if}
                    </div>
                </div>

                <button
                    class="color-cancel"
                    style="width:100%;margin-top:0.75rem"
                    on:click={() => (showPlaybackPicker = false)}>Chiudi</button
                >
            </div>
        {/if}

        {#if isUserCategory}
            <!-- FAB: gear button + speed-dial -->
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="fab-container">
                {#if showFab}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <div
                        class="fab-backdrop"
                        on:click={() => (showFab = false)}
                    ></div>
                    <div class="fab-dial">
                        <!-- Add -->
                        <button
                            class="fab-action fab-add"
                            title="Aggiungi card"
                            data-tooltip="Aggiungi card"
                            on:click={() => {
                                showFab = false;
                                addCard();
                            }}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="22"
                                height="22"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>
                        <!-- Delete (only when a card is visible and in single mode) -->
                        {#if items.length > 0 && cardMode === 1}
                            <button
                                class="fab-action fab-delete"
                                title="Elimina card"
                                data-tooltip="Elimina card"
                                on:click={() => {
                                    showFab = false;
                                    cardToDelete = items[currentIndex];
                                    showDeleteConfirm = true;
                                }}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    width="22"
                                    height="22"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path
                                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                    />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>
                            <!-- Edit -->
                            <button
                                class="fab-action fab-edit"
                                title="Modifica card"
                                data-tooltip="Modifica card"
                                on:click={openEditCard}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    width="22"
                                    height="22"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                    />
                                    <path
                                        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                    />
                                </svg>
                            </button>
                        {/if}
                    </div>
                {/if}
                <!-- Main FAB —gear icon -->
                <button
                    class="fab-main"
                    class:fab-open={showFab}
                    title="Opzioni"
                    data-tooltip="Opzioni"
                    on:click={() => (showFab = !showFab)}
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="26"
                        height="26"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="12" r="3" />
                        <path
                            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                        />
                    </svg>
                </button>
            </div>
        {/if}

        {#if loading}
            <div class="empty-state">
                <div class="emoji-big">⏳</div>
                <p>Caricamento...</p>
            </div>
        {:else if items.length === 0}
            <div class="empty-state">
                <div class="emoji-big">📭</div>
                <p>Nessuna card ancora</p>
                {#if isUserCategory}
                    <button class="add-first-btn" on:click={addCard}
                        >＋ Aggiungi la prima card</button
                    >
                {/if}
            </div>
        {:else if cardMode === 1}
            <div
                class="progress-container primary"
                class:infinite={maxTime === null}
            >
                <div class="progress-bar" style="width: {progress}%"></div>
            </div>
            <button
                class="item-button primary"
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
                    src={displayItem.image}
                    alt={displayItem.name}
                    class:rounded={!displayItem.image?.endsWith(".svg")}
                />
                <div class="item-name">{displayItem.name}</div>
            </button>
        {:else}
            <div class="dual-container" class:landscape={isLandscape}>
                <div class="card-wrapper">
                    <div
                        class="progress-container dual-progress primary"
                        class:infinite={maxTime === null}
                    >
                        <div
                            class="progress-bar"
                            style="width: {progressA}%"
                        ></div>
                    </div>
                    <button
                        class="item-button primary"
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
                            src={displayItemA.image}
                            alt={displayItemA.name}
                            class:rounded={!displayItemA.image?.endsWith(
                                ".svg",
                            )}
                        />
                        <div class="item-name">{displayItemA.name}</div>
                    </button>
                </div>
                <div class="card-wrapper">
                    <div
                        class="progress-container dual-progress secondary"
                        class:infinite={maxTime === null}
                    >
                        <div
                            class="progress-bar"
                            style="width: {progressB}%"
                        ></div>
                    </div>
                    <button
                        class="item-button secondary"
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
                            src={displayItemB.image}
                            alt={displayItemB.name}
                            class:rounded={!displayItemB.image?.endsWith(
                                ".svg",
                            )}
                        />
                        <div class="item-name">{displayItemB.name}</div>
                    </button>
                </div>
            </div>
        {/if}
    </div>

    {#if showSelector}
        <CardSelector
            on:select={handleCardSelect}
            on:close={() => {
                showSelector = false;
                selectorSlot = null;
            }}
            currentCategory={categoryId || categoryKey}
            currentItemId={selectorSlot === "A"
                ? items[indexA]?.id
                : selectorSlot === "B"
                  ? items[indexB]?.id
                  : items[currentIndex]?.id}
            slot={selectorSlot}
        />
    {/if}

    {#if showDeleteConfirm && cardToDelete}
        <div class="overlay">
            <div class="modal">
                <h3>
                    Sei sicuro di voler cancellare la card "{cardToDelete.name}"?
                </h3>
                <div class="modal-actions">
                    <button
                        class="cancel-btn"
                        on:click={() => {
                            showDeleteConfirm = false;
                            cardToDelete = null;
                        }}>Annulla</button
                    >
                    <button class="confirm-btn" on:click={confirmDeleteCard}
                        >Sì, cancella</button
                    >
                </div>
            </div>
        </div>
    {/if}

    {#if showEditModal && cardToEdit}
        <AddCardModal
            {categoryId}
            editCard={cardToEdit}
            on:saved={handleEditSaved}
            on:close={() => {
                showEditModal = false;
                cardToEdit = null;
            }}
        />
    {/if}
</main>

<style>
    main {
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow: hidden;
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
    /* Back button is now a palette-btn inside center-btns */
    /* Centered flex container for shuffle + palette buttons */
    .center-btns {
        position: absolute;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        z-index: 10;
    }
    .shuffle-btn {
        background: rgba(255, 255, 255, 0.4);
        border: none;
        border-radius: 15px;
        height: 3.2rem;
        width: 3.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        opacity: 0.5;
    }
    .shuffle-btn.active {
        background: rgba(255, 255, 255, 0.9);
        opacity: 1;
    }
    .shuffle-btn.nav-linear {
        background: rgba(255, 255, 255, 0.9);
        color: #f59e0b; /* amber for linear */
        opacity: 1;
    }
    .shuffle-btn.nav-locked {
        background: rgba(255, 255, 255, 0.9);
        color: #ef4444; /* red for locked */
        opacity: 1;
    }
    /* Palette button — sits next to shuffle inside .center-btns */
    .palette-btn {
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 15px;
        height: 3.2rem;
        width: 3.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #667eea;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        opacity: 1;
    }
    .palette-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        filter: brightness(1.08);
    }
    /* Color picker popup */
    .color-picker-popup {
        position: absolute;
        top: 5rem;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        border-radius: 20px;
        padding: 1.5rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 100;
        min-width: 260px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .color-picker-title {
        font-size: 1.1rem;
        font-weight: bold;
        color: #1a1a1a;
        text-align: center;
    }
    .color-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .color-row label {
        flex: 1;
        font-size: 0.95rem;
        font-weight: 600;
        color: #444;
    }
    .color-row input[type="color"] {
        width: 44px;
        height: 36px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        padding: 2px;
        background: none;
    }
    .color-preview {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #e2e8f0;
        flex-shrink: 0;
    }
    .color-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 0.5rem;
    }
    .color-cancel,
    .color-save,
    .color-reset {
        flex: 1;
        padding: 0.6rem;
        border: none;
        border-radius: 12px;
        font-size: 0.95rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
    }
    .color-reset {
        background: #fff3cd;
        color: #856404;
        border: 1px solid #ffc107;
    }
    .color-reset:hover {
        background: #ffe08a;
    }
    .color-cancel {
        background: #f1f5f9;
        color: #475569;
    }
    .color-save {
        background: #667eea;
        color: white;
    }
    .color-save:hover {
        background: #5a6fd6;
    }

    /* Playback button states */
    .palette-btn.playback-autoplay {
        background: #10b981; /* green — actively running story mode */
        color: white;
    }
    .palette-btn.playback-resume {
        background: #f59e0b; /* amber — resume/pause mode */
        color: white;
    }
    .palette-btn.playback-restart {
        background: #d99ea1; /* yellow/amber — restart mode */
        color: white;
    }
    /* Playback mode popup options */
    .playback-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .playback-opt-btn {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.65rem 0.75rem;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        background: #f8fafc;
        color: #334155;
        font-size: 0.9rem;
        cursor: pointer;
        text-align: left;
        transition: all 0.18s;
    }
    .playback-opt-btn:hover {
        border-color: #667eea;
        background: #eef2ff;
    }
    .playback-opt-btn.active {
        border-color: #667eea;
        background: #667eea;
        color: white;
    }
    .playback-opt-btn svg {
        flex-shrink: 0;
    }
    .playback-opt-btn small {
        opacity: 0.75;
        font-size: 0.78rem;
    }
    .playback-opt-btn.active small {
        opacity: 0.9;
    }
    .time-options {
        margin-top: 1rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e2e8f0;
    }
    .time-label {
        font-size: 0.85rem;
        color: #64748b;
        margin-bottom: 0.5rem;
        font-weight: 500;
    }
    .time-buttons {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
    }
    .time-btn {
        flex: 1;
        min-width: 50px;
        padding: 0.5rem 0.25rem;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
        color: #334155;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s;
    }
    .time-btn:hover {
        border-color: #667eea;
        background: #eef2ff;
    }
    .time-btn.active {
        border-color: #667eea;
        background: #667eea;
        color: white;
    }
    /* Infinite mode: pulsing progress bar */
    @keyframes infinitePulse {
        0% {
            background-position: 0% 50%;
            opacity: 0.7;
        }
        50% {
            background-position: 100% 50%;
            opacity: 1;
        }
        100% {
            background-position: 0% 50%;
            opacity: 0.7;
        }
    }
    .progress-container.infinite .progress-bar {
        width: 100% !important;
        background: linear-gradient(270deg, #a855f7, #667eea, #38bdf8, #4ade80);
        background-size: 300% 300%;
        animation: infinitePulse 2s ease infinite;
        box-shadow: none;
    }

    .shuffle-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
    }
    /* ── FAB Speed-dial ─────────────────────────────── */
    .fab-container {
        position: fixed;
        bottom: calc(1.5rem + env(safe-area-inset-bottom));
        right: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.55rem;
        z-index: 200;
    }
    .fab-backdrop {
        position: fixed;
        inset: 0;
        z-index: 190;
    }
    .fab-dial {
        display: flex;
        flex-direction: column-reverse;
        align-items: center;
        gap: 0.55rem;
        margin-bottom: 0.4rem;
        z-index: 200;
    }
    .fab-main {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.95);
        color: #667eea;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
        transition:
            transform 0.25s ease,
            box-shadow 0.2s;
        z-index: 200;
    }
    .fab-main.fab-open {
        transform: rotate(90deg);
        background: #667eea;
        color: white;
    }
    .fab-main:active {
        transform: scale(0.93);
    }
    .fab-action {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
        transition:
            transform 0.15s,
            box-shadow 0.15s;
        animation: fabIn 0.2s ease both;
    }
    .fab-action:active {
        transform: scale(0.9);
    }
    @keyframes fabIn {
        from {
            opacity: 0;
            transform: translateY(10px) scale(0.85);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    .fab-add {
        background: #4ade80;
        color: white;
    }
    .fab-delete {
        background: #ef4444;
        color: white;
    }
    .fab-edit {
        background: #f59e0b;
        color: white;
    }
    .progress-container {
        height: 8%;
        background-color: rgba(255, 255, 255, 0.3);
        border-radius: 20px;
        overflow: hidden;
        margin-bottom: 1rem;
        margin-top: 4.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .progress-bar {
        height: 100%;
        background: linear-gradient(
            90deg,
            #4ade80 0%,
            #22c55e 100%
        ); /* default */
        transition: width 0.1s linear;
        border-radius: 20px;
        box-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
    }
    /* Green loader for primary (single card / card A) */
    .progress-container.primary .progress-bar {
        background: var(--primary-color, #39ff14);
        box-shadow: 0 0 20px rgba(57, 255, 20, 0.6);
    }
    /* Red loader for secondary (card B) */
    .progress-container.secondary .progress-bar {
        background: var(--secondary-color, #ff0000);
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
    }
    .item-button {
        flex: 1;
        width: 100%;
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
    /* Shocking Green border for single card and first dual card */
    .item-button.primary {
        border: 14px solid var(--primary-color, #39ff14);
    }
    /* Shocking Red border for second dual card */
    .item-button.secondary {
        border: 14px solid var(--secondary-color, #ff0000);
    }
    .item-button:active,
    .item-button.pressed {
        transform: scale(0.93);
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    }
    /* Always perfectly circular images — works for SVG animals and uploaded user photos */
    .item-button img {
        width: min(50vmin, 220px);
        height: min(50vmin, 220px);
        object-fit: contain;
        pointer-events: none;
        margin-bottom: 2rem;
        flex-shrink: 0;
    }
    /* Only round custom (non-SVG) uploaded photos */
    .item-button img.rounded {
        border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    }
    .item-name {
        position: absolute;
        bottom: 2rem;
        font-size: 3rem;
        font-weight: bold;
        color: #667eea;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        pointer-events: none;
        text-align: center;
        width: 90%;
    }
    .dual-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        flex: 1;
        margin-top: 4.5rem;
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
    .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        gap: 1rem;
    }
    .emoji-big {
        font-size: 5rem;
    }
    .add-first-btn {
        padding: 1rem 2rem;
        background: #4ade80;
        color: white;
        border: none;
        border-radius: 30px;
        font-size: 1.2rem;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    .modal {
        background: white;
        padding: 2rem;
        border-radius: 24px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        text-align: center;
    }
    .cancel-btn,
    .confirm-btn {
        flex: 1;
        padding: 0.75rem;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
    }
    .modal-actions {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
    }
    .cancel-btn {
        background: #f1f5f9;
        color: #475569;
    }
    .confirm-btn {
        background: #ef4444;
        color: white;
    }

    @media (max-width: 768px) {
        .shuffle-btn,
        .palette-btn {
            padding: 0;
            width: 2.8rem;
            height: 2.8rem;
        }
        .shuffle-btn {
            font-size: 1.2rem;
        }
        .item-name {
            font-size: 2rem;
            bottom: calc(1rem + env(safe-area-inset-bottom));
        }
        .dual-container .item-name {
            font-size: 1.5rem;
            bottom: calc(0.5rem + env(safe-area-inset-bottom));
        }
        .progress-container,
        .dual-container {
            margin-top: 4rem;
        }
    }
</style>
