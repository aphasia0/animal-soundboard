<script>
    import { createEventDispatcher, onMount } from "svelte";
    import { getSupabase } from "./supabaseClient.js";
    import { user } from "./authStore.js";

    const dispatch = createEventDispatcher();

    export let editCategory = null; // null = create mode, object = edit mode

    let name = "";
    let selectedEmoji = "📁";
    let loading = false;
    let error = "";

    onMount(() => {
        if (editCategory) {
            name = editCategory.name || "";
            selectedEmoji = editCategory.emoji || "📁";
        }
    });

    const emojis = [
        "🏠",
        "🎮",
        "🍕",
        "🚗",
        "⚽",
        "🎸",
        "📚",
        "🌈",
        "🐾",
        "🎨",
        "🌺",
        "🎯",
        "🔔",
        "💡",
        "🎪",
        "🏖️",
        "🎂",
        "🧸",
        "🦄",
        "🌟",
        "❤️",
        "🎁",
        "🎈",
        "🎉",
        "🍎",
        "🌻",
        "🦋",
        "🐱",
        "🐶",
        "🐸",
        "🌙",
        "☀️",
    ];

    let currentUser;
    user.subscribe((v) => (currentUser = v));

    async function handleSave() {
        if (!name.trim()) {
            error = "Inserisci un nome";
            return;
        }
        loading = true;
        error = "";

        const supabase = getSupabase();

        if (editCategory) {
            const { error: dbError } = await supabase
                .from("user_categories")
                .update({
                    name: name.trim(),
                    emoji: selectedEmoji,
                })
                .eq("id", editCategory.id);

            if (dbError) {
                error = dbError.message;
                loading = false;
                return;
            }
        } else {
            const { error: dbError } = await supabase
                .from("user_categories")
                .insert({
                    user_id: currentUser.id,
                    name: name.trim(),
                    emoji: selectedEmoji,
                });

            if (dbError) {
                error = dbError.message;
                loading = false;
                return;
            }
        }

        dispatch("saved");
    }

    function close() {
        dispatch("close");
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="overlay" on:click|self={close}>
    <div class="modal">
        <button class="close-btn" on:click={close}>✕</button>
        <h2>{editCategory ? "Modifica Categoria" : "Nuova Categoria"}</h2>

        <div class="preview">
            <span class="preview-emoji">{selectedEmoji}</span>
            <span class="preview-name">{name || "Nome categoria"}</span>
        </div>

        <input
            type="text"
            placeholder="Nome categoria"
            bind:value={name}
            disabled={loading}
            maxlength="30"
        />

        <div class="emoji-label">Scegli un'icona:</div>
        <div class="emoji-grid">
            {#each emojis as emoji}
                <button
                    class="emoji-btn"
                    class:selected={selectedEmoji === emoji}
                    on:click={() => (selectedEmoji = emoji)}
                    disabled={loading}
                >
                    {emoji}
                </button>
            {/each}
        </div>

        {#if error}
            <div class="error">{error}</div>
        {/if}

        <button class="save-btn" on:click={handleSave} disabled={loading}>
            {loading
                ? "Salvataggio..."
                : editCategory
                  ? "Salva Modifiche"
                  : "Crea Categoria"}
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

    .preview {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 1rem;
        background: linear-gradient(135deg, #f0f0ff 0%, #f5f0ff 100%);
        border-radius: 16px;
        margin-bottom: 1.5rem;
    }

    .preview-emoji {
        font-size: 2.5rem;
    }

    .preview-name {
        font-size: 1.3rem;
        font-weight: bold;
        color: #667eea;
    }

    input {
        width: 100%;
        padding: 1rem;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        font-size: 1rem;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s;
    }

    input:focus {
        border-color: #667eea;
    }

    .emoji-label {
        font-size: 0.9rem;
        color: #666;
        margin: 1rem 0 0.5rem;
    }

    .emoji-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 0.4rem;
    }

    .emoji-btn {
        font-size: 1.5rem;
        background: none;
        border: 2px solid transparent;
        border-radius: 10px;
        cursor: pointer;
        padding: 0.3rem;
        transition: all 0.15s;
    }

    .emoji-btn:hover {
        background: #f0f0ff;
    }

    .emoji-btn.selected {
        border-color: #667eea;
        background: #f0f0ff;
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
