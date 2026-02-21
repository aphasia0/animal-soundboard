<script>
  import Home from "./Home.svelte";
  import Animals from "./Animals.svelte";
  import Work from "./Work.svelte";
  import Music from "./Music.svelte";
  import People from "./People.svelte";
  import Sentences from "./Sentences.svelte";

  let currentView = "home"; // 'home', 'animals', 'work', 'music', 'people', or 'sentences'

  function handleCategorySelect(event) {
    const category = event.detail;
    if (category === "animals") {
      currentView = "animals";
    } else if (category === "work") {
      currentView = "work";
    } else if (category === "music") {
      currentView = "music";
    } else if (category === "people") {
      currentView = "people";
    } else if (category === "sentences") {
      currentView = "sentences";
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
{:else if currentView === "people"}
  <People on:back={handleBack} />
{:else if currentView === "sentences"}
  <Sentences on:back={handleBack} />
{/if}
