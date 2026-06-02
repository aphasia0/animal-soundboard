<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { animals } from './animals.js';
  import { resumeAudioContext, playRewardSound } from './audioUtils.js';
  import { fly } from 'svelte/transition';

  const dispatch = createEventDispatcher();

  const MAX_LEVEL = 10;
  let level = 1;
  let animal;
  let size = 0;
  let posX = 0;
  let posY = 0;
  let winW = 0;
  let winH = 0;
  let done = false;
  let animating = false;

  function calcSize(l, vw, vh) {
    const m = Math.min(vw, vh);
    const minS = m * 0.08;
    const maxS = m * 0.33;
    const t = (l - 1) / (MAX_LEVEL - 1);
    return maxS - (maxS - minS) * t;
  }

  function randomPos(s, vw, vh, pad = 10) {
    return {
      x: Math.random() * Math.max(vw - s - pad * 2, 0) + pad,
      y: Math.random() * Math.max(vh - s - pad * 2, 0) + pad
    };
  }

  function setup() {
    winW = window.innerWidth;
    winH = window.innerHeight;
    size = calcSize(level, winW, winH);
    const p = randomPos(size, winW, winH);
    posX = p.x;
    posY = p.y;
  }

  function pickAnimal() {
    const others = animals.filter(a => !animal || a.id !== animal.id);
    animal = others[Math.floor(Math.random() * others.length)];
  }

  onMount(() => {
    pickAnimal();
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  });

  async function tap() {
    if (animating || done) return;
    animating = true;
    await resumeAudioContext();
    playRewardSound();
    if (level >= MAX_LEVEL) {
      setTimeout(() => { done = true; animating = false; }, 300);
    } else {
      level++;
      pickAnimal();
      setTimeout(() => { setup(); animating = false; }, 200);
    }
  }

  function restart() {
    level = 1;
    done = false;
    pickAnimal();
    setup();
  }
</script>

<main class="game-area" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  {#if done}
    <div class="celebration" in:fly={{ y: 80, duration: 600 }}>
      <div class="star">⭐</div>
      <h1>Complimenti!</h1>
      <p>Hai completato tutti i {MAX_LEVEL} livelli!</p>
      <button class="btn" on:click={restart}>Gioca ancora</button>
      <button class="btn secondary" on:click={() => dispatch('back')}>Indietro</button>
    </div>
  {:else}
    <div
      class="box"
      role="button"
      tabindex="0"
      on:click={tap}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') tap(); }}
      style="
        width: {size}px;
        height: {size}px;
        left: {posX}px;
        top: {posY}px;
      "
    >
      {#if animal}
        <img
          src="/{animal.image.replace('animals/', 'animals-nocircle/')}"
          alt={animal.name}
          class="animal-img"
          style="width: {size * 0.6}px; height: {size * 0.6}px;"
        />
      {/if}
    </div>

    <div class="hud">
      <button class="back-btn" on:click={() => dispatch('back')} title="Indietro">
        ←
      </button>
      <div class="level">Livello {level}/{MAX_LEVEL}</div>
    </div>
  {/if}
</main>

<style>
  .game-area {
    width: 100vw;
    height: 100dvh;
    height: 100vh;
    overflow: hidden;
    position: relative;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }

  .box {
    position: absolute;
    background: linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #9b59b6);
    background-size: 400% 400%;
    animation: rainbow 3s ease infinite;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 3px solid rgba(255, 255, 255, 0.5);
    z-index: 10;
    touch-action: manipulation;
  }

  .box:active {
    transform: scale(0.95);
  }

  @keyframes rainbow {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .animal-img {
    object-fit: contain;
    pointer-events: none;
    filter: brightness(1.1);
  }

  .hud {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    z-index: 100;
    pointer-events: none;
  }

  .back-btn {
    pointer-events: auto;
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
    font-size: 1.5rem;
    font-weight: bold;
  }

  .level {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 15px;
    padding: 0.6rem 1.2rem;
    font-size: 1.2rem;
    font-weight: bold;
    color: #667eea;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .celebration {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    text-align: center;
    gap: 1rem;
    padding: 2rem;
  }

  .celebration .star {
    font-size: 5rem;
    animation: bounce 0.6s ease infinite alternate;
  }

  @keyframes bounce {
    from { transform: translateY(0); }
    to { transform: translateY(-15px); }
  }

  .celebration h1 {
    font-size: 3rem;
    margin: 0;
    text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
  }

  .celebration p {
    font-size: 1.3rem;
    margin: 0;
    opacity: 0.9;
  }

  .btn {
    background: white;
    color: #667eea;
    border: none;
    border-radius: 15px;
    padding: 1rem 2.5rem;
    font-size: 1.3rem;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    min-width: 200px;
    transition: all 0.2s;
  }

  .btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  }

  .btn.secondary {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
</style>
