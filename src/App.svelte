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
  import { cachedQuery, dbCacheKeys, invalidateDbCache } from "./dbCache.js";
  import { settingsStore } from "./settingsStore.js";
  import { isModalOpen } from "./modalStore.js";
  import {
    findPublicCategory,
    loadPublicContent,
    publicContent,
  } from "./publicContentStore.js";
  import { applySeo, seoForRoute } from "./seo.js";

  // Storie e giochi restano contenuti dedicati, non card pubbliche.
  import { stories } from "./stories.js";
  import StoryView from "./StoryView.svelte";
  import StorySelect from "./StorySelect.svelte";
  import GamesView from "./GamesView.svelte";
  import InfoView from "./InfoView.svelte";
  import BandView from "./BandView.svelte";
  import SoundQuizView from "./SoundQuizView.svelte";
  import CalmView from "./CalmView.svelte";

  // Gli indirizzi leggibili (/animals, /verbi, ...) vengono risolti tramite
  // lo slug della categoria pubblica. Le private usano /category/<uuid>.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let currentView = "modeSelect";
  let selectedCategory = null;
  let selectedPublicCategory = null;
  let selectedUserCategory = null;
  // Card da selezionare dopo un jump tra categorie dal selettore.
  let pendingItemId = null;
  let routeCategoryId = null;
  let publicCategories = [];
  let publicContentLoaded = false;
  let publicContentLoading = false;
  let publicContentError = null;
  let previousView = "modeSelect";
  let previousPayload = null;

  let selectedCardMode = 1;
  let settings;
  settingsStore.subscribe((v) => {
    settings = v;
    if (v.cardMode) selectedCardMode = v.cardMode;
  });

  // Modal state
  let showAuthModal = false;
  let showAddCategoryModal = false;
  let showAddCardModal = false;
  let addCardCategoryId = null;

  let currentUser;
  // Pool della categoria "Casuale": card pubbliche + card personali dell'utente.
  let allUserCards = [];
  let allPublicCards = [];
  let randomItems = [];

  user.subscribe((v) => {
    currentUser = v;
    if (v) {
      settingsStore.loadFromSupabase(v.id);
      fetchAllUserCards(v);
    } else {
      allUserCards = [];
    }
  });

  publicContent.subscribe((state) => {
    publicCategories = state.categories;
    publicContentLoaded = state.loaded;
    publicContentLoading = state.loading;
    publicContentError = state.error;
    allPublicCards = state.categories.flatMap((category) => category.items);
    applyCategoryRoute();
  });

  // Un deep link /category/<id> può indicare sia una categoria pubblica sia
  // una privata. Finché le categorie pubbliche non sono caricate aspettiamo,
  // poi scegliamo la destinazione corretta.
  $: categoryRoutePending =
    Boolean(routeCategoryId) && !publicContentLoaded && !publicContentError;

  function applyCategoryRoute() {
    if (!routeCategoryId) return;
    const publicCategory = findPublicCategory(publicCategories, routeCategoryId);
    if (publicCategory) {
      selectedPublicCategory = publicCategory;
      selectedUserCategory = null;
      selectedCategory = publicCategory.id;
      currentView = "publicCategory";
      return;
    }
    if (!publicContentLoaded && !publicContentError) return;
    if (UUID_RE.test(routeCategoryId)) {
      selectedPublicCategory = null;
      selectedUserCategory = { id: routeCategoryId };
      selectedCategory = "userCategory";
      currentView = "userCategory";
      return;
    }
    // Slug pubblico inesistente: non è una categoria privata.
    routeCategoryId = null;
    selectedPublicCategory = null;
    selectedUserCategory = null;
    currentView = "modeSelect";
  }

  async function fetchAllUserCards(userArg = currentUser, force = false) {
    if (!userArg) {
      allUserCards = [];
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      allUserCards = [];
      return;
    }

    try {
      const userId = userArg.id;
      const cards = await cachedQuery(
        dbCacheKeys.allCards(userId),
        async () => {
          const { data, error } = await supabase
            .from("user_cards")
            .select("*")
            .eq("user_id", userId)
            .order("created_at");
          if (error) throw error;
          return (data || []).map((c) => ({
            id: c.id,
            name: c.name,
            image: c.image_url,
            sound: c.sound_url,
          }));
        },
        { force },
      );
      // Ignora risposte arrivate dopo logout o cambio utente.
      if (currentUser?.id === userId) allUserCards = cards;
    } catch (error) {
      console.error("All user cards fetch error:", error);
    }
  }

  // Un unico grande mazzo con tutte le card disponibili.
  $: randomItems = [...allPublicCards, ...allUserCards];

  // Title, description e canonical seguono la vista corrente: la pagina
  // /band e le categorie pubbliche devono esporre i propri metadati ai motori.
  $: applySeo(seoForRoute(currentView, selectedPublicCategory, selectedUserCategory));

  // Reactive user cards fetching
  let userCards = [];
  let loadingUserCards = false;

  // currentUser fa parte delle dipendenze: su un deep link o dopo un refresh
  // la vista categoria viene montata prima che initAuth() abbia ripristinato
  // la sessione. Senza questa dipendenza le card non venivano ricaricate.
  // Inoltre le card possono essere aggiunte fuori dall'app (upload-card.js),
  // quindi all'apertura della categoria ignoriamo la cache e rileggiamo il DB.
  $: if (currentView === "userCategory" && selectedUserCategory && currentUser) {
    fetchUserCards(selectedUserCategory.id, true);
  } else if (!currentUser) {
    userCards = [];
  }

  async function fetchUserCards(catId, force = false) {
    loadingUserCards = true;
    const supabase = getSupabase();
    if (supabase && currentUser) {
      userCards = await cachedQuery(
        dbCacheKeys.cards(currentUser.id, catId),
        async () => {
          const { data } = await supabase
            .from("user_cards")
            .select("*")
            .eq("category_id", catId)
            .order("created_at");
          return (data || []).map((c) => ({
            id: c.id,
            name: c.name,
            image: c.image_url,
            sound: c.sound_url,
          }));
        },
        { force },
      );
    } else {
      userCards = [];
    }
    loadingUserCards = false;
  }

  async function handleDeleteCard(e) {
    const { card } = e.detail;
    const supabase = getSupabase();
    if (!supabase) return;

    // Local state update
    userCards = userCards.filter((c) => c.id !== card.id);

    // DB deletion & Cache invalidation
    await supabase.from("user_cards").delete().eq("id", card.id);
    invalidateDbCache();
    fetchAllUserCards(currentUser, true);

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
    loadPublicContent().catch((error) => {
      console.error("Public content fetch error:", error);
    });
    window.addEventListener("popstate", handlePopState);
    syncViewWithUrl();
    return () => window.removeEventListener("popstate", handlePopState);
  });

  function clearCategoryRoute() {
    routeCategoryId = null;
    selectedPublicCategory = null;
    selectedUserCategory = null;
  }

  function syncViewWithUrl() {
    const path = window.location.pathname;
    if (path === "/stories") {
      clearCategoryRoute();
      currentView = "stories";
    } else if (path === "/home") {
      clearCategoryRoute();
      currentView = "home";
    } else if (path === "/random") {
      clearCategoryRoute();
      currentView = "random";
    } else if (path === "/gameshub") {
      clearCategoryRoute();
      currentView = "gameshub";
    } else if (path === "/band") {
      clearCategoryRoute();
      currentView = "band";
    } else if (path === "/ascolta") {
      clearCategoryRoute();
      currentView = "quiz";
    } else if (path === "/calma") {
      clearCategoryRoute();
      currentView = "calm";
    } else if (path === "/info") {
      clearCategoryRoute();
      currentView = "info";
    } else if (path.startsWith("/category/")) {
      const id = decodeURIComponent(path.split("/")[2] || "");
      selectedPublicCategory = null;
      selectedUserCategory = null;
      routeCategoryId = id || null;
      applyCategoryRoute();
    } else if (path.indexOf("/", 1) === -1 && path.length > 1) {
      selectedPublicCategory = null;
      selectedUserCategory = null;
      routeCategoryId = decodeURIComponent(path.slice(1));
      applyCategoryRoute();
    } else {
      clearCategoryRoute();
      currentView = "modeSelect";
    }
  }

  function handlePopState() {
    pendingItemId = null;
    syncViewWithUrl();
  }

  function categoryPath(category) {
    if (category.slug) return `/${category.slug}`;
    return `/category/${category.id}`;
  }

  function navigate(view, payload = null) {
    if (view !== "publicCategory" && view !== "userCategory") {
      pendingItemId = null;
    }
    let path = "/";
    if (view === "home") path = "/home";
    else if (view === "random") path = "/random";
    else if (view === "stories") path = "/stories";
    else if (view === "gameshub") path = "/gameshub";
    else if (view === "band") path = "/band";
    else if (view === "quiz") path = "/ascolta";
    else if (view === "calm") path = "/calma";
    else if (view === "info") path = "/info";
    else if (view === "publicCategory" && payload)
      path = categoryPath(payload);
    else if (view === "userCategory" && payload)
      path = `/category/${payload.id}`;

    if (view === "publicCategory" || view === "userCategory") {
      routeCategoryId = payload?.id ?? null;
    } else {
      routeCategoryId = null;
    }

    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    if (currentView !== "info") {
      previousView = currentView;
      previousPayload =
        currentView === "publicCategory"
          ? selectedPublicCategory
          : currentView === "userCategory"
            ? selectedUserCategory
            : null;
    }
    currentView = view;

    if (view === "publicCategory") {
      selectedPublicCategory = payload;
      selectedUserCategory = null;
      selectedCategory = payload?.id ?? null;
    } else if (view === "userCategory") {
      selectedUserCategory = payload;
      selectedPublicCategory = null;
      selectedCategory = "userCategory";
    }
  }

  function handleModeSelect(event) {
    const mode = event.detail;
    if (mode === "stories") {
      navigate("stories");
    } else if (mode === "games") {
      navigate("gameshub");
    } else if (mode === "band") {
      navigate("band");
    } else if (mode === "quiz") {
      navigate("quiz");
    } else if (mode === "calm") {
      navigate("calm");
    } else {
      selectedCardMode = mode;
      settingsStore.updateSettings({ cardMode: mode }, currentUser?.id);
      navigate("home");
    }
  }

  function handleCategorySelect(event) {
    const { categoryId } = event.detail;
    pendingItemId = null;
    if (categoryId === "random") {
      selectedCategory = "random";
      selectedPublicCategory = null;
      selectedUserCategory = null;
      navigate("random");
      return;
    }
    const publicCategory = findPublicCategory(publicCategories, categoryId);
    if (publicCategory) {
      navigate("publicCategory", publicCategory);
    }
  }

  function handleUserCategorySelect(event) {
    const { category } = event.detail;
    pendingItemId = null;
    navigate("userCategory", category);
  }

  function handleBack() {
    selectedCategory = null;
    clearCategoryRoute();
    navigate("home");
  }

  function handleBackToMode() {
    navigate("modeSelect");
  }

  function handleJumpTo(e) {
    const { category, item } = e.detail;
    if (category === "random") {
      selectedCategory = "random";
      clearCategoryRoute();
      navigate("random");
      return;
    }
    if (category === "stories") {
      selectedCategory = "stories";
      clearCategoryRoute();
      navigate("stories");
      return;
    }
    pendingItemId = item?.id ?? null;
    const publicCategory = findPublicCategory(publicCategories, category);
    if (publicCategory) {
      navigate("publicCategory", publicCategory);
      return;
    }
    navigate("userCategory", { id: category });
  }

  function handleInitialItemApplied(e) {
    if (pendingItemId === e.detail.id) pendingItemId = null;
  }

  function handleShowAuth() {
    showAuthModal = true;
    isModalOpen.set(true);
  }

  function handleOpenInfo() {
    navigate("info");
  }

  function handleAddCategory() {
    showAddCategoryModal = true;
    isModalOpen.set(true);
  }

  function handleCategorySaved() {
    invalidateDbCache();
    showAddCategoryModal = false;
    isModalOpen.set(false);
    currentView = "";
    setTimeout(() => {
      currentView = "home";
    }, 0);
  }

  function handleAddCard() {
    addCardCategoryId = selectedUserCategory?.id;
    showAddCardModal = true;
    isModalOpen.set(true);
  }

  function handleCardSaved() {
    invalidateDbCache();
    showAddCardModal = false;
    isModalOpen.set(false);
    fetchAllUserCards(currentUser, true);
    const cat = selectedUserCategory;
    currentView = "";
    setTimeout(() => {
      selectedUserCategory = cat;
      selectedCategory = "userCategory";
      currentView = "userCategory";
    }, 0);
  }
  function handleCardEdited() {
    invalidateDbCache();
    // Re-fetch cards so the updated card data is shown
    if (selectedUserCategory) {
      fetchUserCards(selectedUserCategory.id, true);
    }
    fetchAllUserCards(currentUser, true);
  }
</script>

{#if currentView === "modeSelect"}
  <ModeSelect
    {currentUser}
    on:select={handleModeSelect}
    on:showAuth={handleShowAuth}
    on:openInfo={handleOpenInfo}
  />
{:else if currentView === "info"}
  <InfoView on:back={() => navigate(previousView, previousPayload)} />
{:else if currentView === "home"}
  <Home
    on:select={handleCategorySelect}
    on:selectUserCategory={handleUserCategorySelect}
    on:showAuth={handleShowAuth}
    on:addCategory={handleAddCategory}
    on:back={handleBackToMode}
    publicCategories={publicCategories}
    loadingPublic={publicContentLoading}
    publicError={publicContentError}
    {randomItems}
  />
{:else if categoryRoutePending}
  <div class="route-loading" role="status">Caricamento…</div>
{:else if currentView === "publicCategory"}
  <CategoryView
    items={selectedPublicCategory?.items || []}
    categoryId={selectedPublicCategory?.id}
    loading={publicContentLoading}
    cardMode={selectedCardMode}
    cardNavMode={settings.cardNavMode}
    initialItemId={pendingItemId}
    on:back={handleBack}
    on:setNavMode={(e) =>
      settingsStore.updateSettings({ cardNavMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
    on:initialItemApplied={handleInitialItemApplied}
  />
{:else if currentView === "random"}
  <CategoryView
    items={randomItems}
    categoryKey="random"
    cardMode={selectedCardMode}
    cardNavMode={settings.cardNavMode}
    preloadCount={24}
    on:back={handleBack}
    on:setNavMode={(e) =>
      settingsStore.updateSettings({ cardNavMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
  />
{:else if currentView === "gameshub"}
  <GamesView
    on:back={handleBackToMode}
  />
{:else if currentView === "band"}
  <BandView on:back={handleBackToMode} />
{:else if currentView === "quiz"}
  <SoundQuizView
    categories={publicCategories}
    loading={publicContentLoading}
    on:back={handleBackToMode}
  />
{:else if currentView === "calm"}
  <CalmView on:back={handleBackToMode} />
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
    cardNavMode={settings.cardNavMode}
    initialItemId={pendingItemId}
    on:back={handleBack}
    on:addCard={handleAddCard}
    on:deleteCard={handleDeleteCard}
    on:cardEdited={handleCardEdited}
    on:setNavMode={(e) =>
      settingsStore.updateSettings({ cardNavMode: e.detail }, currentUser?.id)}
    on:jumpTo={handleJumpTo}
    on:initialItemApplied={handleInitialItemApplied}
  />
{/if}

<!-- Modals (overlays, always on top) -->
{#if showAuthModal}
  <AuthModal
    on:close={() => {
      showAuthModal = false;
      isModalOpen.set(false);
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
    on:close={() => { showAddCategoryModal = false; isModalOpen.set(false); }}
    on:saved={handleCategorySaved}
  />
{/if}

{#if showAddCardModal}
  <AddCardModal
    categoryId={addCardCategoryId}
    on:close={() => { showAddCardModal = false; isModalOpen.set(false); }}
    on:saved={handleCardSaved}
  />
{/if}

<style>
  .route-loading {
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #667eea;
    color: white;
    font-size: 1.4rem;
    font-weight: bold;
  }

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
