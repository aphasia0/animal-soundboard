#!/usr/bin/env node
/**
 * upload-card.js — CLI per gestire contenuti su Supabase partendo da un video.
 *
 * Comandi:
 *   upload            Crea una card (audio + immagine) in locale o su Supabase
 *   categories        Elenca le categorie dell'utente (id, icona, nome, n. card)
 *   cards             Elenca le card dell'utente (id, nome, categoria)
 *   create-category   Crea una nuova categoria e stampa il suo UUID
 *   move-card         Sposta una card in un'altra categoria
 *   analyze           Analizza un video e genera i comandi di upload
 *   help              Mostra l'aiuto
 *
 * ── Flusso tipico da un video ────────────────────────────────────────────────
 *   # 1. (Solo remoto) Controlla/crea la categoria
 *   node upload-card.js categories
 *   node upload-card.js create-category --name "Animali" --emoji "🐾"
 *
 *   # 2. Rilascia la card passando direttamente il video in --input.
 *   #    Senza --image viene estratto automaticamente il fotogramma
 *   #    centrale della clip (start + (end - start) / 2), ritagliato
 *   #    quadrato 1024x1024 (crop centrale) per la card.
 *   node upload-card.js upload --input video.mp4 --start 12 --end 27 \
 *     --name "Leone" --category <uuid>
 *   (oppure senza "upload": i flag da soli valgono come comando upload)
 *
 *   Puoi comunque passare un'immagine già pronta con --image frame.jpg.
 *
 *   --input accetta sia audio (m4a, mp3, wav…) sia video (mp4, webm, mov…):
 *   per i video ffmpeg usa solo la traccia audio (-vn), quindi non serve
 *   pre-estrarre l'm4a. --start/--end sono relativi al file passato in --input:
 *   con l'esempio sopra la card parte dal secondo 12 del video.
 *
 * ── Prerequisiti ─────────────────────────────────────────────────────────────
 *   - Node.js 18+ e dipendenze: `cd scripts && npm install`
 *   - ffmpeg nel PATH (verifica con `ffmpeg -version`) — solo per `upload`
 *   - Comandi remoti: `SUPABASE_PASSWORD` = password dell'account EMAIL
 *     (EMAIL si può sovrascrivere con `SUPABASE_EMAIL`)
 *   - Bucket pubblici `card-sounds` e `card-images` (creati da supabase-schema.sql)
 *
 * ── Comando: upload ──────────────────────────────────────────────────────────
 *   Uso LOCALE (asset nel repo, nessun upload):
 *     node upload-card.js upload \
 *       --mode local \
 *       --input ./audio.m4a --start 0 --end 15 \
 *       --image ./frame.jpg \
 *       --name "Nome Card" \
 *       --key nome_chiave \
 *       --category animals
 *
 *     Alla fine stampa la riga da aggiungere a mano in src/{category}.js.
 *
 *   Uso REMOTO (Supabase):
 *     SUPABASE_PASSWORD=*** node upload-card.js upload \
 *       --mode remote \
 *       --input ./audio.m4a --start 0 --end 15 \
 *       --image ./frame.jpg \
 *       --name "Nome Card" \
 *       --category <uuid_categoria>
 *
 *     --category in remoto è l'UUID di user_categories, ottenibile con il
 *     comando `categories` o `create-category`.
 *
 *   Flag upload:
 *     --mode      local | remote (default: remote)
 *     --input     file audio o video (m4a, mp3, mp4, webm…): dai video
 *                 viene usata solo la traccia audio                 [obbligatorio]
 *     --start     inizio clip in secondi                            [obbligatorio]
 *     --end       fine clip in secondi (> start)                    [obbligatorio]
 *     --image     immagine della card (jpg/png). Se manca e --input è
 *                 un video, estrae il fotogramma centrale della clip
 *                 e lo ritaglia quadrato 1024x1024                [facoltativo]
 *     --name      nome mostrato sulla card                          [obbligatorio]
 *     --key       chiave/nome file (solo local; default: slug di --name)
 *     --category  cartella public/ (local) o UUID categoria (remote) [obbligatorio]
 *
 * ── Comando: categories ──────────────────────────────────────────────────────
 *   SUPABASE_PASSWORD=*** node upload-card.js categories [--json]
 *
 *   Mostra: UUID, icona, nome e numero di card di ogni categoria dell'utente.
 *   Con --json stampa l'array completo (campo card_count incluso).
 *
 * ── Comando: cards ───────────────────────────────────────────────────────────
 *   SUPABASE_PASSWORD=*** node upload-card.js cards [opzioni]
 *
 *   Elenca le card dell'utente con UUID, nome e categoria. Utile per trovare
 *   l'UUID da passare a `move-card --id`.
 *     --category <uuid|nome>   mostra solo le card di quella categoria
 *     --json                   stampa JSON
 *
 * ── Comando: create-category ─────────────────────────────────────────────────
 *   SUPABASE_PASSWORD=*** node upload-card.js create-category \
 *     --name "Animali" [--emoji "🐾"] [--json]
 *
 *   Lo schema non prevede una colonna "description": la descrizione visibile è
 *   nome + icona (emoji). L'emoji default è 📁.
 *
 * ── Comando: move-card ───────────────────────────────────────────────────────
 *   SUPABASE_PASSWORD=*** node upload-card.js move-card \
 *     (--id <uuid_card> | --name "Nome card") \
 *     --to <uuid_categoria | "Nome categoria"> \
 *     [--from <uuid_categoria | "Nome categoria">] [--all] [--dry-run] [--json]
 *
 *   Sposta una card già esistente in un'altra categoria (aggiorna category_id;
 *   audio e immagine restano dove sono, non vengono ricaricati).
 *
 *     --id        UUID della card (ricavabile con --name e un primo tentativo)
 *     --name      nome della card, confronto senza maiuscole/accenti
 *     --from      cerca la card solo in questa categoria (utile se il nome
 *                 esiste in più sezioni)
 *     --to        categoria di destinazione (UUID o nome)
 *     --all       sposta tutte le card che corrispondono a --name
 *     --dry-run   mostra cosa verrebbe fatto, senza modificare nulla
 *
 *   Se --name trova più card, lo script elenca gli UUID e si ferma: usa --id
 *   oppure --all. Esempi:
 *     node upload-card.js move-card --name "Albero" --to "Alfabeto"
 *     node upload-card.js move-card --id 1f0c… --to "Animali" --dry-run
 *     node upload-card.js move-card --name "Auto" --from "Veicoli" --to "Trasporti"
 *
 * ── Comando: analyze ─────────────────────────────────────────────────────────
 *   node upload-card.js analyze --input video.webm [opzioni]
 *
 *   Analizza il video e stampa su stdout i comandi `upload` pronti da eseguire
 *   (i log vanno su stderr, quindi si può redirigere l'output in uno script).
 *
 *   Cosa fa:
 *     1. ffmpeg silencedetect → trova i segmenti audio
 *     2. OCR dei frame (macOS Vision) → legge le etichette dei veicoli
 *     3. raggruppa i suoni per etichetta (gestisce clacson/campanelli)
 *     4. estrae un frame per veicolo, lo ritaglia e lo salva come JPG 1024x1024
 *     5. stampa un comando upload per ogni veicolo
 *
 *   Opzioni:
 *     --input <video>       video da analizzare                       [obbligatorio]
 *     --out <dir>           cartella immagini (default: <video>-cards)
 *     --category <uuid>     UUID categoria da inserire nei comandi
 *                           (default: "$CAT", da esportare nella shell)
 *     --frame-offset <sec>  secondi dopo l'inizio del suono per il frame (default 4)
 *     --lang it|en          nomi italiani (default) o etichette originali
 *     --no-ocr              salta l'OCR e usa nomi generici "Veicolo N"
 *     --json                stampa JSON invece dei comandi
 *
 *   Esempio:
 *     export SUPABASE_PASSWORD=***
 *     export CAT=<uuid_categoria>
 *     node upload-card.js analyze --input scripts/tt.webm > upload.sh
 *     bash upload.sh
 *
 *   Nota: l'OCR usa il framework Vision di macOS (serve Xcode Command Line
 *   Tools). Su altri sistemi usare --no-ocr: i suoni vengono comunque trovati.
 *
 * ── Note ─────────────────────────────────────────────────────────────────────
 *   - In remoto i file finiscono in {userId}/{timestamp}.webm|jpg: il timestamp
 *     evita collisioni, quindi rilanciare lo stesso comando crea una card nuova.
 *   - La categoria deve appartenere all'utente loggato, altrimenti le RLS
 *     bloccano l'insert in user_cards.
 *   - Il file temporaneo webm viene rimosso a fine esecuzione; se lo script
 *     fallisce prima della pulizia può restare in os.tmpdir(). Lo stesso vale
 *     per il fotogramma estratto automaticamente dal video.
 *
 * ── Errori comuni ────────────────────────────────────────────────────────────
 *   "Login fallito"                          → SUPABASE_PASSWORD errata
 *   "new row violates row-level security"    → categoria inesistente o di un altro utente
 *   "ffmpeg: command not found"              → installa ffmpeg (brew install ffmpeg)
 */

import { execSync } from "child_process";
import { readFileSync, copyFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, extname, dirname, basename } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { analyzeVideo } from "./lib/analyze.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

// ── Config Supabase ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "https://lkvurqiojgabbztkfjeo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdnVycWlvamdhYmJ6dGtmamVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzQyOTYsImV4cCI6MjA3NDU1MDI5Nn0.kI3-oq8WDi7WknWrPLejeLetmnXo0G-TMmKT3cDY-OE";
const EMAIL = process.env.SUPABASE_EMAIL || "tony.dream@gmail.com";
const PASSWORD = process.env.SUPABASE_PASSWORD;

// ── Args ──────────────────────────────────────────────────────────────────────
const DEFAULT_EMOJI = "📁";
const IMAGE_SIZE = 1024;
const IMAGE_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function parseFlags(tokens) {
  const flags = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function flagValue(flags, key) {
  const value = flags[key];
  return value === true || value === undefined ? null : value;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parseUploadArgs(flags) {
  const name = flagValue(flags, "name");
  const key = flagValue(flags, "key") || (name ? slugify(name) : null);
  return {
    mode: flagValue(flags, "mode") || "remote", // 'local' | 'remote'
    input: flagValue(flags, "input"),
    start: parseFloat(flagValue(flags, "start")),
    end: parseFloat(flagValue(flags, "end")),
    image: flagValue(flags, "image"),
    name,
    key,
    category: flagValue(flags, "category"),
  };
}

// ── ffmpeg ────────────────────────────────────────────────────────────────────
function trimToWebm(input, start, end) {
  const duration = end - start;
  const tmp = join(tmpdir(), `card-${Date.now()}.webm`);
  console.log(`ffmpeg: taglio ${start}s → ${end}s (${duration}s) e converto in webm...`);
  execSync(
    `ffmpeg -y -i "${input}" -ss ${start} -t ${duration} -vn -c:a libopus -b:a 64k "${tmp}"`,
    { stdio: "inherit" }
  );
  return tmp;
}

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "avi", "ogv"]);

function isVideoFile(input) {
  return VIDEO_EXTENSIONS.has(extname(input).replace(".", "").toLowerCase());
}

function extractMidFrame(input, start, end) {
  const time = ((start + end) / 2).toFixed(2);
  const tmp = join(tmpdir(), `card-frame-${Date.now()}.jpg`);
  console.log(
    `ffmpeg: estraggo il fotogramma centrale a ${time}s ` +
    `e lo ritaglio quadrato ${IMAGE_SIZE}x${IMAGE_SIZE}...`
  );
  execSync(
    `ffmpeg -y -ss ${time} -i "${input}" -frames:v 1 -update 1 -q:v 2 ` +
    `-vf "scale=${IMAGE_SIZE}:${IMAGE_SIZE}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${IMAGE_SIZE}:${IMAGE_SIZE}" "${tmp}"`,
    { stdio: "inherit" }
  );
  return tmp;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = 20000;

class HttpError extends Error {
  constructor(status, data, url) {
    super(`HTTP ${status} su ${url}`);
    this.status = status;
    this.data = data;
  }

  reason() {
    const data = this.data;
    if (typeof data === "string") return data;
    if (!data) return "(risposta vuota)";
    return (
      data.msg ||
      data.error_description ||
      data.message ||
      data.error_code ||
      JSON.stringify(data)
    );
  }
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  let text;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
    text = await res.text();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Timeout dopo ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw new Error(`Richiesta fallita (${url}): ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) throw new HttpError(res.status, data, url);
  return data;
}

function authHeaders(token) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function login() {
  try {
    const data = await request(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      }
    );
    return { token: data.access_token, userId: data.user.id };
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(`Login fallito: ${err.reason()}`);
    }
    throw err;
  }
}

async function connect() {
  if (!PASSWORD) {
    throw new Error(
      "Imposta la variabile d'ambiente SUPABASE_PASSWORD " +
        `(password dell'account ${EMAIL}; puoi cambiare account con SUPABASE_EMAIL)`
    );
  }
  console.error(`Login come ${EMAIL}...`);
  const { token, userId } = await login();
  console.error(`Loggato. User ID: ${userId}`);
  return { token, userId };
}

async function apiGet(token, path) {
  try {
    return await request(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: authHeaders(token),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(`GET ${path} fallito: ${err.reason()}`);
    }
    throw err;
  }
}

async function apiPost(token, path, body) {
  try {
    return await request(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(`POST ${path} fallito: ${err.reason()}`);
    }
    throw err;
  }
}

async function apiPatch(token, path, body) {
  try {
    return await request(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(`PATCH ${path} fallito: ${err.reason()}`);
    }
    throw err;
  }
}

async function uploadToStorage(token, bucket, path, fileBuffer, contentType) {
  try {
    await request(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": contentType,
        "Cache-Control": "31536000",
        "x-upsert": "false",
      },
      body: fileBuffer,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(`Upload ${bucket} fallito: ${err.reason()}`);
    }
    throw err;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function insertCard(token, { userId, categoryId, name, imageUrl, soundUrl }) {
  const data = await apiPost(token, "user_cards", {
    category_id: categoryId,
    user_id: userId,
    name,
    image_url: imageUrl,
    sound_url: soundUrl,
  });
  return data;
}

async function fetchCategories(token) {
  const categories = await apiGet(
    token,
    "user_categories?select=id,name,emoji,created_at&order=name.asc"
  );

  // Conteggio separato: più semplice e indipendente dall'embed di PostgREST.
  // Se fallisce (es. RLS), mostriamo comunque le categorie.
  const counts = {};
  try {
    const cards = await apiGet(token, "user_cards?select=category_id");
    for (const card of cards) {
      counts[card.category_id] = (counts[card.category_id] || 0) + 1;
    }
  } catch (err) {
    console.warn(`Avviso: conteggio card non disponibile (${err.message})`);
  }

  return categories.map((category) => ({
    ...category,
    card_count: counts[category.id] || 0,
  }));
}

function cardCount(category) {
  return category.card_count ?? 0;
}

// ── Ricerca card e categorie (per move-card) ─────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function foldName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function describeCategory(category) {
  return `${category.emoji || DEFAULT_EMOJI} ${category.name} (${category.id})`;
}

function resolveCategory(categories, ref, flagName) {
  const byId = categories.find((category) => category.id === ref);
  if (byId) return byId;

  if (UUID_RE.test(ref)) {
    throw new Error(
      `${flagName}: nessuna categoria con id ${ref}. ` +
      "Controlla l'UUID con `node upload-card.js categories`."
    );
  }

  const matches = categories.filter(
    (category) => foldName(category.name) === foldName(ref)
  );
  if (matches.length === 1) return matches[0];

  if (matches.length > 1) {
    throw new Error(
      `${flagName}: più categorie si chiamano "${ref}":\n` +
      matches.map((category) => `  ${describeCategory(category)}`).join("\n") +
      "\nUsa l'UUID per scegliere quella giusta."
    );
  }

  throw new Error(
    `${flagName}: categoria "${ref}" non trovata. ` +
    "Categorie disponibili:\n" +
    categories.map((category) => `  ${describeCategory(category)}`).join("\n")
  );
}

async function fetchCards(token) {
  return apiGet(
    token,
    "user_cards?select=id,name,category_id,created_at&order=created_at.asc"
  );
}

// ── Comando: categories ───────────────────────────────────────────────────────
async function runCategories(flags) {
  const { token } = await connect();
  console.error("Carico categorie...");
  const categories = await fetchCategories(token);

  if (flags.json) {
    console.log(JSON.stringify(categories, null, 2));
    return;
  }

  if (categories.length === 0) {
    console.log("\nNessuna categoria trovata.");
    console.log('Creane una con: node upload-card.js create-category --name "Animali" --emoji "🐾"');
    return;
  }

  const nameWidth = Math.max(4, ...categories.map((c) => (c.name || "").length));
  const header = [
    "ID".padEnd(36),
    "ICONA".padEnd(8),
    "NOME".padEnd(nameWidth),
    "CARD".padStart(5),
  ].join("  ");
  console.log(`\n${header}`);
  console.log("-".repeat(header.length));
  for (const category of categories) {
    console.log(
      [
        category.id.padEnd(36),
        (category.emoji || DEFAULT_EMOJI).padEnd(8),
        (category.name || "").padEnd(nameWidth),
        String(cardCount(category)).padStart(5),
      ].join("  ")
    );
  }
  console.log(`\nTotale: ${categories.length} categorie`);
}

// ── Comando: cards ───────────────────────────────────────────────────────────
async function runCards(flags) {
  const categoryRef = flagValue(flags, "category");

  const { token } = await connect();
  const categories = await fetchCategories(token);
  const filter = categoryRef
    ? resolveCategory(categories, categoryRef, "--category")
    : null;
  const cards = await fetchCards(token);
  const selected = filter
    ? cards.filter((card) => card.category_id === filter.id)
    : cards;

  const categoryById = new Map(
    categories.map((category) => [category.id, category])
  );
  const rows = selected.map((card) => {
    const category = categoryById.get(card.category_id);
    return {
      ...card,
      category_name: category ? category.name : null,
      category_emoji: category ? category.emoji || DEFAULT_EMOJI : null,
    };
  });

  if (flags.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log(
      filter
        ? `Nessuna card in ${describeCategory(filter)}.`
        : "Nessuna card trovata."
    );
    return;
  }

  const nameWidth = Math.max(4, ...rows.map((row) => row.name.length));
  const categoryWidth = Math.max(
    4,
    ...rows.map((row) => (row.category_name || "").length)
  );
  const header = [
    "ID".padEnd(36),
    "NOME".padEnd(nameWidth),
    "CATEGORIA".padEnd(categoryWidth),
  ].join("  ");
  console.log(`\n${header}`);
  console.log("-".repeat(header.length));
  for (const row of rows) {
    console.log(
      [
        row.id.padEnd(36),
        row.name.padEnd(nameWidth),
        `${row.category_emoji || DEFAULT_EMOJI} ${row.category_name || "?"}`.padEnd(
          categoryWidth + 2
        ),
      ].join("  ")
    );
  }
  console.log(`\nTotale: ${rows.length} card`);
}

// ── Comando: create-category ─────────────────────────────────────────────────
async function runCreateCategory(flags) {
  const name = flagValue(flags, "name");
  const emoji = flagValue(flags, "emoji") || DEFAULT_EMOJI;

  if (!name || !name.trim()) {
    throw new Error('Parametro mancante: --name "Nome categoria"');
  }

  const { token, userId } = await connect();
  console.error(`Creazione categoria "${name.trim()}" ${emoji}...`);

  const [category] = await apiPost(token, "user_categories", {
    user_id: userId,
    name: name.trim(),
    emoji,
  });

  if (flags.json) {
    console.log(JSON.stringify(category, null, 2));
    return;
  }

  console.log(`\nCategoria creata!`);
  console.log(`  ID:    ${category.id}`);
  console.log(`  Nome:  ${category.emoji} ${category.name}`);
  console.log(`\nUsala per un upload:`);
  console.log(
    `  node upload-card.js upload --mode remote --category ${category.id} ...`
  );
}

// ── Comando: move-card ───────────────────────────────────────────────────────
async function runMoveCard(flags) {
  const cardId = flagValue(flags, "id");
  const cardName = flagValue(flags, "name");
  const fromRef = flagValue(flags, "from");
  const toRef = flagValue(flags, "to") || flagValue(flags, "category");
  const moveAll = Boolean(flags.all);
  const dryRun = Boolean(flags["dry-run"]);

  if (!cardId && !cardName) {
    throw new Error(
      'Indica la card da spostare: --id <uuid> oppure --name "Nome card".'
    );
  }
  if (cardId && cardName) {
    throw new Error("Usa --id oppure --name, non entrambi.");
  }
  if (!toRef) {
    throw new Error(
      'Parametro mancante: --to <uuid|nome categoria>. ' +
      'Esempio: move-card --name "Albero" --to "Alfabeto"'
    );
  }

  const log = (message) => console.error(message);
  const { token } = await connect();

  log("Carico categorie e card...");
  const categories = await fetchCategories(token);
  if (categories.length === 0) {
    throw new Error("Nessuna categoria trovata: creane una con create-category.");
  }

  const destination = resolveCategory(categories, toRef, "--to");
  const source = fromRef ? resolveCategory(categories, fromRef, "--from") : null;
  const categoryById = new Map(
    categories.map((category) => [category.id, category])
  );
  const categoryName = (id) => {
    const category = categoryById.get(id);
    return category ? describeCategory(category) : id;
  };

  const cards = await fetchCards(token);

  let candidates;
  if (cardId) {
    candidates = cards.filter((card) => card.id === cardId);
    if (candidates.length === 0) {
      throw new Error(
        `Nessuna card con id ${cardId}. ` +
        "Gli UUID si vedono quando il nome è ambiguo: rilancia con --name."
      );
    }
    if (source && candidates[0].category_id !== source.id) {
      throw new Error(
        `La card "${candidates[0].name}" non è in ${describeCategory(source)}, ` +
        `ma in ${categoryName(candidates[0].category_id)}.`
      );
    }
  } else {
    candidates = cards.filter(
      (card) => foldName(card.name) === foldName(cardName)
    );
    if (source) {
      candidates = candidates.filter(
        (card) => card.category_id === source.id
      );
    }
  }

  if (candidates.length === 0) {
    const everywhere = cards.filter(
      (card) => foldName(card.name) === foldName(cardName)
    );
    if (everywhere.length > 0) {
      throw new Error(
        `Nessuna card "${cardName}" trovata` +
        (source ? ` in ${describeCategory(source)}` : "") +
        ". Card con lo stesso nome:\n" +
        everywhere
          .map(
            (card) =>
              `  ${card.id}  "${card.name}"  in ${categoryName(card.category_id)}`
          )
          .join("\n")
      );
    }

    const similar = cardName
      ? cards
          .filter(
            (card) =>
              foldName(card.name).includes(foldName(cardName)) ||
              foldName(cardName).includes(foldName(card.name))
          )
          .slice(0, 5)
      : [];
    throw new Error(
      `Nessuna card "${cardName}".` +
      (similar.length
        ? "\nForse cercavi:\n" +
          similar
            .map(
              (card) =>
                `  ${card.id}  "${card.name}"  in ${categoryName(card.category_id)}`
            )
            .join("\n")
        : " Controlla il nome con `node upload-card.js cards`.")
    );
  }

  const alreadyThere = candidates.filter(
    (card) => card.category_id === destination.id
  );
  const toMove = candidates.filter(
    (card) => card.category_id !== destination.id
  );

  if (alreadyThere.length === candidates.length) {
    if (flags.json) {
      console.log(
        JSON.stringify(
          { moved: [], skipped: alreadyThere, to: destination, dry_run: dryRun },
          null,
          2
        )
      );
    } else {
      log(
        (candidates.length === 1
          ? `La card "${candidates[0].name}" è già in`
          : `Le ${candidates.length} card sono già in`) +
        ` ${describeCategory(destination)}.`
      );
    }
    return;
  }

  if (!moveAll && candidates.length > 1) {
    throw new Error(
      `Trovate ${candidates.length} card con nome "${cardName}":\n` +
      candidates
        .map(
          (card) =>
            `  ${card.id}  "${card.name}"  in ${categoryName(card.category_id)}`
        )
        .join("\n") +
      "\nUsa --id <uuid> per sceglierne una, o --all per spostarle tutte."
    );
  }

  const moved = [];
  for (const card of toMove) {
    if (!dryRun) {
      const result = await apiPatch(
        token,
        `user_cards?id=eq.${encodeURIComponent(card.id)}`,
        { category_id: destination.id }
      );
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error(
          `La card ${card.id} non è stata aggiornata. ` +
          "Verifica che appartenga all'utente loggato (RLS)."
        );
      }
    }
    moved.push({
      id: card.id,
      name: card.name,
      from: card.category_id,
    });
  }

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          moved,
          skipped: alreadyThere.map((card) => ({ id: card.id, name: card.name })),
          to: destination,
          dry_run: dryRun,
        },
        null,
        2
      )
    );
    return;
  }

  log(
    dryRun
      ? moved.length === 1
        ? "Dry run: nessuna modifica. Sposterei questa card:"
        : `Dry run: nessuna modifica. Sposterei ${moved.length} card in ${describeCategory(destination)}:`
      : moved.length === 1
        ? "Card spostata!"
        : `Spostate ${moved.length} card in ${describeCategory(destination)}:`
  );
  for (const card of moved) {
    log(`  "${card.name}"`);
    log(`    da: ${categoryName(card.from)}`);
    log(`    a:  ${describeCategory(destination)}`);
  }
  if (alreadyThere.length > 0) {
    log(
      `Già in ${destination.name}: ` +
      alreadyThere.map((card) => `"${card.name}"`).join(", ")
    );
  }
}

// ── Modalità locale ───────────────────────────────────────────────────────────
async function runLocal({ input, start, end, image, name, key, category }) {
  const tmpWebm = trimToWebm(input, start, end);

  // Audio → public/sounds/{key}.webm
  const soundDest = join(PUBLIC_DIR, "sounds", `${key}.webm`);
  copyFileSync(tmpWebm, soundDest);
  console.log(`Audio salvato: ${soundDest}`);

  // Immagine → public/{category}/{key}.{ext}
  const imgExt = extname(image).replace(".", "").toLowerCase() || "jpg";
  const categoryDir = join(PUBLIC_DIR, category);
  if (!existsSync(categoryDir)) mkdirSync(categoryDir, { recursive: true });
  const imgDest = join(categoryDir, `${key}.${imgExt}`);
  copyFileSync(image, imgDest);
  console.log(`Immagine salvata: ${imgDest}`);

  unlinkSync(tmpWebm);

  console.log(`\nFatto (locale)!`);
  console.log(`Aggiungi manualmente in src/${category}.js:`);
  console.log(`  { id: <N>, key: '${key}', image: '${category}/${key}.${imgExt}', sound: 'sounds/${key}.webm' }`);
}

// ── Modalità remota ───────────────────────────────────────────────────────────
async function runRemote({ input, start, end, image, name, key, category }) {
  const tmpWebm = trimToWebm(input, start, end);
  const ts = Date.now();

  const { token, userId } = await connect();

  // Audio
  const audioPath = `${userId}/${ts}.webm`;
  console.log(`Upload audio → card-sounds/${audioPath}`);
  const soundUrl = await uploadToStorage(
    token, "card-sounds", audioPath,
    readFileSync(tmpWebm), "audio/webm"
  );
  console.log(`Audio URL: ${soundUrl}`);

  const imgExt = extname(image).replace(".", "").toLowerCase();
  // Immagine
  const imgPath = `${userId}/${ts}.${imgExt}`;
  console.log(`Upload immagine → card-images/${imgPath}`);
  const imageUrl = await uploadToStorage(
    token, "card-images", imgPath,
    readFileSync(image),
    IMAGE_CONTENT_TYPES[imgExt]
  );
  console.log(`Immagine URL: ${imageUrl}`);

  // DB
  console.log(`Inserimento card "${name}" nella categoria ${category}...`);
  const card = await insertCard(token, {
    userId,
    categoryId: category,
    name,
    imageUrl,
    soundUrl,
  });
  console.log(`Card creata:`, card);

  unlinkSync(tmpWebm);
  console.log(`\nFatto (remoto)!`);
}

// ── Comando: upload ───────────────────────────────────────────────────────────
async function runUpload(flags) {
  const args = parseUploadArgs(flags);
  const { mode, input, start, end, image, name, category } = args;

  if (!input || isNaN(start) || isNaN(end) || !name || !category) {
    console.error(
      "Parametri mancanti. Usa:\n" +
      "  node upload-card.js upload --mode local|remote \\\n" +
      "    --input <file.m4a|video.mp4> --start <sec> --end <sec> \\\n" +
      "    [--image <file>] --name <nome> --category <categoria|uuid> \\\n" +
      "    [--key <chiave>]  (solo local, default = name slugificato)\n\n" +
      "Con un video in --input puoi omettere --image: viene estratto\n" +
      "automaticamente il fotogramma centrale della clip."
    );
    process.exit(1);
  }

  if (end <= start) {
    throw new Error(`--end (${end}) deve essere > --start (${start})`);
  }

  // Immagine: se manca ed è un video, estraggo il fotogramma centrale.
  let autoImage = null;
  if (!image) {
    if (!isVideoFile(input)) {
      throw new Error(
        "--image mancante: con un input audio serve un'immagine (--image <file>). " +
        "Se passi un video (mp4, webm, mov…), viene estratto automaticamente il fotogramma centrale quadrato 1024x1024."
      );
    }
    autoImage = extractMidFrame(input, start, end);
    args.image = autoImage;
  }

  const imgExt = extname(args.image).replace(".", "").toLowerCase();
  if (!IMAGE_CONTENT_TYPES[imgExt]) {
    throw new Error(
      `Formato immagine non supportato: ${args.image}. Usa .jpg, .jpeg, .png, .webp o .gif ` +
      "(per un video estrai un fotogramma con ffmpeg)."
    );
  }

  try {
    if (mode === "local") {
      await runLocal(args);
    } else if (mode === "remote") {
      await runRemote(args);
    } else {
      throw new Error(`--mode non valido: ${mode} (usa "local" o "remote")`);
    }
  } finally {
    if (autoImage) {
      try {
        unlinkSync(autoImage);
      } catch {
        // Il frame temporaneo è già stato rimosso o non esiste più.
      }
    }
  }
}

// ── Comando: analyze ─────────────────────────────────────────────────────────
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildUploadCommand({ input, vehicle, category }) {
  const categoryRef = category ? shellQuote(category) : '"$CAT"';
  return (
    `node scripts/upload-card.js upload --mode remote ` +
    `--input ${shellQuote(input)} ` +
    `--start ${vehicle.start.toFixed(2)} --end ${vehicle.end.toFixed(2)} ` +
    `--image ${shellQuote(vehicle.image)} ` +
    `--name ${shellQuote(vehicle.name)} ` +
    `--category ${categoryRef}`
  );
}

function printVehicleSummary(result) {
  const nameWidth = Math.max(
    4,
    ...result.vehicles.map((vehicle) => vehicle.name.length),
  );
  console.error(`\nVeicoli trovati: ${result.vehicles.length}\n`);
  console.error(
    [
      "#".padEnd(3),
      "NOME".padEnd(nameWidth),
      "START".padStart(7),
      "END".padStart(7),
      "IMMAGINE",
    ].join("  "),
  );
  console.error("-".repeat(nameWidth + 45));
  result.vehicles.forEach((vehicle, index) => {
    console.error(
      [
        String(index + 1).padEnd(3),
        vehicle.name.padEnd(nameWidth),
        vehicle.start.toFixed(2).padStart(7),
        vehicle.end.toFixed(2).padStart(7),
        vehicle.image,
      ].join("  "),
    );
  });
  console.error("");
}

async function runAnalyze(flags) {
  const input = flagValue(flags, "input");
  if (!input) {
    throw new Error(
      'Parametro mancante: --input <video>. Esempio:\n' +
      "  node upload-card.js analyze --input scripts/tt.webm",
    );
  }

  const nameLang = flagValue(flags, "lang") || "it";
  if (!["it", "en"].includes(nameLang)) {
    throw new Error(`--lang non valido: ${nameLang} (usa "it" o "en")`);
  }

  const rawOffset = flagValue(flags, "frame-offset");
  const frameOffset = rawOffset === null ? 4 : parseFloat(rawOffset);
  if (isNaN(frameOffset) || frameOffset < 0) {
    throw new Error(`--frame-offset non valido: ${rawOffset}`);
  }

  const category = flagValue(flags, "category");
  const outDir =
    flagValue(flags, "out") ||
    join(
      dirname(input),
      `${basename(input, extname(input))}-cards`,
    );

  const result = await analyzeVideo({
    input,
    outDir,
    frameOffset,
    nameLang,
    ocr: !flags["no-ocr"],
    onProgress: (message) => console.error(message),
  });

  const commands = result.vehicles.map((vehicle) =>
    buildUploadCommand({ input, vehicle, category }),
  );

  if (flags.json) {
    console.log(
      JSON.stringify({ ...result, commands }, null, 2),
    );
    return;
  }

  printVehicleSummary(result);
  console.error(
    `Immagini salvate in: ${outDir}\n` +
    "Comandi generati su stdout" +
    (category ? ` (categoria ${category}).` : ' (usano "$CAT").') +
    "\n",
  );
  console.log(commands.join("\n\n"));
}

// ── Help ──────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
Sound Pad CLI — gestione categorie e card su Supabase

Uso:
  node upload-card.js <comando> [opzioni]

Comandi:
  upload            Crea una card (audio + immagine), locale o remota
  categories        Elenca id, icona, nome e numero card delle tue categorie
  cards             Elenca le card (id, nome, categoria)
  create-category   Crea una categoria e ne stampa l'UUID
  move-card         Sposta una card in un'altra categoria
  analyze           Analizza un video e genera i comandi di upload
  help              Mostra questo aiuto

Esempi:
  # Analizza un video e stampa i comandi pronti (log su stderr)
  export CAT=<uuid_categoria>
  node upload-card.js analyze --input scripts/tt.webm > upload.sh
  bash upload.sh

  # JSON invece dei comandi
  node upload-card.js analyze --input scripts/tt.webm --json

  # Elenca le categorie (richiede SUPABASE_PASSWORD)
  SUPABASE_PASSWORD=*** node upload-card.js categories
  SUPABASE_PASSWORD=*** node upload-card.js categories --json

  # Crea una categoria
  SUPABASE_PASSWORD=*** node upload-card.js create-category \\
    --name "Animali" --emoji "🐾"

  # Vedi le card e i loro UUID (anche filtrate per categoria)
  SUPABASE_PASSWORD=*** node upload-card.js cards
  SUPABASE_PASSWORD=*** node upload-card.js cards --category "Animali"

  # Sposta una card in un'altra categoria (prima con --dry-run)
  SUPABASE_PASSWORD=*** node upload-card.js move-card \\
    --name "Albero" --to "Alfabeto" --dry-run
  SUPABASE_PASSWORD=*** node upload-card.js move-card \\
    --id <uuid_card> --to <uuid_categoria>

  # Carica una card da un video: senza --image estrae il frame centrale
  # quadrato 1024x1024
  SUPABASE_PASSWORD=*** node upload-card.js upload --mode remote \\
    --input video.mp4 --start 0 --end 15 \\
    --name "Leone" --category <uuid_categoria>

  # Carica una card da una clip audio + immagine già pronta
  SUPABASE_PASSWORD=*** node upload-card.js upload --mode remote \\
    --input audio.m4a --start 0 --end 15 \\
    --image frame.jpg --name "Leone" --category <uuid_categoria>

  # Stesso upload ma in locale (scrive in public/)
  node upload-card.js upload --mode local \\
    --input video.mp4 --start 0 --end 15 \\
    --name "Leone" --category animals

  # Compatibilità: senza "upload" i flag valgono come upload
  node upload-card.js --mode local --input ... --name ... --category ...

Opzioni analyze:
  --input <video>       video da analizzare (obbligatorio)
  --out <dir>           cartella immagini (default: <video>-cards)
  --category <uuid>     UUID categoria nei comandi (default: "$CAT")
  --frame-offset <sec>  secondo del frame da usare (default: 4)
  --lang it|en          nomi italiani (default) o etichette originali
  --no-ocr              salta l'OCR e usa nomi generici
  --json                stampa JSON invece dei comandi

Opzioni move-card:
  --id <uuid>            card da spostare (vedi comando cards)
  --name "Nome"          in alternativa all'id; confronto senza maiuscole/accenti
  --to <uuid|nome>       categoria di destinazione (obbligatorio)
  --from <uuid|nome>     limita la ricerca a una categoria di partenza
  --all                  sposta tutte le card con quel nome
  --dry-run              mostra cosa farebbe, senza modificare nulla
  --json                 stampa JSON

Ambiente:
  SUPABASE_PASSWORD  password dell'account (obbligatoria per comandi remoti)
  SUPABASE_EMAIL     account da usare (default: ${EMAIL})

Richiede ffmpeg nel PATH per il comando upload.
`.trim());
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const aliases = {
    "list-categories": "categories",
    "add-category": "create-category",
    "list-cards": "cards",
    "move": "move-card",
    scan: "analyze",
    "import-video": "analyze",
  };

  let command = "upload";
  let tokens = argv;
  if (argv[0] && !argv[0].startsWith("-")) {
    command = aliases[argv[0]] || argv[0];
    tokens = argv.slice(1);
  }

  const flags = parseFlags(tokens);

  if (flags.help || flags.h || command === "help") {
    printHelp();
    return;
  }

  switch (command) {
    case "upload":
      await runUpload(flags);
      break;
    case "categories":
      await runCategories(flags);
      break;
    case "cards":
      await runCards(flags);
      break;
    case "create-category":
      await runCreateCategory(flags);
      break;
    case "move-card":
      await runMoveCard(flags);
      break;
    case "analyze":
      await runAnalyze(flags);
      break;
    default:
      console.error(`Comando sconosciuto: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
