<script>
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    const commitRef = process.env.COMMIT_REF || "";
    const buildTs = new Date().toISOString();

    const commitId = commitRef;
    const buildTimestamp = buildTs 
        ? new Date(buildTs).toLocaleString("it-IT", {
            dateStyle: "medium",
            timeStyle: "short"
        }) 
        : "";

    function goBack() {
        dispatch("back");
    }
</script>

<main>
    <div class="top-nav">
        <button class="back-button" on:click={goBack} title="Indietro">
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

    <div class="info-view">
        <div class="content">
            <h1 class="title">Sound Pad</h1>
            <p class="description">
                Sound Pad è un'applicazione interattiva per giocare con suoni ed
                immagini, progettata per l'apprendimento e il divertimento.
            </p>

            {#if commitId}
            <div class="version-box">
                <div class="version-row">
                    <span class="label">Commit</span>
                    <span class="value commit">{commitId.slice(0, 7)}</span>
                </div>
                <div class="version-row">
                    <span class="label">Build</span>
                    <span class="value">{buildTimestamp}</span>
                </div>
            </div>
            {/if}

            <div class="hardware-section">
                <h2>🎮 Controller Hardware</h2>
                <p>
                    Puoi controllare Sound Pad con un controller Bluetooth fatto in casa! 
                    Usa i tasti <strong>A</strong> e <strong>Spazio</strong> per navigare le schede.
                </p>
                <img 
                    src="soundpad-hw.png" 
                    alt="Controller ESP32 con pulsanti grandi" 
                    class="hardware-image"
                />
                <p class="hardware-link">
                    Costruisci il tuo controller economico e open source!
                    <br />
                    <a href="https://github.com/aphasia0/animal-soundboard" target="_blank" rel="noopener noreferrer">
                        ➡️ Vedi il progetto su GitHub
                    </a>
                </p>
            </div>

            <div class="credit">Sviluppato (Vibecoded) con ❤️</div>
        </div>
    </div>
</main>

<style>
    main {
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .info-view {
        width: 100%;
        max-width: 600px;
        padding: 2rem;
        box-sizing: border-box;
        position: relative;
    }

    .top-nav {
        position: absolute;
        top: 1rem;
        left: 1rem;
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
    }

    .content {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        padding: 3rem 2rem;
        border-radius: 30px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        text-align: center;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    }

    .title {
        font-size: 2.5rem;
        margin: 0 0 1.5rem;
    }

    .description {
        font-size: 1.2rem;
        line-height: 1.6;
        margin-bottom: 2.5rem;
        color: rgba(255, 255, 255, 0.9);
    }

    .version-box {
        background: rgba(0, 0, 0, 0.2);
        padding: 1.5rem;
        border-radius: 20px;
        font-family: monospace;
        margin-bottom: 1.5rem;
    }

    .version-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .version-row:last-child {
        margin-bottom: 0;
    }

    .label {
        color: rgba(255, 255, 255, 0.6);
    }

    .value {
        color: white;
        font-weight: bold;
    }

    .value.commit {
        font-family: monospace;
        background: rgba(255, 255, 255, 0.15);
        padding: 0.2rem 0.5rem;
        border-radius: 5px;
    }

    .credit {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.7);
    }

    .hardware-section {
        background: rgba(0, 0, 0, 0.2);
        padding: 1.5rem;
        border-radius: 20px;
        margin-bottom: 1.5rem;
    }

    .hardware-section h2 {
        margin: 0 0 1rem;
        font-size: 1.3rem;
    }

    .hardware-section p {
        font-size: 1rem;
        line-height: 1.5;
        margin-bottom: 1rem;
        color: rgba(255, 255, 255, 0.9);
    }

    .hardware-image {
        width: 100%;
        max-width: 300px;
        border-radius: 15px;
        margin: 1rem 0;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }

    .hardware-link {
        font-size: 0.95rem;
    }

    .hardware-link a {
        color: #FFD93D;
        text-decoration: none;
        font-weight: bold;
        display: inline-block;
        margin-top: 0.5rem;
        padding: 0.5rem 1rem;
        background: rgba(255, 217, 61, 0.2);
        border-radius: 10px;
        transition: all 0.2s;
    }

    .hardware-link a:hover {
        background: rgba(255, 217, 61, 0.4);
    }
</style>
