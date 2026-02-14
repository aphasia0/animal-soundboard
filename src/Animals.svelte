<script>
    import { onDestroy } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { animals, getRandomAnimal } from "./animals.js";
    import { getAnimalName } from "./i18n.js";

    const dispatch = createEventDispatcher();
    const locale = "it";

    let currentAnimal = animals[0];
    let progress = 0;
    let accumulatedTime = 0;
    let isPressed = false;
    let pressStartTime = null;
    let animationFrameId = null;
    let audio = null;

    const MAX_TIME = 5000;

    function handlePressStart() {
        if (isPressed) return;

        isPressed = true;
        pressStartTime = Date.now();

        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        audio = new Audio(currentAnimal.sound);
        audio.play().catch((err) => console.log("Audio play failed:", err));

        updateProgress();
    }

    function handlePressEnd() {
        if (!isPressed) return;

        isPressed = false;

        const timePressed = Date.now() - pressStartTime;
        accumulatedTime += timePressed;

        if (audio) {
            audio.pause();
        }

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        if (accumulatedTime >= MAX_TIME) {
            nextAnimal();
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
            nextAnimal();
            return;
        }

        animationFrameId = requestAnimationFrame(updateProgress);
    }

    function nextAnimal() {
        currentAnimal = getRandomAnimal(currentAnimal.id);
        accumulatedTime = 0;
        progress = 0;

        if (audio) {
            audio.pause();
            audio = null;
        }
    }

    function handleTouchStart(e) {
        e.preventDefault();
        handlePressStart();
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        handlePressEnd();
    }

    function goBack() {
        dispatch("back");
    }

    onDestroy(() => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        if (audio) {
            audio.pause();
        }
    });
</script>

<main>
    <div class="soundboard">
        <button class="back-button" on:click={goBack}> ← Indietro </button>

        <div class="progress-container">
            <div class="progress-bar" style="width: {progress}%"></div>
        </div>

        <button
            class="animal-button"
            on:mousedown={handlePressStart}
            on:mouseup={handlePressEnd}
            on:mouseleave={handlePressEnd}
            on:touchstart={handleTouchStart}
            on:touchend={handleTouchEnd}
            on:touchcancel={handleTouchEnd}
        >
            <img
                src={currentAnimal.image}
                alt={getAnimalName(currentAnimal.key, locale)}
            />
            <div class="animal-name">
                {getAnimalName(currentAnimal.key, locale)}
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

    .animal-button {
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

    .animal-button:active {
        transform: scale(0.93);
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    }

    .animal-button img {
        max-width: 90%;
        max-height: 80%;
        object-fit: contain;
        pointer-events: none;
    }

    .animal-name {
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

        .animal-name {
            font-size: 2rem;
            bottom: 5rem;
        }

        .soundboard {
            padding: 0.5rem;
        }

        .animal-button {
            padding: 1rem;
            border-radius: 20px;
        }

        .progress-container {
            margin-top: 3.5rem;
        }
    }
</style>
