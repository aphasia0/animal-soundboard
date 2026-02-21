<script>
    import { createEventDispatcher } from "svelte";
    import { getSupabase } from "./supabaseClient.js";
    import { user } from "./authStore.js";

    const dispatch = createEventDispatcher();

    export let categoryId;

    let name = "";
    let imageFile = null;
    let imagePreview = null;
    let loading = false;
    let error = "";

    // Mic recording state
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let recordedBlob = null;
    let recordedUrl = null;
    let recordingTime = 0;
    let recordingInterval = null;

    let currentUser;
    user.subscribe((v) => (currentUser = v));

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        imageFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => (imagePreview = ev.target.result);
        reader.readAsDataURL(file);
    }

    async function startRecording() {
        error = "";
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                recordedBlob = new Blob(audioChunks, { type: "audio/webm" });
                recordedUrl = URL.createObjectURL(recordedBlob);
                stream.getTracks().forEach((t) => t.stop());
                clearInterval(recordingInterval);
            };

            mediaRecorder.start();
            isRecording = true;
            recordingTime = 0;
            recordingInterval = setInterval(() => {
                recordingTime += 1;
            }, 1000);
        } catch (err) {
            error = "Permesso microfono negato";
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            isRecording = false;
        }
    }

    function removeRecording() {
        recordedBlob = null;
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        recordedUrl = null;
        recordingTime = 0;
    }

    async function handleSave() {
        if (!name.trim()) {
            error = "Inserisci un nome";
            return;
        }
        if (!imageFile) {
            error = "Seleziona un'immagine";
            return;
        }
        if (!recordedBlob) {
            error = "Registra un suono";
            return;
        }

        loading = true;
        error = "";
        const supabase = getSupabase();
        const uid = currentUser.id;
        const ts = Date.now();

        // Upload image
        const imgExt = imageFile.name.split(".").pop();
        const imgPath = `${uid}/${ts}.${imgExt}`;
        const { error: imgErr } = await supabase.storage
            .from("card-images")
            .upload(imgPath, imageFile);
        if (imgErr) {
            error = "Errore upload immagine: " + imgErr.message;
            loading = false;
            return;
        }

        const { data: imgUrlData } = supabase.storage
            .from("card-images")
            .getPublicUrl(imgPath);

        // Upload sound
        const soundPath = `${uid}/${ts}.webm`;
        const { error: sndErr } = await supabase.storage
            .from("card-sounds")
            .upload(soundPath, recordedBlob);
        if (sndErr) {
            error = "Errore upload suono: " + sndErr.message;
            loading = false;
            return;
        }

        const { data: sndUrlData } = supabase.storage
            .from("card-sounds")
            .getPublicUrl(soundPath);

        // Insert card record
        const { error: dbErr } = await supabase.from("user_cards").insert({
            category_id: categoryId,
            user_id: uid,
            name: name.trim(),
            image_url: imgUrlData.publicUrl,
            sound_url: sndUrlData.publicUrl,
        });

        if (dbErr) {
            error = "Errore salvataggio: " + dbErr.message;
            loading = false;
            return;
        }

        dispatch("saved");
    }

    function close() {
        removeRecording();
        dispatch("close");
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="overlay" on:click|self={close}>
    <div class="modal">
        <button class="close-btn" on:click={close}>✕</button>
        <h2>Nuova Card</h2>

        <input
            type="text"
            placeholder="Nome card"
            bind:value={name}
            disabled={loading}
            maxlength="40"
        />

        <!-- Image upload -->
        <div class="section-label">Immagine</div>
        {#if imagePreview}
            <div class="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button
                    class="remove-btn"
                    on:click={() => {
                        imageFile = null;
                        imagePreview = null;
                    }}>✕</button
                >
            </div>
        {:else}
            <label class="file-upload">
                <input
                    type="file"
                    accept="image/*"
                    on:change={handleImageSelect}
                    disabled={loading}
                />
                <span>📷 Scegli immagine</span>
            </label>
        {/if}

        <!-- Sound recording -->
        <div class="section-label">Suono</div>
        {#if recordedUrl}
            <div class="audio-preview">
                <audio src={recordedUrl} controls></audio>
                <button class="remove-btn" on:click={removeRecording}>✕</button>
            </div>
        {:else}
            <div class="recorder">
                {#if isRecording}
                    <div class="recording-indicator">
                        <span class="rec-dot"></span>
                        <span>Registrazione... {recordingTime}s</span>
                    </div>
                    <button class="rec-btn stop" on:click={stopRecording}
                        >⏹ Stop</button
                    >
                {:else}
                    <button
                        class="rec-btn"
                        on:click={startRecording}
                        disabled={loading}
                    >
                        🎤 Registra
                    </button>
                {/if}
            </div>
        {/if}

        {#if error}
            <div class="error">{error}</div>
        {/if}

        <button
            class="save-btn"
            on:click={handleSave}
            disabled={loading || isRecording}
        >
            {loading ? "Salvataggio..." : "Aggiungi Card"}
        </button>
    </div>
</div>

<style>
    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }
    .modal {
        background: white;
        border-radius: 24px;
        padding: 2rem;
        width: 90%;
        max-width: 420px;
        position: relative;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-height: 90vh;
        overflow-y: auto;
    }
    .close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #999;
    }
    h2 {
        color: #667eea;
        font-size: 1.6rem;
        margin: 0 0 1.5rem 0;
        text-align: center;
    }
    input[type="text"] {
        width: 100%;
        padding: 1rem;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        font-size: 1rem;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s;
    }
    input[type="text"]:focus {
        border-color: #667eea;
    }
    .section-label {
        font-size: 0.9rem;
        color: #666;
        margin: 1.2rem 0 0.5rem;
        font-weight: 600;
    }

    .file-upload {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        border: 2px dashed #ccc;
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .file-upload:hover {
        border-color: #667eea;
        background: #f8f8ff;
    }
    .file-upload input {
        display: none;
    }
    .file-upload span {
        font-size: 1.1rem;
        color: #667eea;
        font-weight: 500;
    }

    .image-preview {
        position: relative;
        text-align: center;
    }
    .image-preview img {
        max-width: 100%;
        max-height: 200px;
        border-radius: 16px;
        object-fit: contain;
    }
    .remove-btn {
        position: absolute;
        top: 0.25rem;
        right: 0.25rem;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        font-size: 1rem;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .recorder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        border: 2px dashed #ccc;
        border-radius: 16px;
    }
    .rec-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 0.8rem 1.5rem;
        font-size: 1.1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
    }
    .rec-btn.stop {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    .rec-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    .recording-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: #ef4444;
    }
    .rec-dot {
        width: 12px;
        height: 12px;
        background: #ef4444;
        border-radius: 50%;
        animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
    }

    .audio-preview {
        position: relative;
        padding: 0.5rem;
        background: #f8f8ff;
        border-radius: 16px;
    }
    .audio-preview audio {
        width: 100%;
    }

    .error {
        color: #ef4444;
        font-size: 0.9rem;
        text-align: center;
        padding: 0.5rem;
        background: #fef2f2;
        border-radius: 8px;
        margin-top: 1rem;
    }
    .save-btn {
        width: 100%;
        margin-top: 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 1rem;
        font-size: 1.1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
    }
    .save-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    .save-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
</style>
