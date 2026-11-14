import { get, writable } from "svelte/store";
import { getSupabase } from "./supabaseClient.js";
import { cachedQuery, dbCacheKeys } from "./dbCache.js";

const initialState = {
  categories: [],
  cards: [],
  loading: false,
  loaded: false,
  error: null,
};

export const publicContent = writable(initialState);

let inFlight = null;

function normalize(categories, cards) {
  const byCategory = new Map();
  for (const card of cards) {
    const items = byCategory.get(card.category_id) || [];
    items.push({
      id: card.id,
      name: card.name,
      image: card.image_url,
      sound: card.sound_url,
    });
    byCategory.set(card.category_id, items);
  }

  return categories.map((category) => {
    const items = byCategory.get(category.id) || [];
    return {
      id: category.id,
      slug: category.slug || null,
      name: category.name,
      label: category.name,
      emoji: category.emoji || "📁",
      sortOrder: category.sort_order || 0,
      cardCount: items.length,
      items,
    };
  });
}

export async function loadPublicContent({ force = false } = {}) {
  if (inFlight) return inFlight;
  const current = get(publicContent);
  if (current.loaded && !force) return current.categories;

  const promise = (async () => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Client Supabase non disponibile");

    publicContent.update((state) => ({ ...state, loading: true, error: null }));
    try {
      const [categories, cards] = await Promise.all([
        cachedQuery(
          dbCacheKeys.publicCategories(),
          async () => {
            const { data, error } = await supabase
              .from("soundpad_public_categories")
              .select("*")
              .order("sort_order", { ascending: true })
              .order("created_at", { ascending: true });
            if (error) throw error;
            return data || [];
          },
          { force },
        ),
        cachedQuery(
          dbCacheKeys.publicCards(),
          async () => {
            const { data, error } = await supabase
              .from("soundpad_public_cards")
              .select("id,category_id,name,image_url,sound_url,created_at")
              .order("created_at", { ascending: true });
            if (error) throw error;
            return data || [];
          },
          { force },
        ),
      ]);

      const normalized = normalize(categories, cards);
      publicContent.set({
        categories: normalized,
        cards,
        loading: false,
        loaded: true,
        error: null,
      });
      return normalized;
    } catch (error) {
      publicContent.update((state) => ({
        ...state,
        loading: false,
        loaded: false,
        error,
      }));
      throw error;
    } finally {
      if (inFlight === promise) inFlight = null;
    }
  })();

  inFlight = promise;
  return promise;
}

export function findPublicCategory(categories, reference) {
  if (!reference) return null;
  return (
    categories.find((category) => category.id === reference) ||
    categories.find((category) => category.slug === reference) ||
    null
  );
}
