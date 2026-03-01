<script>
  import { onMount } from "svelte";
  import ModeSelect from "./ModeSelect.svelte";
  import Home from "./Home.svelte";
  import CategoryView from "./CategoryView.svelte";
  import AuthModal from "./AuthModal.svelte";
  import AddCategoryModal from "./AddCategoryModal.svelte";
  import AddCardModal from "./AddCardModal.svelte";
  import { initAuth, user } from "./authStore.js";
  import { getSupabase } from "./supabaseClient.js";
  import { settingsStore } from "./settingsStore.js";

  // Data imports
  import { animals } from "./animals.js";
  import { jobs } from "./jobs.js";
  import { music } from "./music.js";
  import { people } from "./people.js";
  import { sentences } from "./sentences.js";
  import { stories } from "./stories.js";
  import StoryView from "./StoryView.svelte";
  import StorySelect from "./StorySelect.svelte";
  import {
    getAnimalName,
    getJobName,
    getMusicName,
    getPersonName,
    getSentenceName,
  } from "./i18n.js";

  let currentView = "modeSelect";
  let selectedCategory = null;
  let selectedUserCategory = null;

  let selectedCardMode = 1;
  let settings;
  settingsStore.subscribe((v) => {
    settings = v;
    if (v.cardMode) selectedCardMode = v.cardMode;
    // Auto-skip mode select if settings are present and we are at the start
    if (v.hasSettings && currentView === "modeSelect") {
      currentView = "home";
    }
  });

  // Modal state
  let showAuthModal = false;
  let showAddCategoryModal = false;
  let showAddCardModal = false;
  let addCardCategoryId = null;

  let currentUser;
  user.subscribe((v) => {
    currentUser = v;
    if (v) {
      settingsStore.loadFromSupabase(v.id);
    }
  });

  const locale = "it";

  // Normalized data for native categories
  $: animalsItems = animals.map((a) => ({
    id: a.id,
    key: a.key,
    name: getAnimalName(a.key, locale),
    image: a.image,
    sound: a.sound,
  }));
  $: jobsItems = jobs.map((j) => ({
    id: j.id,
    key: j.key,
    name: getJobName(j.key, locale),
    image: j.image,
    sound: j.sound,
  }));
  $: musicItems = music.map((m) => ({
    id: m.id,
    key: m.key,
    name: getMusicName(m.key, locale),
    image: m.image,
    sound: m.sound,
  }));
  $: peopleItems = people.map((p) => ({
    id: p.id,
    key: p.key,
    name: getPersonName(p.key, locale),
    image: p.image,
    sound: p.sound,
  }));
  $: sentencesItems = sentences.map((s) => ({
    id: s.id,
    key: s.key,
    name: getSentenceName(s.key, locale),
    image: s.image,
    sound: s.sound,
  }));

  // Reactive user cards fetching
  let userCards = [];
  let loadingUserCards = false;

  $: if (currentView === "userCategory" && selectedUserCategory) {
    fetchUserCards(selectedUserCategory.id);
  }

  async function fetchUserCards(catId) {
    loadingUserCards = true;
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("user_cards")
        .select("*")
        .eq("category_id", catId)
        .order("created_at");
      userCards = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image_url,
        sound: c.sound_url,
      }));
    }
    loadingUserCards = false;
  }

  async function handleDeleteCard(e) {
    const { card } = e.detail;
    const supabase = getSupabase();
    if (!supabase) return;

    // Local state update
    userCards = userCards.filter((c) => c.id !== card.id);

    // DB deletion
    await supabase.from("user_cards").delete().eq("id", card.id);

    // Storage cleanup
    try {
      if (card.image && card.image.includes("/public/card-images/")) {
        const imgPath = card.image.split("/public/card-images/")[1];
        if (imgPath)
          await supabase.storage.from("card-images").remove([imgPath]);
      }
      if (card.sound && card.sound.includes("/public/card-sounds/")) {
        const sndPath = card.sound.split("/public/card-sounds/")[1];
        if (sndPath)
          await supabase.storage.from("card-sounds").remove([sndPath]);
      }
    } catch (e) {
      console.error("Storage cleanup failed:", e);
    }
  }

  onMount(() => {
    initAuth();
  });

  function handleModeSelect(event) {
    const mode = event.detail;
    if (mode === "stories") {
      currentView = "stories";
    } else {
      selectedCardMode = mode;
      settingsStore.updateSettings({ cardMode: mode }, currentUser?.id);
      currentView = "home";
    }
  }

  function handleCategorySelect(event) {
    const { categoryId } = event.detail;
    selectedCategory = categoryId;
    currentView = categoryId;
  }

  function handleUserCategorySelect(event) {
    const { category } = event.detail;
    selectedUserCategory = category;
    selectedCategory = "userCategory";
    currentView = "userCategory";
  }

  function handleBack() {
    currentView = "home";
    selectedCategory = null;
    selectedUserCategory = null;
  }

  function handleBackToMode() {
    currentView = "modeSelect";
  }

  function handleJumpTo(e) {
    const { category } = e.detail;
    const viewMap = {
      animals: "animals",
      work: "work",
      music: "music",
      people: "people",
      sentences: "sentences",
      stories: "stories",
    };
    if (viewMap[category]) {
      selectedCategory = viewMap[category];
      currentView = viewMap[category];
      selectedUserCategory = null;
    } else {
      // Must be a custom category UUID
      selectedUserCategory = { id: category };
      selectedCategory = "userCategory";
      currentView = "userCategory";
    }
  }

  function handleShowAuth() {
    showAuthModal = true;
  }

  function handleAddCategory() {
    showAddCategoryModal = true;
  }

  function handleCategorySaved() {
    showAddCategoryModal = false;
    currentView = "";
    setTimeout(() => {
      currentView = "home";
    }, 0);
  }

  function handleAddCard() {
    addCardCategoryId = selectedUserCategory?.id;
    showAddCardModal = true;
  }

  function handleCardSaved() {
    showAddCardModal = false;
    const cat = selectedUserCategory;
    currentView = "";
    setTimeout(() => {
      selectedUserCategory = cat;
      selectedCategory = "userCategory";
      currentView = "userCategory";
    }, 0);
  }
  function handleCardEdited() {
    // Re-fetch cards so the updated card data is shown
    if (selectedUserCategory) {
      fetchUserCards(selectedUserCategory.id);
    }
  }
</script>

{#if currentView === "modeSelect"}
  <ModeSelect on:select={handleModeSelect} />
{:else if currentView === "home"}
  <Home
    on:select={handleCategorySelect}
    on:selectUserCategory={handleUserCategorySelect}
    on:showAuth={handleShowAuth}
    on:addCategory={handleAddCategory}
    on:back={handleBackToMode}
  />
{:else if currentView === "animals"}
  <CategoryView
    items={animalsItems}
    categoryKey="animals"
    cardMode={selectedCardMode}
    shuffleMode={settings.shuffleMode}
    on:back={handleBack}
    on:toggleShuffle={(e) =>
      settingsStore.updateSettings({ shuffleMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "work"}
  <CategoryView
    items={jobsItems}
    categoryKey="work"
    cardMode={selectedCardMode}
    shuffleMode={settings.shuffleMode}
    on:back={handleBack}
    on:toggleShuffle={(e) =>
      settingsStore.updateSettings({ shuffleMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "music"}
  <CategoryView
    items={musicItems}
    categoryKey="music"
    cardMode={selectedCardMode}
    shuffleMode={settings.shuffleMode}
    on:back={handleBack}
    on:toggleShuffle={(e) =>
      settingsStore.updateSettings({ shuffleMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "people"}
  <CategoryView
    items={peopleItems}
    categoryKey="people"
    cardMode={selectedCardMode}
    shuffleMode={settings.shuffleMode}
    on:back={handleBack}
    on:toggleShuffle={(e) =>
      settingsStore.updateSettings({ shuffleMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "sentences"}
  <CategoryView
    items={sentencesItems}
    categoryKey="sentences"
    cardMode={selectedCardMode}
    shuffleMode={settings.shuffleMode}
    on:back={handleBack}
    on:toggleShuffle={(e) =>
      settingsStore.updateSettings({ shuffleMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "stories"}
  <StorySelect
    on:back={handleBack}
    on:select={(e) => {
      selectedCategory = e.detail.story;
      currentView = "playingStory";
    }}
  />
{:else if currentView === "playingStory"}
  <StoryView
    story={selectedCategory}
    on:back={() => {
      currentView = "stories";
    }}
  />
{:else if currentView === "userCategory"}
  <CategoryView
    items={userCards}
    categoryId={selectedUserCategory?.id}
    isUserCategory={true}
    loading={loadingUserCards}
    cardMode={selectedCardMode}
    shuffleMode={settings.shuffleMode}
    on:back={handleBack}
    on:addCard={handleAddCard}
    on:deleteCard={handleDeleteCard}
    on:cardEdited={handleCardEdited}
    on:toggleShuffle={(e) =>
      settingsStore.updateSettings({ shuffleMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
  />
{/if}

<!-- Modals (overlays, always on top) -->
{#if showAuthModal}
  <AuthModal
    on:close={() => {
      showAuthModal = false;
      if (currentView === "home") {
        currentView = "";
        setTimeout(() => {
          currentView = "home";
        }, 0);
      }
    }}
  />
{/if}

{#if showAddCategoryModal}
  <AddCategoryModal
    on:close={() => (showAddCategoryModal = false)}
    on:saved={handleCategorySaved}
  />
{/if}

{#if showAddCardModal}
  <AddCardModal
    categoryId={addCardCategoryId}
    on:close={() => (showAddCardModal = false)}
    on:saved={handleCardSaved}
  />
{/if}

<style>
  :global([data-tooltip]) {
    position: relative;
  }

  :global([data-tooltip]::before) {
    content: attr(data-tooltip);
    position: absolute;
    top: 125%;
    left: 50%;
    transform: translateX(-50%) translateY(-8px);
    padding: 0.6rem 0.9rem;
    background: rgba(15, 23, 42, 0.95);
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 10px;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    pointer-events: none;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
  }

  :global([data-tooltip]::after) {
    content: "";
    position: absolute;
    top: 115%;
    left: 50%;
    transform: translateX(-50%) translateY(-8px);
    border: 6px solid transparent;
    border-bottom-color: rgba(15, 23, 42, 0.95);
    opacity: 0;
    visibility: hidden;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    pointer-events: none;
  }

  :global([data-tooltip]:hover::before),
  :global([data-tooltip]:hover::after) {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }

  /* Responsive adjustment for tooltips on mobile */
  @media (max-width: 768px) {
    :global([data-tooltip]::before),
    :global([data-tooltip]::after) {
      display: none !important;
    }
  }
</style>
