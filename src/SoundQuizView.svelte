<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    playAudio,
    playRewardSound,
    preloadImages,
    resumeAudioContext,
    stopAudio,
    triggerVibration,
  } from './audioUtils.js';

  export let categories = [];
  export let loading = false;

  const dispatch = createEventDispatcher();
  const MAX_ROUNDS = 6;

  let phase = 'categories'; // 'categories' | 'playing' | 'done'
  let activeCategory = null;
  let deck = [];
  let remainingTargets = [];
  let options = [];
  let target = null;
  let roundTotal = 0;
  let round = 0;
  let stars = 0;
  let wrongThisRound = 0;
  let answered = false;
  let hint = false;
  let speakerPulse = false;
  let advanceTimer = null;
  let pulseTimer = null;

  // Solo le carte ascoltabili e con un nome distinto: due opzioni identiche
  // renderebbero il round ingiocabile.
  $: playableCategories = categories
    .map((category) => ({
      ...category,
      items: uniqueByName(category.items.filter((item) => item.sound && item.image)),
    }))
    .filter((category) => category.items.length >= 2);

  $: allPlayable = uniqueByName(playableCategories.flatMap((category) => category.items));

  $: showEmptyState = !loading && playableCategories.length === 0;

  onMount(() => () => {
    clearTimers();
    stopAudio();
  });

  function uniqueByName(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = (item.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function shuffled(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function clearTimers() {
    if (advanceTimer) clearTimeout(advanceTimer);
    if (pulseTimer) clearTimeout(pulseTimer);
    advanceTimer = null;
    pulseTimer = null;
  }

  async function startGame(category) {
    activeCategory = category;
    deck = shuffled(category.items);
    remainingTargets = [...deck];
    roundTotal = Math.min(MAX_ROUNDS, deck.length);
    round = 0;
    stars = 0;
    phase = 'playing';
    stopAudio();
    await resumeAudioContext();
    nextRound();
  }

  function nextRound() {
    if (round >= roundTotal || remainingTargets.length === 0) {
      finish();
      return;
    }

    target = remainingTargets.pop();
    const distractor =
      deck.find((item) => item.name !== target.name && item.id !== target.id) || null;
    if (!distractor) {
      finish();
      return;
    }

    options = shuffled([
      { item: target, correct: true },
      { item: distractor, correct: false },
    ]);
    preloadImages(options.map((option) => option.item.image));

    round += 1;
    wrongThisRound = 0;
    answered = false;
    hint = false;
    playTarget();
  }

  async function playTarget() {
    if (!target?.sound) return;
    triggerVibration(15);
    speakerPulse = true;
    if (pulseTimer) clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => {
      speakerPulse = false;
    }, 450);
    await playAudio(target.sound, 0, false);
  }

  function answer(option) {
    if (answered || !option) return;

    if (option.correct) {
      answered = true;
      stars += 1;
      triggerVibration(80);
      playRewardSound();
      if (advanceTimer) clearTimeout(advanceTimer);
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        nextRound();
      }, 1200);
      return;
    }

    wrongThisRound += 1;
    triggerVibration(30);
    if (wrongThisRound >= 2) hint = true;
    playTarget();
  }

  function finish() {
    clearTimers();
    stopAudio();
    phase = 'done';
  }

  function restart() {
    if (activeCategory) startGame(activeCategory);
  }

  function backToCategories() {
    clearTimers();
    stopAudio();
    phase = 'categories';
  }

  function categoryItems(category) {
    return category.items.length;
  }
</script>

<main>
  <div class="quiz">
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

      <h1 class="title">
        <span aria-hidden="true">👂</span> Ascolta e indovina
      </h1>

      <div class="score" aria-label={`${stars} stelle su ${roundTotal || MAX_ROUNDS}`}>
        <span aria-hidden="true">⭐</span>
        <span class="score-value">{stars}</span>
      </div>
    </header>

    {#if phase === 'categories'}
      <section class="panel" aria-label="Scegli una categoria">
        <p class="hint">Scegli un gruppo di carte, poi ascolta e tocca quella giusta</p>

        {#if loading}
          <p class="state" role="status">Caricamento…</p>
        {:else if showEmptyState}
          <p class="state">Nessuna categoria con almeno due carte ascoltabili.</p>
        {:else}
          <div class="category-grid">
            {#if allPlayable.length >= 2}
              <button class="category-card" on:click={() => startGame({ name: 'Tutte', items: allPlayable })}>
                <span class="category-emoji" aria-hidden="true">🗂️</span>
                <span class="category-name">Tutte</span>
                <span class="category-count">{allPlayable.length} carte</span>
              </button>
            {/if}

            {#each playableCategories as category}
              <button class="category-card" on:click={() => startGame(category)}>
                <span class="category-emoji" aria-hidden="true">{category.emoji || '📁'}</span>
                <span class="category-name">{category.name}</span>
                <span class="category-count">{categoryItems(category)} carte</span>
              </button>
            {/each}
          </div>
        {/if}
      </section>
    {:else if phase === 'playing'}
      <section class="panel play-panel" aria-label={`Round ${round} di ${roundTotal}`}>
        <div class="round-dots" aria-hidden="true">
          {#each Array(roundTotal) as _, index}
            <span class="round-dot" class:round-dot-on={index < round}></span>
          {/each}
        </div>

        <button
          class="speaker-button"
          class:speaker-pulse={speakerPulse}
          on:click={playTarget}
          aria-label="Ripeti il suono"
          title="Ripeti il suono"
        >
          <span aria-hidden="true">🔊</span>
        </button>

        <p class="question" aria-live="polite">
          {#if answered}Bravo!{:else if hint}È questa!{:else}Ascolta e tocca la carta giusta{/if}
        </p>

        <div class="options">
          {#each options as option}
            <button
              class="option"
              class:option-correct={answered && option.correct}
              class:option-hint={hint && option.correct && !answered}
              class:option-dim={answered && !option.correct}
              on:click={() => answer(option)}
              aria-label={option.item.name}
              data-correct={option.correct ? 'true' : 'false'}
            >
              <span class="option-image">
                <img src={option.item.image} alt="" draggable="false" />
              </span>
              <span class="option-name">{option.item.name}</span>
              {#if answered && option.correct}
                <span class="option-check" aria-hidden="true">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      </section>
    {:else if phase === 'done'}
      <section class="panel done-panel" aria-label="Fine del gioco">
        <div class="done-stars" aria-hidden="true">
          {#each Array(roundTotal) as _, index}
            <span class="done-star" class:done-star-on={index < stars}>★</span>
          {/each}
        </div>
        <h2 class="done-title">{stars} su {roundTotal}!</h2>
        <div class="done-actions">
          <button class="primary-button" on:click={restart}>Ancora</button>
          <button class="secondary-button" on:click={backToCategories}>Categorie</button>
        </div>
      </section>
    {/if}
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
    align-items: flex-start;
  }

  .quiz {
    width: 100%;
    max-width: 900px;
    padding: 1.25rem 1.5rem 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-sizing: border-box;
  }

  .top-bar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: transform 0.2s, background 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .back-button:hover {
    background: white;
    transform: translateY(-2px);
  }

  .back-button:active {
    transform: scale(0.94);
  }

  .title {
    margin: 0;
    color: white;
    font-size: clamp(1.35rem, 2.4vw, 2rem);
    font-weight: 700;
    text-align: center;
    text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
  }

  .score {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 999px;
    padding: 0.45rem 0.85rem;
    color: white;
    font-weight: 700;
    font-size: 1.1rem;
    min-width: 4.6rem;
    justify-content: center;
  }

  .score-value {
    min-width: 1ch;
    text-align: center;
  }

  .panel {
    background: rgba(255, 255, 255, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 28px;
    padding: 1.25rem;
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .hint {
    margin: 0;
    text-align: center;
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.95rem;
    font-weight: 500;
  }

  .state {
    margin: 0;
    padding: 2rem 1rem;
    text-align: center;
    color: white;
    font-size: 1.1rem;
  }

  .category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.9rem;
  }

  .category-card {
    border: none;
    background: rgba(255, 255, 255, 0.94);
    border-radius: 22px;
    padding: 1.25rem 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16);
    transition: transform 0.16s, box-shadow 0.16s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .category-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.24);
  }

  .category-card:active {
    transform: scale(0.97);
    transition-duration: 70ms;
  }

  .category-emoji {
    font-size: 2.6rem;
    line-height: 1.1;
  }

  .category-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #4c5fd0;
    text-align: center;
  }

  .category-count {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 600;
  }

  .play-panel {
    align-items: center;
  }

  .round-dots {
    display: flex;
    gap: 0.4rem;
  }

  .round-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.28);
    transition: background 0.2s, transform 0.2s;
  }

  .round-dot-on {
    background: white;
    transform: scale(1.15);
  }

  .speaker-button {
    width: 6.5rem;
    height: 6.5rem;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%);
    color: #667eea;
    font-size: 2.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.3);
    transition: transform 0.16s, box-shadow 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .speaker-button:active {
    transform: scale(0.94);
    transition-duration: 70ms;
  }

  .speaker-pulse {
    animation: speaker-pop 0.45s ease-out;
  }

  @keyframes speaker-pop {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6), 0 12px 30px rgba(15, 23, 42, 0.3); }
    60% { transform: scale(1.06); box-shadow: 0 0 0 14px rgba(255, 255, 255, 0), 0 12px 30px rgba(15, 23, 42, 0.3); }
    100% { transform: scale(1); }
  }

  .question {
    margin: 0;
    min-height: 1.5rem;
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    text-align: center;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    width: 100%;
  }

  .option {
    position: relative;
    border: 3px solid transparent;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 24px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.18);
    transition: transform 0.16s, border-color 0.16s, box-shadow 0.16s, opacity 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .option:hover {
    transform: translateY(-4px);
  }

  .option:active {
    transform: scale(0.98);
    transition-duration: 70ms;
  }

  .option-image {
    width: 100%;
    aspect-ratio: 1 / 1;
    max-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
    border-radius: 18px;
    overflow: hidden;
  }

  .option-image img {
    width: 82%;
    height: 82%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }

  .option-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #334155;
    text-align: center;
  }

  .option-correct {
    border-color: #22c55e;
    box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25), 0 10px 24px rgba(15, 23, 42, 0.2);
    transform: translateY(-4px) scale(1.02);
  }

  .option-hint {
    animation: option-hint 1s ease-in-out infinite;
  }

  @keyframes option-hint {
    0%, 100% { border-color: rgba(250, 204, 21, 0.5); box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.35); }
    50% { border-color: #facc15; box-shadow: 0 0 0 10px rgba(250, 204, 21, 0.12); }
  }

  .option-dim {
    opacity: 0.45;
  }

  .option-check {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    background: #22c55e;
    color: white;
    font-size: 1.3rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
  }

  .done-panel {
    align-items: center;
    gap: 1.5rem;
    padding: 2rem 1.25rem;
  }

  .done-stars {
    display: flex;
    gap: 0.3rem;
    font-size: 2.4rem;
    color: rgba(255, 255, 255, 0.3);
  }

  .done-star-on {
    color: #facc15;
    text-shadow: 0 0 18px rgba(250, 204, 21, 0.6);
  }

  .done-title {
    margin: 0;
    color: white;
    font-size: 2rem;
  }

  .done-actions {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .primary-button,
  .secondary-button {
    border: none;
    border-radius: 999px;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition: transform 0.14s, background 0.16s;
  }

  .primary-button {
    background: white;
    color: #4c5fd0;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.22);
  }

  .secondary-button {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.35);
  }

  .primary-button:active,
  .secondary-button:active {
    transform: scale(0.96);
  }

  @media (max-width: 640px) {
    .quiz {
      padding: 0.9rem 0.75rem 1.75rem;
      gap: 0.9rem;
    }

    .panel {
      border-radius: 22px;
      padding: 0.85rem;
      gap: 0.9rem;
    }

    .hint {
      font-size: 0.8rem;
    }

    .title {
      font-size: 1.05rem;
    }

    .score {
      min-width: 3.9rem;
      padding: 0.4rem 0.6rem;
      font-size: 1rem;
    }

    .back-button {
      width: 2.8rem;
      height: 2.8rem;
    }

    .category-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
    }

    .category-card {
      padding: 0.9rem 0.5rem;
      border-radius: 18px;
    }

    .category-emoji {
      font-size: 2rem;
    }

    .category-name {
      font-size: 0.95rem;
    }

    .speaker-button {
      width: 5.2rem;
      height: 5.2rem;
      font-size: 2.2rem;
    }

    .options {
      gap: 0.6rem;
    }

    .option {
      border-radius: 18px;
      padding: 0.5rem;
      gap: 0.35rem;
    }

    .option-name {
      font-size: 0.9rem;
    }

    .done-title {
      font-size: 1.6rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .speaker-pulse,
    .option-hint {
      animation: none;
    }

    .category-card,
    .option,
    .speaker-button,
    .round-dot,
    .primary-button,
    .secondary-button {
      transition: none;
    }
  }
</style>
