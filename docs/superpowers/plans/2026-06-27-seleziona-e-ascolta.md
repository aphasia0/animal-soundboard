# Seleziona e Ascolta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere la modalità "Seleziona e Ascolta" che permette di navigare le card con `A` (+ TTS) e riprodurre il suono con `Spacebar`, attiva solo in modalità una card.

**Architecture:** Si aggiunge `selectAndListen` a `settingsStore` (localStorage only). In `CategoryView` si aggiunge un pulsante toggle nella toolbar esistente (visibile solo con `cardMode === 1`) e un `keydown` listener su `window` che intercetta `A` e `Spacebar` quando la feature è attiva.

**Tech Stack:** Svelte 3, Web Speech API (`window.speechSynthesis`), funzioni audio già esistenti (`playAudio`, `resumeAudioContext`).

## Global Constraints

- Svelte 3 (nessuna rune syntax, nessun `$state`)
- Nessuna dipendenza npm nuova
- Nessuna modifica alla schema Supabase
- `selectAndListen` persiste solo in localStorage, non in Supabase
- Il listener deve essere no-op quando `$isModalOpen` è true
- Spacebar non triggera se `event.target` è INPUT, BUTTON, TEXTAREA, SELECT

---

### Task 1: Aggiungere `selectAndListen` a settingsStore

**Files:**
- Modify: `src/settingsStore.js`

**Interfaces:**
- Produces: `settingsStore` con nuovo campo `selectAndListen: boolean` nei defaultSettings, persistito in localStorage, aggiornabile via `updateSettings({ selectAndListen: true/false })`

- [ ] **Step 1: Aprire `src/settingsStore.js` e aggiungere il campo ai defaultSettings**

Trovare il blocco `const defaultSettings = {` e aggiungere `selectAndListen: false`:

```js
const defaultSettings = {
    cardMode: null,
    cardNavMode: 'linear',
    primaryColor: '#39ff14',
    secondaryColor: '#ff0000',
    maxTimeMs: 'auto',
    playbackMode: 'once',
    selectAndListen: false,   // <-- aggiunto
    hasSettings: false
};
```

- [ ] **Step 2: Verificare che il merge con localStorage includa il nuovo campo**

Il codice esistente già fa `{ ...defaultSettings, ...JSON.parse(saved) }` quindi i valori salvati sovrascrivono il default — nessuna modifica necessaria. Verificare visivamente che la riga sia presente in `loadFromSupabase` e `updateSettings`.

- [ ] **Step 3: Commit**

```bash
git add src/settingsStore.js
git commit -m "feat: add selectAndListen flag to settingsStore"
```

---

### Task 2: Pulsante toggle in CategoryView

**Files:**
- Modify: `src/CategoryView.svelte`

**Interfaces:**
- Consumes: `settingsStore` (già importato), `cardMode` prop (già disponibile), `triggerVibration` (già importato), `$isModalOpen` (già importato), `closeAllOverlays` (già definita nel file)
- Produces: pulsante visibile solo quando `cardMode === 1`, che toglla `selectAndListen` via `settingsStore.updateSettings`

- [ ] **Step 1: Aggiungere variabile locale reattiva per `selectAndListen`**

Trovare nel blocco `<script>` la zona dove si legge `settingsStore` (cerca `settingsStore.subscribe` o `$: ... = settings`). Aggiungere:

```js
let selectAndListen = false;
$: selectAndListen = settings?.selectAndListen ?? false;
```

(Dove `settings` è già la variabile locale aggiornata dallo store — verificare il nome esatto nel file.)

- [ ] **Step 2: Aggiungere il pulsante toggle nella toolbar**

Trovare il pulsante playback (cerca `Modalità riproduzione`) nella sezione HTML. Subito dopo il suo tag `</button>` di chiusura, aggiungere il pulsante "Seleziona e Ascolta", visibile solo quando `cardMode === 1`:

```svelte
{#if cardMode === 1}
    <button
        class="palette-btn"
        class:active={selectAndListen}
        on:click={() => {
            triggerVibration(45);
            closeAllOverlays();
            settingsStore.updateSettings({ selectAndListen: !selectAndListen }, $user?.id);
        }}
        title="Seleziona e Ascolta"
        data-tooltip={selectAndListen ? "Seleziona e Ascolta: ON" : "Seleziona e Ascolta: OFF"}
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
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
    </button>
{/if}
```

- [ ] **Step 3: Verificare visivamente**

Avviare il dev server (`npm run dev`), aprire l'app, selezionare modalità "Una Card", entrare in una categoria. Verificare che il pulsante cuffie appaia nella toolbar. Passare a modalità "Due Card" e verificare che scompaia.

- [ ] **Step 4: Commit**

```bash
git add src/CategoryView.svelte
git commit -m "feat: add Seleziona e Ascolta toggle button in toolbar"
```

---

### Task 3: Keydown listener — tasto A (avanza + TTS)

**Files:**
- Modify: `src/CategoryView.svelte`

**Interfaces:**
- Consumes: `next()` (già definita nel file, line ~460), `displayItem.name` (già reattivo), `selectAndListen` (da Task 2), `$isModalOpen` (già importato), `cardMode` prop
- Produces: pressione di `A` con feature attiva chiama `next()` e legge `displayItem.name` con `speechSynthesis`

- [ ] **Step 1: Aggiungere la funzione `speakName`**

Nel blocco `<script>`, dopo la funzione `next()`, aggiungere:

```js
function speakName(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    window.speechSynthesis.speak(utterance);
}
```

- [ ] **Step 2: Aggiungere la funzione `handleKeydown`**

Subito dopo `speakName`, aggiungere:

```js
function handleKeydown(e) {
    if (!selectAndListen || cardMode !== 1 || $isModalOpen) return;

    if (e.key === 'a' || e.key === 'A') {
        next();
        speakName(displayItem?.name ?? '');
    }
}
```

- [ ] **Step 3: Registrare e deregistrare il listener**

Trovare il blocco `onMount` già esistente nel file. Aggiungere la registrazione del listener:

```js
onMount(() => {
    // ... codice esistente ...
    window.addEventListener('keydown', handleKeydown);
});
```

Trovare il blocco `onDestroy` già esistente (o aggiungerne uno se mancante):

```js
onDestroy(() => {
    // ... codice esistente ...
    window.removeEventListener('keydown', handleKeydown);
});
```

**Nota:** Se `onMount` o `onDestroy` non esistono nel file, aggiungere gli import necessari — ma verificare prima: `onMount` e `onDestroy` sono già importati da `'svelte'` nella prima riga dello script.

- [ ] **Step 4: Testare manualmente**

Con dev server attivo, entrare in una categoria in modalità una card, attivare "Seleziona e Ascolta". Premere `A` ripetutamente. Verificare che:
- La card avanzi
- Il browser legga il nome ad alta voce in italiano
- La lettura precedente venga interrotta prima di iniziarne una nuova

- [ ] **Step 5: Commit**

```bash
git add src/CategoryView.svelte
git commit -m "feat: A key advances card and reads name via TTS"
```

---

### Task 4: Keydown listener — Spacebar (riproduci suono)

**Files:**
- Modify: `src/CategoryView.svelte`

**Interfaces:**
- Consumes: `handleKeydown` (da Task 3), `resumeAudioContext` (già importato), `playAudio` (già importato), `displayItem.sound` (già reattivo)
- Produces: pressione di `Spacebar` con feature attiva riproduce il suono della card corrente

- [ ] **Step 1: Estendere `handleKeydown` con il caso Spacebar**

Modificare la funzione `handleKeydown` aggiunta nel Task 3:

```js
function handleKeydown(e) {
    if (!selectAndListen || cardMode !== 1 || $isModalOpen) return;

    if (e.key === 'a' || e.key === 'A') {
        next();
        speakName(displayItem?.name ?? '');
    }

    if (e.key === ' ') {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        resumeAudioContext();
        playAudio(displayItem?.sound, 0);
    }
}
```

- [ ] **Step 2: Testare manualmente**

Con dev server attivo, entrare in una categoria in modalità una card, attivare "Seleziona e Ascolta". Premere `Spacebar`. Verificare che:
- Il suono della card corrente venga riprodotto
- La pagina non scorra
- Premere `Spacebar` mentre il focus è su un pulsante non triggeri il playback audio (solo l'azione del pulsante)

Testare anche con la feature **disattivata**: premere `A` e `Spacebar` non deve fare nulla.

Testare con una modal aperta: i tasti non devono avere effetto.

- [ ] **Step 3: Commit**

```bash
git add src/CategoryView.svelte
git commit -m "feat: Spacebar plays card sound in Seleziona e Ascolta mode"
```
