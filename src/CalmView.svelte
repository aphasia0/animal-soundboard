<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { triggerVibration } from './audioUtils.js';
  import { createCalmEngine } from './calmEngine.js';

  const dispatch = createEventDispatcher();

  const DURATIONS = [
    { id: '3', label: '3 min', seconds: 180 },
    { id: '5', label: '5 min', seconds: 300 },
    { id: '10', label: '10 min', seconds: 600 },
    { id: 'inf', label: '∞', seconds: 0 },
  ];

  // Stelle deterministiche: stesse posizioni a ogni apertura, niente layout shift.
  const STARS = Array.from({ length: 42 }, (_, index) => ({
    left: (index * 37 + 11) % 100,
    top: (index * 53 + 7) % 100,
    size: 2 + (index % 3),
    delay: (index % 7) * 0.8,
    duration: 4 + (index % 5) * 1.4,
  }));

  let phase = 'idle'; // 'idle' | 'running' | 'done'
  let durationId = '5';
  let remaining = 0;
  let needsResume = false;
  let tapPulse = false;
  let progress = 0;

  let engine = null;
  let endAt = 0;
  let ticker = null;
  let pulseTimer = null;
  let resumeAfterHide = false;
  let previousHtmlBackground = '';
  let previousBodyBackground = '';

  $: currentDuration = DURATIONS.find((item) => item.id === durationId) || DURATIONS[1];
  $: countdown = formatTime(remaining);
  $: showProgress = phase === 'running' && currentDuration.seconds > 0;

  onMount(() => {
    engine = createCalmEngine();
    previousHtmlBackground = document.documentElement.style.background;
    previousBodyBackground = document.body.style.background;
    document.documentElement.style.background = '#0f172a';
    document.body.style.background = '#0f172a';

    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('visibilitychange', handleVisibility);
      stopTicker();
      if (pulseTimer) clearTimeout(pulseTimer);
      engine?.dispose();
      engine = null;
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;
    };
  });

  function formatTime(seconds) {
    if (!seconds) return '∞';
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  function startTicker() {
    runTicker(currentDuration.seconds);
  }

  function runTicker(seconds) {
    stopTicker();
    if (!seconds) {
      remaining = 0;
      progress = 0;
      return;
    }
    remaining = seconds;
    endAt = Date.now() + seconds * 1000;
    ticker = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      remaining = left;
      progress = currentDuration.seconds
        ? ((currentDuration.seconds - left) / currentDuration.seconds) * 100
        : 0;
      if (left <= 0) finish();
    }, 500);
  }

  async function start() {
    if (!engine) return;
    triggerVibration(40);
    const ok = await engine.start();
    if (!ok) return;
    needsResume = false;
    phase = 'running';
    startTicker();
  }

  function finish() {
    engine?.stop();
    stopTicker();
    remaining = 0;
    progress = 0;
    phase = 'done';
    triggerVibration(30);
  }

  async function resumeSession() {
    if (!engine) return;
    const ok = await engine.resume();
    needsResume = !ok;
    if (ok) {
      phase = 'running';
      if (currentDuration.seconds && remaining > 0) {
        // Il tempo trascorso in background non conta.
        runTicker(remaining);
      }
    }
  }

  function toggleDuration(id) {
    if (phase === 'running') return;
    durationId = id;
    triggerVibration(20);
  }

  function tapSound() {
    if (phase !== 'running') return;
    if (!engine?.tap()) return;
    tapPulse = true;
    if (pulseTimer) clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => {
      tapPulse = false;
    }, 700);
  }

  function handleKeydown(event) {
    if (event.repeat) return;
    const key = event.key;
    if (key !== ' ' && key !== 'Spacebar' && key !== 'a' && key !== 'A') return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    event.preventDefault();
    if (phase === 'idle') start();
    else if (phase === 'running') tapSound();
    else start();
  }

  function handleVisibility() {
    if (document.visibilityState === 'hidden') {
      resumeAfterHide = phase === 'running';
      if (resumeAfterHide) {
        stopTicker();
        engine?.pause();
      }
      return;
    }
    if (resumeAfterHide) {
      resumeAfterHide = false;
      resumeSession();
    }
  }
</script>

<main>
  <div class="stars" aria-hidden="true">
    {#each STARS as star}
      <span
        class="star"
        style={`left:${star.left}%; top:${star.top}%; width:${star.size}px; height:${star.size}px; animation-delay:${star.delay}s; animation-duration:${star.duration}s;`}
      ></span>
    {/each}
  </div>

  <div class="calm" class:calm-running={phase === 'running'}>
    <header class="top-bar">
      <button
        class="back-button"
        on:click={() => dispatch('back')}
        title="Indietro"
        aria-label="Indietro"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <h1 class="title"><span aria-hidden="true">🌙</span> Calma</h1>

      {#if phase === 'running'}
        <button class="stop-button" on:click={finish} title="Ferma la musica" aria-label="Ferma la musica">
          <span aria-hidden="true">■</span>
        </button>
      {:else}
        <span class="top-spacer" aria-hidden="true"></span>
      {/if}
    </header>

    <section class="stage" role="presentation" on:click={tapSound}>
      {#if phase === 'idle'}
        <button class="moon-button" on:click={start} aria-label="Inizia la musica calma">
          <span aria-hidden="true">🌙</span>
        </button>
        <p class="prompt">Tocca la luna per iniziare</p>

        <div class="durations" role="group" aria-label="Durata">
          {#each DURATIONS as option}
            <button
              class="duration-button"
              class:duration-active={durationId === option.id}
              on:click={() => toggleDuration(option.id)}
              aria-pressed={durationId === option.id}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {:else if phase === 'running'}
        <div class="breath" class:tap-pulse={tapPulse} aria-hidden="true">
          <span class="breath-core">🌙</span>
        </div>

        <p class="countdown" aria-hidden="true">{countdown}</p>
        <p class="prompt">Tocca lo schermo per un campanello</p>

        {#if showProgress}
          <div class="progress" aria-hidden="true">
            <span style={`width:${progress}%`}></span>
          </div>
        {/if}
      {:else}
        <div class="done-moon" aria-hidden="true">🌙</div>
        <h2 class="done-title">Bravo</h2>
        <p class="prompt">Respira ancora un po' se vuoi</p>
        <div class="done-actions">
          <button class="primary-button" on:click={start}>Ancora</button>
          <button class="secondary-button" on:click={() => dispatch('back')}>Indietro</button>
        </div>
      {/if}

      {#if needsResume}
        <button class="resume-button" on:click={resumeSession}>Riprendi</button>
      {/if}
    </section>
  </div>
</main>

<style>
  main {
    position: relative;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    background:
      radial-gradient(circle at 50% 18%, #34327a 0%, #1e1b4b 46%, #0f172a 100%);
    background-color: #0f172a;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    display: flex;
    justify-content: center;
  }

  .calm {
    position: relative;
    width: 100%;
    max-width: 900px;
    flex: 1;
    padding: 1rem 1.25rem 2rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }

  .stars {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 1;
  }

  .star {
    position: absolute;
    border-radius: 50%;
    background: rgba(226, 232, 240, 0.85);
    box-shadow: 0 0 6px rgba(226, 232, 240, 0.55);
    animation-name: twinkle;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
    opacity: 0.5;
  }

  @keyframes twinkle {
    0%, 100% { opacity: 0.25; transform: scale(0.85); }
    50% { opacity: 0.9; transform: scale(1.1); }
  }

  .top-bar {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
  }

  .back-button,
  .stop-button {
    background: rgba(226, 232, 240, 0.14);
    border: 1px solid rgba(226, 232, 240, 0.22);
    border-radius: 15px;
    width: 3.2rem;
    height: 3.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e2e8f0;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .back-button:hover,
  .stop-button:hover {
    background: rgba(226, 232, 240, 0.24);
  }

  .back-button:active,
  .stop-button:active {
    transform: scale(0.94);
  }

  .top-spacer {
    width: 3.2rem;
  }

  .title {
    margin: 0;
    text-align: center;
    color: #e2e8f0;
    font-size: clamp(1.2rem, 2.2vw, 1.7rem);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .stage {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.4rem;
    text-align: center;
    min-height: 0;
    padding-bottom: 3rem;
  }

  .moon-button {
    width: clamp(7rem, 22vw, 10rem);
    height: clamp(7rem, 22vw, 10rem);
    border-radius: 50%;
    border: 1px solid rgba(226, 232, 240, 0.28);
    background: radial-gradient(circle at 38% 32%, rgba(226, 232, 240, 0.28), rgba(99, 102, 241, 0.16) 55%, rgba(15, 23, 42, 0.2));
    font-size: clamp(3.2rem, 9vw, 4.6rem);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 0 60px rgba(129, 140, 248, 0.35);
    transition: transform 0.2s, box-shadow 0.4s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .moon-button:hover {
    transform: scale(1.04);
    box-shadow: 0 0 90px rgba(129, 140, 248, 0.5);
  }

  .moon-button:active {
    transform: scale(0.97);
  }

  .prompt {
    margin: 0;
    color: rgba(226, 232, 240, 0.72);
    font-size: 0.95rem;
    font-weight: 500;
  }

  .durations {
    display: flex;
    gap: 0.4rem;
    padding: 0.3rem;
    border-radius: 999px;
    background: rgba(226, 232, 240, 0.1);
    border: 1px solid rgba(226, 232, 240, 0.16);
  }

  .duration-button {
    border: none;
    background: transparent;
    color: rgba(226, 232, 240, 0.85);
    font-size: 0.9rem;
    font-weight: 600;
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.16s, color 0.16s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .duration-active {
    background: rgba(226, 232, 240, 0.9);
    color: #1e1b4b;
  }

  .breath {
    width: clamp(9rem, 28vw, 13rem);
    height: clamp(9rem, 28vw, 13rem);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 45% 40%, rgba(199, 210, 254, 0.26), rgba(79, 70, 229, 0.18) 55%, rgba(15, 23, 42, 0.05) 75%);
    box-shadow: 0 0 90px rgba(129, 140, 248, 0.28);
    animation: breathe 11s ease-in-out infinite;
  }

  @keyframes breathe {
    0%, 100% { transform: scale(0.86); box-shadow: 0 0 60px rgba(129, 140, 248, 0.2); }
    45% { transform: scale(1.06); box-shadow: 0 0 110px rgba(129, 140, 248, 0.42); }
  }

  .tap-pulse {
    animation: tap-pulse 0.7s ease-out;
  }

  @keyframes tap-pulse {
    0% { box-shadow: 0 0 0 0 rgba(226, 232, 240, 0.4), 0 0 90px rgba(129, 140, 248, 0.28); }
    100% { box-shadow: 0 0 0 40px rgba(226, 232, 240, 0), 0 0 90px rgba(129, 140, 248, 0.28); }
  }

  .breath-core {
    font-size: clamp(2.4rem, 7vw, 3.4rem);
    filter: drop-shadow(0 0 18px rgba(226, 232, 240, 0.5));
  }

  .countdown {
    margin: 0;
    color: rgba(226, 232, 240, 0.9);
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.08em;
  }

  .progress {
    width: min(70%, 22rem);
    height: 0.3rem;
    border-radius: 999px;
    background: rgba(226, 232, 240, 0.16);
    overflow: hidden;
  }

  .progress span {
    display: block;
    height: 100%;
    background: rgba(199, 210, 254, 0.8);
    border-radius: inherit;
    transition: width 0.5s linear;
  }

  .done-moon {
    font-size: 4.5rem;
    filter: drop-shadow(0 0 24px rgba(199, 210, 254, 0.55));
  }

  .done-title {
    margin: 0;
    color: #e2e8f0;
    font-size: 2.2rem;
    font-weight: 600;
  }

  .done-actions {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .primary-button,
  .secondary-button,
  .resume-button {
    border: none;
    border-radius: 999px;
    padding: 1rem 2rem;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition: transform 0.14s, background 0.16s;
  }

  .primary-button {
    background: rgba(226, 232, 240, 0.92);
    color: #1e1b4b;
  }

  .secondary-button,
  .resume-button {
    background: rgba(226, 232, 240, 0.14);
    color: #e2e8f0;
    border: 1px solid rgba(226, 232, 240, 0.28);
  }

  .primary-button:active,
  .secondary-button:active,
  .resume-button:active {
    transform: scale(0.96);
  }

  .resume-button {
    position: absolute;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
  }

  @media (max-width: 640px) {
    .calm {
      padding: 0.9rem 0.9rem 1.5rem;
    }

    .back-button,
    .stop-button,
    .top-spacer {
      width: 2.8rem;
      height: 2.8rem;
    }

    .prompt {
      font-size: 0.82rem;
    }

    .countdown {
      font-size: 1.25rem;
    }

    .done-title {
      font-size: 1.8rem;
    }

    .primary-button,
    .secondary-button,
    .resume-button {
      padding: 0.85rem 1.6rem;
      font-size: 0.95rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .star {
      animation: none;
      opacity: 0.55;
    }

    .breath {
      animation: none;
      transform: scale(1);
    }

    .tap-pulse {
      animation: none;
    }

    .progress span {
      transition: none;
    }
  }
</style>
