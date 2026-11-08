// Cache applicativo per le query al database (categorie e card).
//
// Le liste vengono salvate in localStorage con un timestamp e riutilizzate per
// un'ora, così aprire una categoria più volte non riscarica le stesse card.
// Da InfoView è possibile svuotare la cache per vedere subito le modifiche
// fatte direttamente dal database.

const CACHE_PREFIX = "soundpad:db-cache:v1:";
export const DB_CACHE_TTL_MS = 60 * 60 * 1000; // 1 ora

function storageAvailable() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function readEntry(scope) {
  if (!storageAvailable()) return { hit: false, data: null };
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + scope);
    if (!raw) return { hit: false, data: null };

    const entry = JSON.parse(raw);
    const fresh =
      entry &&
      typeof entry.ts === "number" &&
      Date.now() - entry.ts < DB_CACHE_TTL_MS;

    if (!fresh) {
      localStorage.removeItem(CACHE_PREFIX + scope);
      return { hit: false, data: null };
    }
    return { hit: true, data: entry.data };
  } catch {
    return { hit: false, data: null };
  }
}

function writeEntry(scope, data) {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(
      CACHE_PREFIX + scope,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    // Quota piena o storage non disponibile: la cache è solo un'ottimizzazione.
  }
}

// Evita richieste duplicate quando più componenti chiedono la stessa lista
// nello stesso momento (es. Home e CardSelector al mount).
const inFlight = new Map();

/**
 * Esegue `fetcher` solo se non esiste una risposta in cache ancora valida.
 * Con `{ force: true }` ignora la cache e riscarica.
 */
export async function cachedQuery(scope, fetcher, { force = false } = {}) {
  if (!force) {
    const entry = readEntry(scope);
    if (entry.hit) return entry.data;
    if (inFlight.has(scope)) return inFlight.get(scope);
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      writeEntry(scope, data);
      return data;
    } finally {
      if (inFlight.get(scope) === promise) inFlight.delete(scope);
    }
  })();

  inFlight.set(scope, promise);
  return promise;
}

/** Cancella tutte le risposte salvate (usato anche dal tasto in InfoView). */
export function invalidateDbCache() {
  if (!storageAvailable()) return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  inFlight.clear();
}

/** Stato della cache, mostrato in InfoView. */
export function getDbCacheStatus() {
  if (!storageAvailable()) {
    return { count: 0, newest: null, ttlMs: DB_CACHE_TTL_MS };
  }

  let count = 0;
  let newest = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(CACHE_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      if (
        entry &&
        typeof entry.ts === "number" &&
        Date.now() - entry.ts < DB_CACHE_TTL_MS
      ) {
        count++;
        if (newest === null || entry.ts > newest) newest = entry.ts;
      }
    } catch {
      // ignora voci corrotte
    }
  }

  return { count, newest, ttlMs: DB_CACHE_TTL_MS };
}

export const dbCacheKeys = {
  categories: (userId) => `categories:${userId}`,
  cards: (userId, categoryId) => `cards:${userId}:${categoryId}`,
  // v2: ignora le vecchie liste vuote salvate anche in caso di errore di rete.
  selector: (userId) => `selector:v2:${userId}`,
};
