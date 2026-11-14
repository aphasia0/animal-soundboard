#!/usr/bin/env node
/**
 * Carica nelle tabelle pubbliche e nello Storage i contenuti statici che
 * storicamente erano inclusi nella build (src/animals.js, src/jobs.js, ...).
 *
 * Categorie: soundpad_public_categories
 * Card:      soundpad_public_cards
 * Asset:     card-images/public/<card_uuid>/<file>
 *            card-sounds/public/<card_uuid>/<file>
 *
 * Gli UUID di categorie e card sono deterministici, così lo script è
 * rieseguibile: un secondo --apply aggiorna le stesse righe e salta gli asset
 * già presenti.
 *
 * Nota: dopo la pulizia della build le cartelle public/animals, public/sounds,
 * ecc. non contengono più questi file. Per rieseguire il seed vanno
 * ripristinate da git (o da un backup), perché lo script legge gli asset
 * locali.
 *
 * Anteprima:
 *   SUPABASE_URL=https://PROGETTO.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/seed-public-card-content.js
 *
 * Applicazione:
 *   lo stesso comando con --apply
 *
 * --category è ripetibile e limita il seed agli slug indicati.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { animals } from "../src/animals.js";
import { jobs } from "../src/jobs.js";
import { music } from "../src/music.js";
import { people } from "../src/people.js";
import { vehicles } from "../src/vehicles.js";
import { games } from "../src/games.js";
import { sentences } from "../src/sentences.js";
import { instruments } from "../src/instruments.js";
import {
  getAnimalName,
  getGameName,
  getInstrumentName,
  getJobName,
  getMusicName,
  getPersonName,
  getSentenceName,
  getVehicleName,
} from "../src/i18n.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const UUID_NAMESPACE = "6f1f6a0e-3c47-4a5f-9a3e-58f2c8f0b7d1";
const SEED_TIME = Date.UTC(2026, 0, 1, 0, 0, 0);
const WRITE_BATCH_SIZE = 100;

const CATEGORIES = [
  {
    slug: "animals",
    name: "Animali",
    emoji: "🦁",
    items: animals,
    getName: getAnimalName,
  },
  {
    slug: "work",
    name: "Lavoro",
    emoji: "🔨",
    items: jobs,
    getName: getJobName,
  },
  {
    slug: "people",
    name: "Persone",
    emoji: "👨‍👩‍👧‍👦",
    items: people,
    getName: getPersonName,
  },
  {
    slug: "vehicles",
    name: "Mezzi di trasporto",
    emoji: "🚗",
    items: vehicles,
    getName: getVehicleName,
  },
  {
    slug: "games",
    name: "Giochi",
    emoji: "🎮",
    items: games,
    getName: getGameName,
  },
  {
    slug: "music",
    name: "Musica",
    emoji: "🎵",
    items: music,
    getName: getMusicName,
  },
  {
    slug: "sentences",
    name: "Frasi",
    emoji: "💬",
    items: sentences,
    getName: getSentenceName,
  },
  {
    slug: "instruments",
    name: "Strumenti",
    emoji: "🎺",
    items: instruments,
    getName: getInstrumentName,
  },
];

function usage() {
  console.log(`Uso:
  node scripts/seed-public-card-content.js [--category SLUG ...] [--apply] [--force]

Opzioni:
  --category SLUG   Carica solo questa categoria; opzione ripetibile
  --apply           Carica asset e record (default: solo anteprima)
  --force           Ricarica anche gli asset già presenti
  --help            Mostra questo aiuto

Slug disponibili:
  ${CATEGORIES.map((category) => category.slug).join(", ")}

Variabili d'ambiente obbligatorie:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`);
}

function parseArgs(argv) {
  const result = { categories: new Set(), apply: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--apply") {
      result.apply = true;
      continue;
    }
    if (arg === "--force") {
      result.force = true;
      continue;
    }
    if (arg !== "--category") throw new Error(`Opzione sconosciuta: ${arg}`);
    const value = argv[++i];
    if (!value) throw new Error("--category richiede uno slug.");
    const slug = value.toLowerCase();
    if (!CATEGORIES.some((category) => category.slug === slug)) {
      throw new Error(`Categoria statica sconosciuta: ${value}`);
    }
    result.categories.add(slug);
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

function uuidv5(name) {
  const namespace = Buffer.from(UUID_NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1")
    .update(namespace)
    .update(Buffer.from(name, "utf8"))
    .digest()
    .subarray(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
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

function encodeStoragePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function storageUrl(supabaseUrl, bucket, path) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`;
}

function normalizePublicPath(value, label, cardLabel) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} vuoto per ${cardLabel}.`);
  }
  const clean = value.split("?")[0].split("#")[0];
  const relative = clean.replace(/^\/+/, "");
  const absolute = join(PUBLIC_DIR, relative);
  if (relative.includes("..") || !existsSync(absolute)) {
    throw new Error(`${label} non trovato in public/: ${value} (${cardLabel}).`);
  }
  return { relative, absolute };
}

function parseDataUri(value) {
  const match = /^data:([^;,]+)((?:;[^,]*)*),(.*)$/s.exec(value);
  if (!match) return null;
  const [, mimeType, parameters, payload] = match;
  return {
    mimeType,
    content: /;base64/i.test(parameters)
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8"),
  };
}

function assetExtension(mimeType) {
  if (mimeType === "image/svg+xml") return ".svg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  return "";
}

function planImage({ item, cardId, cardLabel }) {
  if (typeof item.image === "string" && item.image.startsWith("data:")) {
    const parsed = parseDataUri(item.image);
    if (!parsed) throw new Error(`Data URI immagine non valida per ${cardLabel}.`);
    const extension = assetExtension(parsed.mimeType);
    if (!extension) {
      throw new Error(`Tipo immagine non supportato per ${cardLabel}: ${parsed.mimeType}`);
    }
    return {
      bucket: "card-images",
      path: `public/${cardId}/emoji${extension}`,
      content: parsed.content,
      contentType: parsed.mimeType,
    };
  }
  const { relative, absolute } = normalizePublicPath(item.image, "Immagine", cardLabel);
  return {
    bucket: "card-images",
    path: `public/${cardId}/${relative.split("/").pop()}`,
    content: readFileSync(absolute),
    contentType: contentTypeFor(relative),
  };
}

function planSound({ item, cardId, cardLabel }) {
  if (typeof item.sound === "string" && item.sound.startsWith("synth:")) {
    // Gli strumenti usano il sintetizzatore del browser: non c'è un file da
    // caricare, ma il valore resta valido per audioUtils.js.
    return null;
  }
  const { relative, absolute } = normalizePublicPath(item.sound, "Suono", cardLabel);
  return {
    bucket: "card-sounds",
    path: `public/${cardId}/${relative.split("/").pop()}`,
    content: readFileSync(absolute),
    contentType: contentTypeFor(relative),
  };
}

function contentTypeFor(path) {
  switch (extname(path).toLowerCase()) {
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".ogg":
      return "audio/ogg";
    case ".webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
}

function buildPlan(config, selectedSlugs) {
  const selected = new Set(selectedSlugs);
  const categories = [];
  const cards = [];
  const assets = [];

  for (const [categoryIndex, definition] of CATEGORIES.entries()) {
    if (selected.size > 0 && !selected.has(definition.slug)) continue;
    const categoryId = uuidv5(`soundpad:category:${definition.slug}`);
    const categoryCreatedAt = new Date(
      SEED_TIME + categoryIndex * 60 * 60 * 1000,
    ).toISOString();
    const categoryCards = definition.items.map((item, index) => {
      const label = `${definition.name}/${definition.getName(item.key)}`;
      const cardId = uuidv5(`soundpad:card:${definition.slug}:${item.key}`);
      const image = planImage({ item, cardId, cardLabel: label });
      const sound = planSound({ item, cardId, cardLabel: label });
      for (const asset of [image, sound]) {
        if (!asset) continue;
        assets.push({
          ...asset,
          publicUrl: storageUrl(config.supabaseUrl, asset.bucket, asset.path),
        });
      }
      return {
        id: cardId,
        category_id: categoryId,
        name: definition.getName(item.key),
        image_url: storageUrl(config.supabaseUrl, image.bucket, image.path),
        sound_url: sound
          ? storageUrl(config.supabaseUrl, sound.bucket, sound.path)
          : item.sound,
        created_at: new Date(
          SEED_TIME + (categoryIndex * 1000 + index) * 60 * 1000,
        ).toISOString(),
      };
    });

    categories.push({
      id: categoryId,
      slug: definition.slug,
      name: definition.name,
      emoji: definition.emoji,
      sort_order: categoryIndex,
      created_at: categoryCreatedAt,
    });
    cards.push(...categoryCards);
  }

  return { categories, cards, assets };
}

async function objectExists(url, serviceRoleKey) {
  const response = await fetch(url, {
    method: "HEAD",
    headers: apiHeaders(serviceRoleKey),
  });
  if (response.ok) return true;
  if (response.status === 400 || response.status === 404) return false;
  await responseError(response, "Controllo asset");
}

async function uploadAsset(config, asset, force) {
  if (!force && await objectExists(asset.publicUrl, config.serviceRoleKey)) {
    return false;
  }
  const response = await fetch(
    `${config.supabaseUrl}/storage/v1/object/${asset.bucket}/${encodeStoragePath(asset.path)}`,
    {
      method: "POST",
      headers: apiHeaders(config.serviceRoleKey, {
        "Content-Type": asset.contentType,
        "x-upsert": "true",
      }),
      body: asset.content,
    },
  );
  if (!response.ok) await responseError(response, `Upload ${asset.path}`);
  return true;
}

function chunks(values, size = WRITE_BATCH_SIZE) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

async function fetchExistingSlugs(config, slugs) {
  if (slugs.length === 0) return new Map();
  const params = new URLSearchParams({
    select: "id,slug",
    slug: `in.(${slugs.join(",")})`,
  });
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/soundpad_public_categories?${params}`,
    { headers: apiHeaders(config.serviceRoleKey) },
  );
  if (!response.ok) await responseError(response, "Lettura categorie pubbliche");
  const rows = await response.json();
  return new Map(rows.map((row) => [String(row.slug).toLowerCase(), row.id]));
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const config = configuration();
  const plan = buildPlan(config, args.categories);

  console.log(
    `${args.apply ? "Seed" : "Anteprima"}: ${plan.categories.length} categorie, `
      + `${plan.cards.length} card, ${plan.assets.length} asset.`,
  );
  for (const category of plan.categories) {
    const count = plan.cards.filter((card) => card.category_id === category.id).length;
    console.log(`- ${category.emoji} ${category.name} (${category.slug}): ${count} card`);
  }

  if (!args.apply) {
    console.log("Nessuna modifica; aggiungi --apply per caricare asset e record.");
    return;
  }

  // Riusa gli id già presenti con lo stesso slug (es. seed manuale): evita
  // conflitti con l'indice univoco su slug.
  const existing = await fetchExistingSlugs(
    config,
    plan.categories.map((category) => category.slug),
  );
  const idByCategory = new Map();
  for (const category of plan.categories) {
    const existingId = existing.get(category.slug);
    if (existingId) idByCategory.set(category.id, existingId);
    category.id = existingId || category.id;
  }
  for (const card of plan.cards) {
    card.category_id = idByCategory.get(card.category_id) || card.category_id;
  }

  let uploaded = 0;
  for (const asset of plan.assets) {
    if (await uploadAsset(config, asset, args.force)) uploaded += 1;
  }
  console.log(`Asset caricati: ${uploaded}, già presenti: ${plan.assets.length - uploaded}.`);

  await upsert(config, "soundpad_public_categories", plan.categories);
  await upsert(config, "soundpad_public_cards", plan.cards);
  console.log(
    `Completato: ${plan.categories.length} categorie e ${plan.cards.length} card pubbliche.`,
  );
}

main().catch((error) => {
  console.error(`Errore: ${error.message}`);
  process.exitCode = 1;
});
