# Seleziona e Ascolta — Design

**Data:** 2026-06-27  
**Stato:** Approvato

## Obiettivo

Aggiungere una modalità "Seleziona e Ascolta" accessibile da tastiera, attiva solo in modalità una card. Permette di navigare le card con il tasto `A` (con lettura TTS del nome) e di riprodurre il suono associato con la barra spaziatrice.

## Scope

- Disponibile solo quando `cardMode === 1`
- Toggle nella toolbar esistente di `CategoryView`
- Persiste in localStorage tramite `settingsStore`
- Non richiede modifiche al backend Supabase

## File modificati

| File | Modifica |
|---|---|
| `src/settingsStore.js` | Aggiunge `selectAndListen: false` ai `defaultSettings` |
| `src/CategoryView.svelte` | Pulsante toggle + keydown listener |

## Design del toggle

- Posizione: toolbar esistente in `CategoryView`, dopo il pulsante playback
- Visibile solo quando `cardMode === 1`
- Stile: classe `palette-btn` (già usata da palette e playback), con classe `active` quando abilitato
- Icona: SVG cuffie (headphones)

## Comportamento tastiera

Il listener è registrato su `window` via `onMount`/`onDestroy`.

**Condizioni di attivazione del listener:**
- `selectAndListen === true`
- `cardMode === 1`
- `!$isModalOpen`

### Tasto `A`
1. `speechSynthesis.cancel()` — interrompe eventuale lettura precedente
2. `next()` — avanza alla card successiva (rispetta shuffle/linear/locked)
3. `speechSynthesis.speak(utterance)` con `displayItem.name` e `lang: 'it-IT'`

### Tasto Spacebar
1. `event.preventDefault()` — previene scroll della pagina
2. Skip se `event.target` è `INPUT`, `BUTTON`, `TEXTAREA`, `SELECT`
3. `resumeAudioContext()` + `playAudio(displayItem.sound, 0)`

## Edge cases

- **cardNavMode === 'locked'**: `next()` non avanza ma il TTS legge comunque la card corrente
- **speechSynthesis non supportato**: fallback silenzioso, nessun errore UI (guard `if (window.speechSynthesis)`)
- **Modal aperta**: listener ignora tutti i tasti
- **Focus su controllo interattivo**: spacebar non triggera playback audio

## Non incluso

- Sync del flag `selectAndListen` su Supabase (preferenza locale è sufficiente)
- Feedback visivo durante la lettura TTS (fuori scope)
- Supporto per cardMode 2 (doppia card)
