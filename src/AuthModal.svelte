<script>
    import { createEventDispatcher } from "svelte";
    import { signIn, signUp } from "./authStore.js";

    const dispatch = createEventDispatcher();

    let mode = "login"; // 'login' or 'register'
    let email = "";
    let password = "";
    let error = "";
    let loading = false;

    async function handleSubmit() {
        error = "";
        loading = true;

        if (mode === "login") {
            const result = await signIn(email, password);
            if (result.error) {
                error = result.error.message;
            } else {
                dispatch("close");
            }
        } else {
            const result = await signUp(email, password);
            if (result.error) {
                error = result.error.message;
            } else {
                dispatch("close");
            }
        }
        loading = false;
    }

    function close() {
        dispatch("close");
    }

    function toggleMode() {
        mode = mode === "login" ? "register" : "login";
        error = "";
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="overlay" on:click|self={close}>
    <div class="modal">
        <button class="close-btn" on:click={close}>✕</button>

        <h2>{mode === "login" ? "Accedi" : "Registrati"}</h2>

        <form on:submit|preventDefault={handleSubmit}>
            <input
                type="email"
                placeholder="Email"
                bind:value={email}
                required
                disabled={loading}
            />
            <input
                type="password"
                placeholder="Password"
                bind:value={password}
                required
                minlength="6"
                disabled={loading}
            />

            {#if error}
                <div class="error">{error}</div>
            {/if}

            <button type="submit" class="submit-btn" disabled={loading}>
                {#if loading}
                    Caricamento...
                {:else}
                    {mode === "login" ? "Accedi" : "Registrati"}
                {/if}
            </button>
        </form>

        <button class="toggle-btn" on:click={toggleMode}>
            {mode === "login"
                ? "Non hai un account? Registrati"
                : "Hai già un account? Accedi"}
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
        padding: 2.5rem;
        width: 90%;
        max-width: 400px;
        position: relative;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
        padding: 0.25rem;
        line-height: 1;
    }

    .close-btn:hover {
        color: #333;
    }

    h2 {
        color: #667eea;
        font-size: 1.8rem;
        margin: 0 0 1.5rem 0;
        text-align: center;
    }

    form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    input {
        padding: 1rem;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
    }

    input:focus {
        border-color: #667eea;
    }

    input:disabled {
        opacity: 0.6;
    }

    .error {
        color: #ef4444;
        font-size: 0.9rem;
        text-align: center;
        padding: 0.5rem;
        background: #fef2f2;
        border-radius: 8px;
    }

    .submit-btn {
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

    .submit-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    .submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .toggle-btn {
        background: none;
        border: none;
        color: #667eea;
        cursor: pointer;
        font-size: 0.9rem;
        margin-top: 1rem;
        display: block;
        width: 100%;
        text-align: center;
    }

    .toggle-btn:hover {
        text-decoration: underline;
    }
</style>
