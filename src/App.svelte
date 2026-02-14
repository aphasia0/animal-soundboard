<script>
  import Home from "./Home.svelte";
  import Animals from "./Animals.svelte";
  import Work from "./Work.svelte";
  import Music from "./Music.svelte";

  let currentView = "home"; // 'home', 'animals', 'work', or 'music'

  function handleCategorySelect(event) {
    const category = event.detail;
    if (category === "animals") {
      currentView = "animals";
    } else if (category === "work") {
      currentView = "work";
    } else if (category === "music") {
      currentView = "music";
    }
  }

  function handleBack() {
    currentView = "home";
  }
</script>

{#if currentView === "home"}
  <Home on:select={handleCategorySelect} />
{:else if currentView === "animals"}
  <Animals on:back={handleBack} />
{:else if currentView === "work"}
  <Work on:back={handleBack} />
{:else if currentView === "music"}
  <Music on:back={handleBack} />
{/if}
