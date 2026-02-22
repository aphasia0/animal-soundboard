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

  // Data imports
  import { animals } from "./animals.js";
  import { jobs } from "./jobs.js";
  import { music } from "./music.js";
  import { people } from "./people.js";
  import { sentences } from "./sentences.js";
  import {
    getAnimalName,
    getJobName,
    getMusicName,
    getPersonName,
    getSentenceName,
  } from "./i18n.js";

  let currentView = "modeSelect";
  let selectedCategory = null;
  let selectedCardMode = 1;
  let selectedUserCategory = null;

  // Modal state
  let showAuthModal = false;
  let showAddCategoryModal = false;
  let showAddCardModal = false;
  let addCardCategoryId = null;

  let currentUser;
  user.subscribe((v) => (currentUser = v));

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
    selectedCardMode = event.detail;
    currentView = "home";
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
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "work"}
  <CategoryView
    items={jobsItems}
    categoryKey="work"
    cardMode={selectedCardMode}
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "music"}
  <CategoryView
    items={musicItems}
    categoryKey="music"
    cardMode={selectedCardMode}
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "people"}
  <CategoryView
    items={peopleItems}
    categoryKey="people"
    cardMode={selectedCardMode}
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "sentences"}
  <CategoryView
    items={sentencesItems}
    categoryKey="sentences"
    cardMode={selectedCardMode}
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "userCategory"}
  <CategoryView
    items={userCards}
    categoryId={selectedUserCategory?.id}
    isUserCategory={true}
    loading={loadingUserCards}
    cardMode={selectedCardMode}
    on:back={handleBack}
    on:addCard={handleAddCard}
    on:deleteCard={handleDeleteCard}
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
