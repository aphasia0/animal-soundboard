#!/usr/bin/env node
/**
 * Parte 3: sposta categorie e card da user_categories/user_cards alle tabelle
 * soundpad_public_categories/soundpad_public_cards tramite Supabase REST.
 *
 * Prima eseguire migrate-user-card-assets-to-public.js --apply con la stessa
 * selezione. Questo script verifica che tutti gli asset pubblici esistano prima
 * di modificare il DB. Non elimina dal bucket i vecchi asset <userid>/.
 *
 * Anteprima:
 *   SUPABASE_URL=https://PROGETTO.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/migrate-user-cards-to-public.js \
 *     --owner UUID --category UUID
 *
 * Applicazione: lo stesso comando con --apply.
 *
 * Per avere un link leggibile invece di /category/<uuid>, aggiungi --slug:
 *   node scripts/migrate-user-cards-to-public.js \
 *     --owner UUID --category UUID --slug verbi --apply
 *
 * --slug richiede una sola --category. Lo slug viene normalizzato in
 * minuscolo; non può coincidere con una rotta dell'app o con uno slug del
 * seed statico (animals, work, ...).
 *
 * --category e --private-category sono ripetibili e alternative fra loro.
 * Senza --category vengono migrate tutte le categorie tranne quelle private.
 *
 * Attenzione: le chiamate REST non formano una singola transazione SQL. Lo
 * script è rieseguibile e scrive prima le tabelle pubbliche, poi elimina i
 * record personali. Se viene interrotto, rilanciarlo con la stessa selezione.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_STORAGE_PATH = /^[-A-Za-z0-9_./]+$/;
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 100;

// Slug già usati dalle rotte dell'app o dal seed dei contenuti statici.
const RESERVED_SLUGS = new Set([
  "home",
  "random",
  "stories",
  "gameshub",
  "band",
  "ascolta",
  "calma",
  "info",
  "category",
  "animals",
  "work",
  "people",
  "vehicles",
  "games",
  "music",
  "sentences",
  "instruments",
]);

function normalizeSlug(value) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("--slug non contiene caratteri utilizzabili.");
  if (RESERVED_SLUGS.has(slug)) throw new Error(`Slug riservato: ${slug}`);
  return slug;
}

function usage() {
  console.log(`Uso:
  node scripts/migrate-user-cards-to-public.js --owner UUID \\
    [--category UUID ... [--slug SLUG]] [--private-category UUID ...] [--apply]

Opzioni:
  --owner UUID              Account di cui pubblicare le card
  --category UUID           Migra solo questa categoria; opzione ripetibile
  --slug SLUG               Slug pubblico (es. verbi); richiede una sola --category
  --private-category UUID   Escludi questa categoria; opzione ripetibile
  --apply                   Migra realmente i record (default: solo anteprima)
  --help                    Mostra questo aiuto

Variabili d'ambiente obbligatorie:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`);
}

function parseArgs(argv) {
  const result = {
    owner: null,
    categories: new Set(),
    privateCategories: new Set(),
    slug: null,
    apply: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--apply") {
      result.apply = true;
      continue;
    }
    if (arg === "--slug") {
      const value = argv[++i];
      if (!value) throw new Error("--slug richiede un valore.");
      if (result.slug) throw new Error("--slug può essere indicato una sola volta.");
      result.slug = normalizeSlug(value);
      continue;
    }
    if (arg !== "--owner" && arg !== "--category" && arg !== "--private-category") {
      throw new Error(`Opzione sconosciuta: ${arg}`);
    }
    const value = argv[++i];
    if (!value || !UUID_RE.test(value)) {
      throw new Error(`${arg} richiede un UUID valido.`);
    }
    if (arg === "--owner") {
      if (result.owner) throw new Error("--owner può essere indicato una sola volta.");
      result.owner = value.toLowerCase();
    } else if (arg === "--category") {
      result.categories.add(value.toLowerCase());
    } else {
      result.privateCategories.add(value.toLowerCase());
    }
  }
  if (!result.owner) throw new Error("--owner è obbligatorio.");
  if (result.categories.size > 0 && result.privateCategories.size > 0) {
    throw new Error("Usa --category oppure --private-category, non entrambe.");
  }
  if (result.slug && result.categories.size !== 1) {
    throw new Error("--slug richiede esattamente una --category.");
  }
  return result;
}

function configuration() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nell'ambiente.");
  }
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL non è un URL valido.");
  }
  if (typeof fetch !== "function") {
    throw new Error("Serve Node.js 18+ con fetch (consigliato Node.js 20+).");
  }
  return { supabaseUrl, serviceRoleKey };
}

function apiHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extra,
  };
}

async function responseError(response, action) {
  const body = await response.text();
  throw new Error(`${action}: HTTP ${response.status} ${body.slice(0, 500)}`);
}

async function fetchAll(config, table, select, filters) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      select,
      ...filters,
      order: "created_at.asc,id.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${params}`, {
      headers: apiHeaders(config.serviceRoleKey),
    });
    if (!response.ok) await responseError(response, `Lettura ${table}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function chunks(values, size = WRITE_BATCH_SIZE) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

function encodeStoragePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function assetUrl(supabaseUrl, bucket, path) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`;
}

function isEmojiOnly(value) {
  if (typeof value !== "string" || !value || value.trim() !== value) return false;
  const segments = Array.from(
    new Intl.Segmenter("it", { granularity: "grapheme" }).segment(value),
  );
  return segments.length === 1 && (
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value)
    || /^[#*0-9]\uFE0F?\u20E3$/u.test(value)
  );
}

function planAsset({ rawUrl, bucket, owner, cardId, supabaseUrl, allowEmoji = false }) {
  if (allowEmoji && isEmojiOnly(rawUrl)) {
    const targetPath = `public/${cardId}/emoji.svg`;
    return { targetPath, publicUrl: assetUrl(supabaseUrl, bucket, targetPath) };
  }
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error(`Valore ${bucket} vuoto o non testuale per la card ${cardId}.`);
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    const preview = rawUrl.length > 240 ? `${rawUrl.slice(0, 240)}…` : rawUrl;
    throw new Error(
      `URL ${bucket} non valido per la card ${cardId}: ${JSON.stringify(preview)}.`,
    );
  }
  const projectOrigin = new URL(supabaseUrl).origin;
  const prefix = `/storage/v1/object/public/${bucket}/`;
  if (
    url.origin !== projectOrigin
    || !url.pathname.startsWith(prefix)
    || url.search
    || url.hash
  ) {
    throw new Error(`URL ${bucket} non supportato per la card ${cardId}: ${rawUrl}`);
  }
  const sourcePath = url.pathname.slice(prefix.length);
  const ownerPrefix = `${owner}/`;
  if (!sourcePath.startsWith(ownerPrefix) || !SAFE_STORAGE_PATH.test(sourcePath)) {
    throw new Error(`La card ${cardId} non usa ${bucket}/${owner}/<file>.`);
  }
  const previousPath = sourcePath.slice(ownerPrefix.length);
  if (!previousPath || previousPath.includes("..") || previousPath.endsWith("/")) {
    throw new Error(`Percorso ${bucket} non valido per la card ${cardId}: ${sourcePath}`);
  }
  const targetPath = `public/${cardId}/${previousPath}`;
  return { targetPath, publicUrl: assetUrl(supabaseUrl, bucket, targetPath) };
}

async function objectExists(url, serviceRoleKey) {
  const response = await fetch(url, {
    method: "HEAD",
    headers: apiHeaders(serviceRoleKey),
  });
  if (response.ok) return true;
  if (response.status === 400 || response.status === 404) return false;
  await responseError(response, "Controllo asset pubblico");
}

async function verifyAssets(plans, serviceRoleKey) {
  const missing = [];
  for (const plan of plans) {
    for (const asset of [plan.image, plan.sound]) {
      if (!await objectExists(asset.publicUrl, serviceRoleKey)) {
        missing.push(`${plan.card.id}: ${asset.targetPath}`);
      }
    }
  }
  if (missing.length > 0) {
    const preview = missing.slice(0, 10).join("\n  ");
    throw new Error(
      `Mancano ${missing.length} asset pubblici. Esegui prima la parte 2 con --apply e `
        + `la stessa selezione.\n  ${preview}${missing.length > 10 ? "\n  ..." : ""}`,
    );
  }
}

async function upsert(config, table, rows) {
  for (const batch of chunks(rows)) {
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/${table}?on_conflict=id`,
      {
        method: "POST",
        headers: apiHeaders(config.serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify(batch),
      },
    );
    if (!response.ok) await responseError(response, `Scrittura ${table}`);
  }
}

async function findCategoryBySlug(config, slug) {
  const params = new URLSearchParams({
    select: "id,slug",
    slug: `ilike.${slug}`,
    limit: "1",
  });
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/soundpad_public_categories?${params}`,
    { headers: apiHeaders(config.serviceRoleKey) },
  );
  if (!response.ok) await responseError(response, "Controllo slug pubblico");
  const rows = await response.json();
  return rows[0] || null;
}

async function deleteByIds(config, table, ids, owner) {
  let deleted = 0;
  for (const batch of chunks(ids)) {
    const params = new URLSearchParams({
      id: `in.(${batch.join(",")})`,
      user_id: `eq.${owner}`,
    });
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${params}`, {
      method: "DELETE",
      headers: apiHeaders(config.serviceRoleKey, { Prefer: "return=representation" }),
    });
    if (!response.ok) await responseError(response, `Eliminazione ${table}`);
    deleted += (await response.json()).length;
  }
  return deleted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const config = configuration();
  const hasWhitelist = args.categories.size > 0;
  const configuredIds = hasWhitelist ? args.categories : args.privateCategories;

  const [categories, ownerCards] = await Promise.all([
    fetchAll(config, "user_categories", "id,user_id,name,emoji,created_at", {
      user_id: `eq.${args.owner}`,
    }),
    fetchAll(config, "user_cards", "id,user_id,category_id,name,image_url,sound_url,created_at", {
      user_id: `eq.${args.owner}`,
    }),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id.toLowerCase(), category]));
  for (const categoryId of configuredIds) {
    if (!categoryById.has(categoryId)) {
      throw new Error(`Categoria ${categoryId} inesistente o non appartenente a owner.`);
    }
  }
  const selectedCategories = categories.filter((category) => {
    const id = category.id.toLowerCase();
    return hasWhitelist ? args.categories.has(id) : !args.privateCategories.has(id);
  });
  const selectedCategoryIds = new Set(selectedCategories.map((category) => category.id));
  const selectedCards = ownerCards.filter((card) => selectedCategoryIds.has(card.category_id));

  const slugById = new Map();
  if (args.slug) {
    const target = selectedCategories[0];
    const conflict = await findCategoryBySlug(config, args.slug);
    if (conflict && conflict.id.toLowerCase() !== target.id.toLowerCase()) {
      throw new Error(
        `Slug "${args.slug}" già usato dalla categoria pubblica ${conflict.id}.`,
      );
    }
    slugById.set(target.id, args.slug);
  }

  const plans = selectedCards.map((card) => ({
    card,
    image: planAsset({
      rawUrl: card.image_url,
      bucket: "card-images",
      owner: args.owner,
      cardId: card.id,
      supabaseUrl: config.supabaseUrl,
      allowEmoji: true,
    }),
    sound: planAsset({
      rawUrl: card.sound_url,
      bucket: "card-sounds",
      owner: args.owner,
      cardId: card.id,
      supabaseUrl: config.supabaseUrl,
    }),
  }));

  await verifyAssets(plans, config.serviceRoleKey);

  console.log(
    `${args.apply ? "Migrazione" : "Anteprima"}: ${selectedCategories.length} categorie da pubblicare, `
      + `${selectedCards.length} card da pubblicare, `
      + `${categories.length - selectedCategories.length} categorie personali rimanenti, `
      + `${ownerCards.length - selectedCards.length} card personali rimanenti.`,
  );
  for (const category of selectedCategories) {
    const count = selectedCards.filter((card) => card.category_id === category.id).length;
    const slug = slugById.get(category.id);
    console.log(
      `- ${category.emoji || "📁"} ${category.name} (${category.id}): ${count} card`
        + `${slug ? ` → /${slug}` : ""}`,
    );
  }

  if (!args.apply) {
    console.log("Asset verificati. Nessun record modificato; aggiungi --apply per migrare.");
    return;
  }

  const publicCategories = selectedCategories.map((category, index) => {
    const row = {
      id: category.id,
      name: category.name,
      emoji: category.emoji || "📁",
      sort_order: index,
      created_at: category.created_at,
    };
    const slug = slugById.get(category.id);
    if (slug) row.slug = slug;
    return row;
  });
  const publicCards = plans.map(({ card, image, sound }) => ({
    id: card.id,
    category_id: card.category_id,
    name: card.name,
    image_url: image.publicUrl,
    sound_url: sound.publicUrl,
    created_at: card.created_at,
  }));

  await upsert(config, "soundpad_public_categories", publicCategories);
  await upsert(config, "soundpad_public_cards", publicCards);
  const deletedCards = await deleteByIds(
    config,
    "user_cards",
    selectedCards.map((card) => card.id),
    args.owner,
  );
  const deletedCategories = await deleteByIds(
    config,
    "user_categories",
    selectedCategories.map((category) => category.id),
    args.owner,
  );
  console.log(
    `Completato: ${publicCategories.length} categorie e ${publicCards.length} card pubblicate; `
      + `${deletedCategories} categorie e ${deletedCards} card personali eliminate.`,
  );
}

main().catch((error) => {
  console.error(`Errore: ${error.message}`);
  process.exitCode = 1;
});
