#!/usr/bin/env node
/**
 * upload-card.js
 *
 * Taglia un file m4a, lo converte in webm e salva il risultato:
 *   - locale: copia i file in public/sounds/ e public/{category}/
 *   - remoto:  carica su Supabase Storage e inserisce in user_cards
 *
 * Uso LOCALE:
 *   node upload-card.js \
 *     --mode   local \
 *     --input  /path/to/file.m4a \
 *     --start  12 --end 27 \
 *     --image  /path/to/image.jpg \
 *     --name   "Nome Card" \
 *     --key    nome_chiave \          # opzionale, default = name slugificato
 *     --category animals             # nome cartella in public/ (animals, jobs, music…)
 *
 * Uso REMOTO:
 *   SUPABASE_PASSWORD=xxx node upload-card.js \
 *     --mode   remote \
 *     --input  /path/to/file.m4a \
 *     --start  12 --end 27 \
 *     --image  /path/to/image.jpg \
 *     --name   "Nome Card" \
 *     --category <uuid_categoria>
 *
 * Richiede: ffmpeg nel PATH.
 */

import { execSync } from "child_process";
import { readFileSync, copyFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

// ── Config Supabase ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://lkvurqiojgabbztkfjeo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdnVycWlvamdhYmJ6dGtmamVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzQyOTYsImV4cCI6MjA3NDU1MDI5Nn0.kI3-oq8WDi7WknWrPLejeLetmnXo0G-TMmKT3cDY-OE";
const EMAIL = "tony.dream@gmail.com";
const PASSWORD = process.env.SUPABASE_PASSWORD;

// ── Args ──────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };
  const name = get("--name");
  const rawKey = get("--key");
  const key = rawKey
    ? rawKey
    : name
    ? name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
    : null;
  return {
    mode:     get("--mode") || "remote",   // 'local' | 'remote'
    input:    get("--input"),
    start:    parseFloat(get("--start")),
    end:      parseFloat(get("--end")),
    image:    get("--image"),
    name,
    key,
    category: get("--category"),
  };
}

// ── ffmpeg ────────────────────────────────────────────────────────────────────
function trimToWebm(input, start, end) {
  const duration = end - start;
  const tmp = join(tmpdir(), `card-${Date.now()}.webm`);
  console.log(`ffmpeg: taglio ${start}s → ${end}s (${duration}s) e converto in webm...`);
  execSync(
    `ffmpeg -y -i "${input}" -ss ${start} -t ${duration} -c:a libopus -b:a 64k "${tmp}"`,
    { stdio: "inherit" }
  );
  return tmp;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
function authHeaders(token) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function login() {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Login fallito: ${data.error_description || data.message}`);
  return { token: data.access_token, userId: data.user.id };
}

async function uploadToStorage(token, bucket, path, fileBuffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": contentType,
      "Cache-Control": "31536000",
      "x-upsert": "false",
    },
    body: fileBuffer,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload ${bucket} fallito: ${JSON.stringify(data)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function insertCard(token, { userId, categoryId, name, imageUrl, soundUrl }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_cards`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      category_id: categoryId,
      user_id: userId,
      name,
      image_url: imageUrl,
      sound_url: soundUrl,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Insert card fallito: ${JSON.stringify(data)}`);
  return data;
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
  if (!PASSWORD) {
    console.error("Errore: imposta la variabile d'ambiente SUPABASE_PASSWORD");
    process.exit(1);
  }

  const tmpWebm = trimToWebm(input, start, end);
  const ts = Date.now();

  console.log(`Login come ${EMAIL}...`);
  const { token, userId } = await login();
  console.log(`Loggato. User ID: ${userId}`);

  // Audio
  const audioPath = `${userId}/${ts}.webm`;
  console.log(`Upload audio → card-sounds/${audioPath}`);
  const soundUrl = await uploadToStorage(
    token, "card-sounds", audioPath,
    readFileSync(tmpWebm), "audio/webm"
  );
  console.log(`Audio URL: ${soundUrl}`);

  // Immagine
  const imgExt = extname(image).replace(".", "").toLowerCase() || "jpg";
  const imgPath = `${userId}/${ts}.${imgExt}`;
  console.log(`Upload immagine → card-images/${imgPath}`);
  const imageUrl = await uploadToStorage(
    token, "card-images", imgPath,
    readFileSync(image),
    imgExt === "png" ? "image/png" : "image/jpeg"
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  const { mode, input, start, end, image, name, key, category } = args;

  if (!input || isNaN(start) || isNaN(end) || !image || !name || !category) {
    console.error(
      "Parametri mancanti. Usa:\n" +
      "  --mode local|remote --input <file.m4a> --start <sec> --end <sec>\n" +
      "  --image <file> --name <nome> --category <categoria|uuid>\n" +
      "  [--key <chiave>]  (solo per --mode local, default = name slugificato)"
    );
    process.exit(1);
  }

  if (end <= start) {
    console.error(`Errore: --end (${end}) deve essere > --start (${start})`);
    process.exit(1);
  }

  if (mode === "local") {
    await runLocal(args);
  } else {
    await runRemote(args);
  }
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
