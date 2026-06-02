<script>
  import { createEventDispatcher } from 'svelte';
  import { triggerVibration } from './audioUtils.js';
  import { fly } from 'svelte/transition';
  import TouchTheBox from './TouchTheBox.svelte';
  import MuoviLaScatola from './MuoviLaScatola.svelte';

  const dispatch = createEventDispatcher();

  let currentGame = null;

  const games = [
    {
      id: 'touchthebox',
      name: 'Tocca la Scatola',
      emoji: '📦',
      description: 'Tocca la scatola che si rimpicciolisce!'
    },
    {
      id: 'muovilascatola',
      name: 'Muovi la Scatola',
      emoji: '🏠',
      description: 'Trascina la scatola nella casetta!'
    }
  ];

  function selectGame(id) {
    triggerVibration(60);
    currentGame = id;
  }

  function goBack() {
    if (currentGame) {
      currentGame = null;
    } else {
      dispatch('back');
    }
  }
</script>

{#if currentGame === 'touchthebox'}
  <TouchTheBox on:back={goBack} />
{:else if currentGame === 'muovilascatola'}
  <MuoviLaScatola on:back={goBack} />
{:else}
  <main>
    <div class="games-view">
      <div class="top-nav">
        <button class="back-button" on:click={goBack} title="Indietro">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
      </div>

      <h3 class="title" in:fly={{ y: 30, duration: 500 }}>Giochi</h3>

      <div class="grid">
        {#each games as game, i}
          <button
            class="card"
            on:click={() => selectGame(game.id)}
            in:fly={{ y: 50, duration: 600, delay: i * 100 }}
          >
            <div class="emoji">{game.emoji}</div>
            <div class="name">{game.name}</div>
            <div class="description">{game.description}</div>
          </button>
        {/each}
      </div>
    </div>
  </main>
{/if}

<style>
  main {
    width: 100vw;
    height: 100dvh;
    height: 100vh;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  .games-view {
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 2rem;
    padding-bottom: calc(2rem + env(safe-area-inset-bottom));
    box-sizing: border-box;
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

  .title {
    color: white;
    font-size: 3rem;
    font-weight: bold;
    margin-top: 1rem;
    margin-bottom: 2rem;
    text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
    text-align: center;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
    max-width: 800px;
    width: 100%;
    padding-bottom: 2rem;
  }

  .card {
    background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
    border: none;
    border-radius: 30px;
    padding: 3rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    min-height: 250px;
    user-select: none;
    -webkit-user-select: none;
  }

  .card:hover {
    transform: translateY(-10px) scale(1.05);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .card:active {
    transform: translateY(-5px) scale(1.02);
  }

  .emoji {
    font-size: 6rem;
    margin-bottom: 1rem;
    line-height: 1;
  }

  .name {
    font-size: 2rem;
    font-weight: bold;
    color: #667eea;
    margin-bottom: 0.5rem;
    text-align: center;
  }

  .description {
    font-size: 1.2rem;
    color: #666;
    text-align: center;
  }

  @media (max-width: 768px) {
    .title {
      font-size: 2rem;
      margin-bottom: 1.5rem;
    }

    .grid {
      gap: 1rem;
      max-width: 400px;
    }

    .card {
      padding: 2rem 1rem;
      min-height: 200px;
      border-radius: 20px;
    }

    .emoji {
      font-size: 4rem;
    }

    .name {
      font-size: 1.5rem;
    }

    .description {
      font-size: 1rem;
    }

    .games-view {
      padding: 1rem;
      padding-bottom: calc(1rem + env(safe-area-inset-bottom));
    }
  }
</style>
