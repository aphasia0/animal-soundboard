<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { triggerVibration } from './audioUtils.js';
  import {
    STEPS,
    TEMPOS,
    TRACKS,
    createBandEngine,
    emptyGrid,
  } from './musicEngine.js';

  const dispatch = createEventDispatcher();

  // Quanti passi accendere, in media, per corsia quando si mescola.
  const SHUFFLE_DENSITY = {
    drums: 0.5,
    bass: 0.35,
    melody: 0.35,
    bells: 0.2,
  };

  let grid = emptyGrid();
  let tempo = 'normale';
  let muted = Object.fromEntries(TRACKS.map((track) => [track.id, false]));
  let playing = false;
  let headStep = -1;

  let engine = null;
  let frame = 0;
  let resumeAfterHide = false;

  onMount(() => {
    engine = createBandEngine({ grid, tempo, muted });
    engine.onStateChange = (value) => {
      playing = value;
      if (!value) {
        headStep = -1;
      }
    };

    const loop = () => {
      const position = engine?.getPosition();
      headStep = position ? position.step : -1;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('visibilitychange', handleVisibility);
      engine?.dispose();
      engine = null;
    };
  });

  function handleVisibility() {
    if (document.visibilityState === 'hidden') {
      resumeAfterHide = playing;
      if (playing) engine?.stop();
    } else if (resumeAfterHide) {
      resumeAfterHide = false;
      engine?.start();
    }
  }

  function handleKeydown(event) {
    if (event.repeat || !engine) return;
    const key = event.key;
    if (key === 'a' || key === 'A') {
      event.preventDefault();
      togglePlay();
      return;
    }
    if (key === ' ' || key === 'Spacebar') {
      // Su un pulsante lo spazio deve restare l'attivazione nativa del focus.
      if (event.target instanceof Element && event.target.closest('button')) return;
      event.preventDefault();
      togglePlay();
    }
  }

  function toggleCell(trackId, step) {
    if (!engine) return;
    triggerVibration(15);
    const lane = grid[trackId].slice();
    lane[step] = !lane[step];
    grid = { ...grid, [trackId]: lane };
    engine.setGrid(grid);
    if (lane[step]) engine.playCell(trackId, step);
  }

  function toggleMute(trackId) {
    triggerVibration(25);
    muted = { ...muted, [trackId]: !muted[trackId] };
    engine?.setMuted(trackId, muted[trackId]);
  }

  function selectTempo(nextTempo) {
    if (nextTempo === tempo) return;
    triggerVibration(25);
    tempo = nextTempo;
    engine?.setTempo(nextTempo);
  }

  function togglePlay() {
    if (!engine) return;
    triggerVibration(40);
    if (playing) engine.stop();
    else engine.start();
  }

  function clearAll() {
    triggerVibration(30);
    grid = emptyGrid();
    engine?.setGrid(grid);
  }

  function shuffle() {
    if (!engine) return;
    triggerVibration(40);

    const next = emptyGrid();
    for (const track of TRACKS) {
      const density = SHUFFLE_DENSITY[track.id] ?? 0.3;
      for (let step = 0; step < STEPS; step++) {
        next[track.id][step] = Math.random() < density;
      }
    }
    // La batteria non deve mai restare muta, altrimenti il loop sembra rotto.
    if (!next.drums.some(Boolean)) {
      next.drums[Math.floor(Math.random() * STEPS)] = true;
    }

    grid = next;
    engine.setGrid(grid);

    // Anteprima: a loop fermo si sente subito che cosa è uscito dai dadi.
    const previewStep = next.drums.findIndex(Boolean);
    if (!playing && previewStep !== -1) engine.playCell('drums', previewStep);
  }

  function laneHasSteps(trackId) {
    return grid[trackId].some(Boolean);
  }

  function goBack() {
    dispatch('back');
  }
</script>

<main>
  <div class="band">
    <header class="top-bar">
      <button class="back-button" on:click={goBack} title="Indietro" aria-label="Indietro">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <h1 class="title">
        <span aria-hidden="true">🎺</span> La Banda
      </h1>

      <button class="clear-button" on:click={clearAll} title="Cancella tutto" aria-label="Cancella tutto">
        <span aria-hidden="true">🧹</span>
      </button>
    </header>

    <p class="hint">Tocca i quadrati per aggiungere suoni, poi premi ▶</p>

    <section class="board" aria-label="Griglia della banda">
      {#each TRACKS as track}
        <div
          class="lane"
          class:lane-active={laneHasSteps(track.id)}
          class:lane-muted={muted[track.id]}
          style={`--track: ${track.color}`}
        >
          <div class="lane-label">
            <span class="lane-emoji" aria-hidden="true">{track.emoji}</span>
            <span class="lane-name" aria-hidden="true">{track.name}</span>
            <button
              class="mute-button"
              on:click={() => toggleMute(track.id)}
              aria-pressed={muted[track.id]}
              aria-label={`Silenzia ${track.name}`}
              title={`Silenzia ${track.name}`}
            >
              <span aria-hidden="true">{muted[track.id] ? '🔇' : '🔊'}</span>
            </button>
          </div>

          <div class="steps" role="group" aria-label={track.name}>
            {#each Array(STEPS) as _, step}
              <button
                class="step"
                class:step-on={grid[track.id][step]}
                class:step-head={playing && headStep === step}
                aria-pressed={grid[track.id][step]}
                aria-label={`${track.name}, passo ${step + 1}`}
                data-track={track.id}
                data-step={step}
                on:click={() => toggleCell(track.id, step)}
              >
                <span class="dot" aria-hidden="true"></span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </section>

    <div class="transport">
      <button
        class="shuffle-button"
        on:click={shuffle}
        title="Mescola la griglia"
        aria-label="Mescola la griglia"
      >
        <span aria-hidden="true">🎲</span>
      </button>

      <button
        class="play-button"
        class:play-active={playing}
        on:click={togglePlay}
        aria-pressed={playing}
        aria-label={playing ? 'Ferma la banda' : 'Suona la banda'}
      >
        <span aria-hidden="true">{playing ? '■' : '▶'}</span>
      </button>

      <div class="tempos" role="group" aria-label="Velocità della banda">
        {#each TEMPOS as option}
          <button
            class="tempo-button"
            class:tempo-active={tempo === option.id}
            on:click={() => selectTempo(option.id)}
            aria-pressed={tempo === option.id}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  </div>
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    background: #667eea;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .band {
    width: 100%;
    max-width: 1080px;
    padding: 1.25rem 1.5rem 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-sizing: border-box;
  }

  .top-bar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
  }

  .back-button,
  .clear-button {
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 15px;
    width: 3.2rem;
    height: 3.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #667eea;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: transform 0.2s, background 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .clear-button {
    font-size: 1.4rem;
  }

  .back-button:hover,
  .clear-button:hover {
    background: white;
    transform: translateY(-2px);
  }

  .back-button:active,
  .clear-button:active {
    transform: scale(0.94);
  }

  .title {
    margin: 0;
    color: white;
    font-size: clamp(1.5rem, 2.6vw, 2.2rem);
    font-weight: 700;
    text-align: center;
    text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
  }

  .hint {
    margin: -0.35rem 0 0;
    text-align: center;
    color: rgba(255, 255, 255, 0.78);
    font-size: 0.95rem;
    font-weight: 500;
  }

  .board {
    background: rgba(255, 255, 255, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 28px;
    padding: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    backdrop-filter: blur(10px);
  }

  .lane {
    display: grid;
    grid-template-columns: minmax(5.5rem, 8.5rem) minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.92);
    border-radius: 18px;
    padding: 0.5rem 0.6rem;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
    transition: opacity 0.2s, transform 0.2s;
  }

  .lane-active {
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.18);
    outline: 2px solid var(--track);
    outline-offset: -2px;
  }

  .lane-muted {
    opacity: 0.7;
    outline-color: transparent;
  }

  .lane-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
  }

  .lane-emoji {
    font-size: 1.7rem;
    line-height: 1;
  }

  .mute-button {
    border: none;
    background: rgba(102, 126, 234, 0.1);
    font-size: 0.8rem;
    line-height: 1;
    width: 2.2rem;
    height: 1.6rem;
    border-radius: 999px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition: transform 0.15s, background 0.15s;
  }

  .mute-button[aria-pressed='true'] {
    background: rgba(239, 68, 68, 0.18);
  }

  .mute-button:hover {
    background: rgba(102, 126, 234, 0.2);
  }

  .mute-button:active {
    transform: scale(0.92);
  }

  .lane-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: #475569;
    letter-spacing: 0.01em;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .step {
    position: relative;
    height: clamp(2.8rem, 5vw, 4.2rem);
    border: 2px dashed rgba(102, 126, 234, 0.35);
    border-radius: 14px;
    background: rgba(102, 126, 234, 0.06);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.14s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.14s, border-color 0.14s, box-shadow 0.14s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .step .dot {
    width: 40%;
    max-width: 1.4rem;
    aspect-ratio: 1;
    height: auto;
    border-radius: 50%;
    background: white;
    transform: scale(0);
    transition: transform 0.16s cubic-bezier(0.2, 1.4, 0.4, 1);
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
  }

  .step-on {
    background: var(--track);
    border-color: transparent;
    box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.16), 0 6px 14px rgba(15, 23, 42, 0.22);
  }

  .step-on .dot {
    transform: scale(1);
  }

  .step-head {
    border-color: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.38);
    transform: translateY(-3px) scale(1.04);
  }

  .step-head.step-on {
    background: var(--track);
    border-color: white;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.55), 0 10px 20px rgba(15, 23, 42, 0.28);
  }

  .step:active {
    transform: scale(0.93);
    transition-duration: 60ms;
  }

  .transport {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  .shuffle-button {
    width: 3.9rem;
    height: 3.9rem;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.9);
    color: #667eea;
    font-size: 1.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.22);
    transition: transform 0.16s, box-shadow 0.16s, background 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .shuffle-button:hover {
    background: white;
    transform: translateY(-2px);
  }

  .shuffle-button:active {
    transform: scale(0.94);
    transition-duration: 70ms;
  }

  .play-button {
    width: 5.6rem;
    height: 5.6rem;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%);
    color: #667eea;
    font-size: 2.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.3);
    transition: transform 0.16s, box-shadow 0.16s, background 0.2s, color 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .play-button:active {
    transform: scale(0.94);
    transition-duration: 70ms;
  }

  .play-active {
    background: linear-gradient(135deg, #34d399 0%, #059669 100%);
    color: white;
    box-shadow: 0 0 0 8px rgba(52, 211, 153, 0.28), 0 12px 30px rgba(15, 23, 42, 0.3);
  }

  .tempos {
    display: flex;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.28);
    padding: 0.35rem;
    border-radius: 999px;
  }

  .tempo-button {
    border: none;
    background: transparent;
    color: white;
    font-size: 0.95rem;
    font-weight: 700;
    padding: 0.55rem 0.95rem;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.16s, color 0.16s, transform 0.12s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .tempo-button:active {
    transform: scale(0.95);
  }

  .tempo-active {
    background: white;
    color: #4c5fd0;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
  }

  @media (max-width: 640px) {
    .band {
      padding: 0.9rem 0.75rem 1.75rem;
      gap: 0.8rem;
    }

    .hint {
      font-size: 0.8rem;
    }

    .board {
      border-radius: 22px;
      padding: 0.6rem;
      gap: 0.5rem;
    }

    .lane {
      grid-template-columns: 2.5rem minmax(0, 1fr);
      gap: 0.4rem;
      border-radius: 16px;
      padding: 0.4rem;
    }

    .lane-name {
      display: none;
    }

    .lane-emoji {
      font-size: 1.35rem;
    }

    .mute-button {
      font-size: 0.65rem;
      width: 1.9rem;
      height: 1.35rem;
    }

    .steps {
      /* Due file da tre: le celle restano grandi abbastanza per un dito. */
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.25rem;
    }

    .step {
      height: 3.5rem;
      border-radius: 11px;
    }

    .play-button {
      width: 4.6rem;
      height: 4.6rem;
      font-size: 1.7rem;
    }

    .shuffle-button {
      width: 3.4rem;
      height: 3.4rem;
      font-size: 1.45rem;
    }

    .tempos {
      order: 3;
      flex-basis: 100%;
      justify-content: center;
    }

    .tempo-button {
      font-size: 0.85rem;
      padding: 0.5rem 0.7rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .step,
    .step .dot,
    .play-button,
    .shuffle-button,
    .back-button,
    .clear-button,
    .tempo-button,
    .mute-button {
      transition: none;
    }

    .step-head {
      transform: none;
    }
  }
</style>
