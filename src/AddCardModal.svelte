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
    let recordedBlob = null;
    let recordedUrl = null;
    let recordingTime = 0;
    let recordingInterval = null;
    let audioExtension = "webm"; // default, will update dynamically
    let audioChunks = [];

    let currentUser;
    user.subscribe((v) => (currentUser = v));

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Prevent loading non-images
        if (!file.type.startsWith("image/")) {
            error = "Seleziona un formato immagine valido";
            return;
        }

        imageFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => (imagePreview = ev.target.result);
        reader.readAsDataURL(file);
    }

    // Compresses the image using a canvas context
    async function compressImage(
        file,
        maxWidth = 800,
        maxHeight = 800,
        quality = 0.8,
    ) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height *= maxWidth / width));
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width *= maxHeight / height));
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error("Canvas to Blob failed"));
                            }
                        },
                        "image/jpeg",
                        quality,
                    );
                };
                img.onerror = (err) => reject(err);
                img.src = event.target.result;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    async function startRecording() {
        error = "";
        try {
            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {
                const isNotLocal =
                    window.location.hostname !== "localhost" &&
                    window.location.hostname !== "127.0.0.1";
                if (window.location.protocol !== "https:" && isNotLocal) {
                    error =
                        "L'accesso al microfono richiede HTTPS su dispositivi remoti.";
                } else {
                    error =
                        "Il tuo browser non supporta la registrazione audio o sei in un contesto non sicuro.";
                }
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            let selectedMimeType = "";

            // iOS Safari usually supports audio/mp4. Android/Chrome supports audio/webm.
            const types = [
                "audio/webm",
                "audio/mp4",
                "audio/mpeg",
                "audio/ogg;codecs=opus",
            ];

            for (let type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedMimeType = type;
                    break;
                }
            }

            const options = selectedMimeType
                ? { mimeType: selectedMimeType }
                : {};

            // On some versions of iOS, MediaRecorder needs specific handling
            try {
                mediaRecorder = new MediaRecorder(stream, options);
            } catch (e) {
                console.error(
                    "MediaRecorder init failed with options, trying without",
                    e,
                );
                mediaRecorder = new MediaRecorder(stream);
            }

            // Set extension based on chosen mimetype
            const actualMimeType =
                mediaRecorder.mimeType || selectedMimeType || "";
            if (actualMimeType.includes("mp4")) audioExtension = "m4a";
            else if (actualMimeType.includes("mpeg")) audioExtension = "mp3";
            else if (actualMimeType.includes("ogg")) audioExtension = "ogg";
            else audioExtension = "webm";

            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                // Use the recorder's actual MIME type
                const finalMimeType =
                    mediaRecorder.mimeType || selectedMimeType || "audio/webm";
                recordedBlob = new Blob(audioChunks, { type: finalMimeType });
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
            console.error("Microphone access error:", err);
            if (
                err.name === "NotAllowedError" ||
                err.name === "PermissionDeniedError"
            ) {
                error = "Permesso microfono negato dal browser.";
            } else if (
                err.name === "NotFoundError" ||
                err.name === "DevicesNotFoundError"
            ) {
                error = "Nessun microfono trovato.";
            } else {
                error = "Errore accesso microfono: " + err.message;
            }
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

        // Compress image before upload
        let fileToUpload = imageFile;
        let imgExt = imageFile.name.split(".").pop().toLowerCase();

        try {
            // Convert to a smaller JPEG
            const compressedBlob = await compressImage(
                imageFile,
                800,
                800,
                0.8,
            );
            fileToUpload = compressedBlob;
            imgExt = "jpg"; // Forcing extension since we convert to image/jpeg
        } catch (err) {
            console.error("Compression failed, uploading original", err);
        }

        const imgPath = `${uid}/${ts}.${imgExt}`;
        const { error: imgErr } = await supabase.storage
            .from("card-images")
            .upload(imgPath, fileToUpload);
        if (imgErr) {
            error = "Errore upload immagine: " + imgErr.message;
            loading = false;
            return;
        }

        const { data: imgUrlData } = supabase.storage
            .from("card-images")
            .getPublicUrl(imgPath);

        // Upload sound
        const soundPath = `${uid}/${ts}.${audioExtension}`;
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
