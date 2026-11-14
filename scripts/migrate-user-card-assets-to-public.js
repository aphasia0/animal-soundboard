#!/usr/bin/env node
/**
 * Copia gli asset delle user_cards da <userid>/ a public/<card_uuid>/.
 * Un singolo emoji in image_url viene convertito in public/<card_uuid>/emoji.svg.
 *
 * Non modifica il DB e non cancella i file originali. Il passo SQL successivo
 * verifica gli oggetti copiati, aggiorna gli URL e sposta categorie/card.
 *
 * Anteprima:
 *   SUPABASE_URL=https://PROGETTO.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/migrate-user-card-assets-to-public.js \
 *     --owner UUID [--category UUID ...] [--private-category UUID ...]
 *
 * --category seleziona solo le categorie indicate; --private-category le esclude.
 * Le due opzioni sono ripetibili ma non possono essere usate insieme.
 *
 * Applicazione: lo stesso comando con --apply.
 *
 * La service_role key serve esclusivamente da shell locale per leggere tutti i
 * record dell'account e scrivere sotto public/. Non inserirla in .env frontend,
 * nel browser o in file versionati. Forniscila come variabile d'ambiente.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_STORAGE_PATH = /^[-A-Za-z0-9_./]+$/;
const PAGE_SIZE = 1000;

function usage() {
  console.log(`Uso:
  node scripts/migrate-user-card-assets-to-public.js --owner UUID \\
    [--category UUID ... | --private-category UUID ...] [--apply]

Opzioni:
  --owner UUID              Account di cui pubblicare le card
  --category UUID           Migra solo questa categoria; opzione ripetibile
  --private-category UUID   Escludi questa categoria; opzione ripetibile
  --apply                   Copia realmente gli asset (default: solo anteprima)
  --help                    Mostra questo aiuto

Variabili d'ambiente obbligatorie:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`);
}

function parseArgs(argv) {
  const result = {
    owner: null,
    categories: new Set(),
    privateCategories: new Set(),
    apply: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--apply") {
      result.apply = true;
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
  return result;
}

function assertConfiguration() {
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

function encodeStoragePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
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

async function fetchOwnerCards({ supabaseUrl, serviceRoleKey, owner }) {
  const cards = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      select: "id,user_id,category_id,name,image_url,sound_url,created_at",
      user_id: `eq.${owner}`,
      order: "created_at.asc,id.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/user_cards?${params}`, {
      headers: apiHeaders(serviceRoleKey),
    });
    if (!response.ok) await responseError(response, "Lettura user_cards");
    const page = await response.json();
    cards.push(...page);
    if (page.length < PAGE_SIZE) return cards;
  }
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

function emojiSvg(emoji) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="64" fill="#ffffff"/>
  <text x="512" y="500" text-anchor="middle" dominant-baseline="central"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
    font-size="700">${emoji}</text>
</svg>
`;
}

function planAsset({ rawUrl, bucket, owner, cardId, supabaseUrl }) {
  if (bucket === "card-images" && isEmojiOnly(rawUrl)) {
    const targetPath = `public/${cardId}/emoji.svg`;
    return {
      bucket,
      sourcePath: null,
      targetPath,
      sourceUrl: null,
      targetUrl: assetUrl(supabaseUrl, bucket, targetPath),
      emoji: rawUrl,
      generated: {
        body: Buffer.from(emojiSvg(rawUrl)),
        contentType: "image/svg+xml; charset=utf-8",
      },
    };
  }
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error(
      `Valore ${bucket} vuoto o non testuale per la card ${cardId}: ${JSON.stringify(rawUrl ?? null)}.`,
    );
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    const preview = rawUrl.length > 240 ? `${rawUrl.slice(0, 240)}…` : rawUrl;
    throw new Error(
      `URL ${bucket} non valido per la card ${cardId}: ${JSON.stringify(preview)}. `
        + "Se è un path locale/relativo, va caricato su Storage prima della migrazione SQL.",
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
    throw new Error(
      `La card ${cardId} ha un URL non supportato per ${bucket}; atteso ${projectOrigin}${prefix}${owner}/<file>.`,
    );
  }

  const sourcePath = url.pathname.slice(prefix.length);
  const ownerPrefix = `${owner}/`;
  if (!sourcePath.startsWith(ownerPrefix) || !SAFE_STORAGE_PATH.test(sourcePath)) {
    throw new Error(
      `La card ${cardId} non usa il percorso semplice ${bucket}/${owner}/<file>.`,
    );
  }
  const previousPath = sourcePath.slice(ownerPrefix.length);
  if (!previousPath || previousPath.includes("..") || previousPath.endsWith("/")) {
    throw new Error(`Percorso ${bucket} non valido per la card ${cardId}: ${sourcePath}`);
  }
  const targetPath = `public/${cardId}/${previousPath}`;
  return {
    bucket,
    sourcePath,
    targetPath,
    sourceUrl: assetUrl(supabaseUrl, bucket, sourcePath),
    targetUrl: assetUrl(supabaseUrl, bucket, targetPath),
  };
}

async function download(url, serviceRoleKey, description) {
  const response = await fetch(url, { headers: apiHeaders(serviceRoleKey) });
  if (!response.ok) await responseError(response, `Download ${description}`);
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
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

async function copyAsset(asset, serviceRoleKey) {
  if (await objectExists(asset.targetUrl, serviceRoleKey)) return "presente";
  const source = asset.generated || await download(
    asset.sourceUrl,
    serviceRoleKey,
    asset.sourcePath,
  );
  const uploadUrl = asset.targetUrl.replace("/object/public/", "/object/");
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: apiHeaders(serviceRoleKey, {
      "Content-Type": source.contentType,
      "Cache-Control": "31536000",
      "x-upsert": "false",
    }),
    body: source.body,
  });
  if (!response.ok) await responseError(response, `Upload ${asset.targetPath}`);
  return "copiato";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const config = assertConfiguration();
  const cards = await fetchOwnerCards({ ...config, owner: args.owner });
  const hasCategoryWhitelist = args.categories.size > 0;
  const selected = cards.filter((card) => {
    const categoryId = card.category_id.toLowerCase();
    return hasCategoryWhitelist
      ? args.categories.has(categoryId)
      : !args.privateCategories.has(categoryId);
  });
  const plans = selected.map((card) => ({
    card,
    assets: [
      planAsset({
        rawUrl: card.image_url,
        bucket: "card-images",
        owner: args.owner,
        cardId: card.id,
        supabaseUrl: config.supabaseUrl,
      }),
      planAsset({
        rawUrl: card.sound_url,
        bucket: "card-sounds",
        owner: args.owner,
        cardId: card.id,
        supabaseUrl: config.supabaseUrl,
      }),
    ],
  }));

  const selectionDescription = hasCategoryWhitelist
    ? `${args.categories.size} categorie selezionate`
    : `${args.privateCategories.size} categorie private escluse`;
  console.log(
    `${args.apply ? "Migrazione" : "Anteprima"}: ${selectionDescription}; `
      + `${selected.length} card da pubblicare, `
      + `${cards.length - selected.length} card non selezionate, ${plans.length * 2} asset.`,
  );
  for (const { card, assets } of plans) {
    console.log(`- ${card.name} (${card.id})`);
    for (const asset of assets) {
      const source = asset.emoji ? `emoji ${asset.emoji} (conversione SVG)` : asset.sourcePath;
      console.log(`  ${asset.bucket}: ${source} -> ${asset.targetPath}`);
    }
  }

  if (!args.apply) {
    console.log("Nessun file copiato. Aggiungi --apply per eseguire la copia.");
    return;
  }

  const results = { copiato: 0, presente: 0 };
  for (const { card, assets } of plans) {
    for (const asset of assets) {
      const result = await copyAsset(asset, config.serviceRoleKey);
      results[result] += 1;
      console.log(`${result === "copiato" ? "Copiato" : "Già presente"}: ${asset.bucket}/${asset.targetPath}`);
    }
    console.log(`Verificati gli asset di ${card.name} (${card.id}).`);
  }
  const sqlSelection = hasCategoryWhitelist ? "category_ids" : "private_category_ids";
  console.log(
    `Completato: ${results.copiato} asset copiati, ${results.presente} già presenti. `
      + `Ora esegui l'anteprima SQL configurando ${sqlSelection} con gli stessi UUID.`,
  );
}

main().catch((error) => {
  console.error(`Errore: ${error.message}`);
  process.exitCode = 1;
});
