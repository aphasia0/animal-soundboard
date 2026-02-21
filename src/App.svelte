<script>
  import { onMount } from "svelte";
  import Home from "./Home.svelte";
  import Animals from "./Animals.svelte";
  import Work from "./Work.svelte";
  import Music from "./Music.svelte";
  import People from "./People.svelte";
  import Sentences from "./Sentences.svelte";
  import UserCategory from "./UserCategory.svelte";
  import AuthModal from "./AuthModal.svelte";
  import AddCategoryModal from "./AddCategoryModal.svelte";
  import AddCardModal from "./AddCardModal.svelte";
  import { initAuth, user } from "./authStore.js";

  let currentView = "home";
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

  onMount(() => {
    initAuth();
  });

  function handleCategorySelect(event) {
    const { categoryId, cardMode } = event.detail;
    selectedCategory = categoryId;
    selectedCardMode = cardMode;
    currentView = categoryId;
  }

  function handleUserCategorySelect(event) {
    const { category, cardMode } = event.detail;
    selectedUserCategory = category;
    selectedCategory = "userCategory";
    selectedCardMode = cardMode;
    currentView = "userCategory";
  }

  function handleBack() {
    currentView = "home";
    selectedCategory = null;
    selectedCardMode = 1;
    selectedUserCategory = null;
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
    const targetView = viewMap[category];
    if (targetView) {
      selectedCategory = targetView;
      currentView = targetView;
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

{#if currentView === "home"}
  <Home
    on:select={handleCategorySelect}
    on:selectUserCategory={handleUserCategorySelect}
    on:showAuth={handleShowAuth}
    on:addCategory={handleAddCategory}
  />
{:else if currentView === "animals"}
  <Animals
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
    cardMode={selectedCardMode}
  />
{:else if currentView === "work"}
  <Work
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
    cardMode={selectedCardMode}
  />
{:else if currentView === "music"}
  <Music
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
    cardMode={selectedCardMode}
  />
{:else if currentView === "people"}
  <People
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
    cardMode={selectedCardMode}
  />
{:else if currentView === "sentences"}
  <Sentences
    on:back={handleBack}
    on:jumpTo={handleJumpTo}
    cardMode={selectedCardMode}
  />
{:else if currentView === "userCategory"}
  <UserCategory
    on:back={handleBack}
    on:addCard={handleAddCard}
    on:jumpTo={handleJumpTo}
    categoryId={selectedUserCategory?.id}
    cardMode={selectedCardMode}
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
