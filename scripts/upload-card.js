#!/usr/bin/env node
/**
 * upload-card.js
 *
 * Taglia un file m4a, lo converte in webm e carica audio + immagine su Supabase.
 * Inserisce anche il record in user_cards.
 *
 * Uso:
 *   SUPABASE_PASSWORD=xxx node upload-card.js \
 *     --input  /path/to/file.m4a \
 *     --start  12 \
 *     --end    27 \
 *     --image  /path/to/image.jpg \
 *     --name   "Nome Card" \
 *     --category <category_id>
 *
 * Richiede: ffmpeg installato e raggiungibile nel PATH.
 */

import { execSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, extname } from "path";
import fetch from "node-fetch";

// ── Config ────────────────────────────────────────────────────────────────────
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
  return {
    input:    get("--input"),
    start:    parseFloat(get("--start")),
    end:      parseFloat(get("--end")),
    image:    get("--image"),
    name:     get("--name"),
    category: get("--category"),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Login fallito: ${data.error_description || data.message}`);
  return { token: data.access_token, userId: data.user.id };
}

async function uploadFile(token, bucket, path, fileBuffer, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": contentType,
        "Cache-Control": "31536000",
        "x-upsert": "false",
      },
      body: fileBuffer,
    }
  );
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!PASSWORD) {
    console.error("Errore: imposta la variabile d'ambiente SUPABASE_PASSWORD");
    process.exit(1);
  }

  const { input, start, end, image, name, category } = parseArgs();

  if (!input || isNaN(start) || isNaN(end) || !image || !name || !category) {
    console.error(
      "Uso: SUPABASE_PASSWORD=xxx node upload-card.js \\\n" +
      "  --input /path/to/file.m4a \\\n" +
      "  --start 12 --end 27 \\\n" +
      "  --image /path/to/image.jpg \\\n" +
      "  --name \"Nome Card\" \\\n" +
      "  --category <category_id>"
    );
    process.exit(1);
  }

  const duration = end - start;
  if (duration <= 0) {
    console.error(`Errore: --end (${end}) deve essere maggiore di --start (${start})`);
    process.exit(1);
  }

  // 1. Taglia e converti in webm con ffmpeg
  const tmpWebm = join(tmpdir(), `card-${Date.now()}.webm`);
  console.log(`Taglio da ${start}s a ${end}s (${duration}s) e converto in webm...`);
  execSync(
    `ffmpeg -y -i "${input}" -ss ${start} -t ${duration} -c:a libopus -b:a 64k "${tmpWebm}"`,
    { stdio: "inherit" }
  );

  const ts = Date.now();

  // 2. Login
  console.log(`Login come ${EMAIL}...`);
  const { token, userId } = await login();
  console.log(`Loggato. User ID: ${userId}`);

  // 3. Upload audio
  const audioPath = `${userId}/${ts}.webm`;
  console.log(`Upload audio → card-sounds/${audioPath}`);
  const audioBuffer = readFileSync(tmpWebm);
  const soundUrl = await uploadFile(token, "card-sounds", audioPath, audioBuffer, "audio/webm");
  console.log(`Audio URL: ${soundUrl}`);

  // 4. Upload immagine
  const imgExt = extname(image).replace(".", "").toLowerCase() || "jpg";
  const imgPath = `${userId}/${ts}.${imgExt}`;
  console.log(`Upload immagine → card-images/${imgPath}`);
  const imgBuffer = readFileSync(image);
  const imgContentType = imgExt === "png" ? "image/png" : "image/jpeg";
  const imageUrl = await uploadFile(token, "card-images", imgPath, imgBuffer, imgContentType);
  console.log(`Immagine URL: ${imageUrl}`);

  // 5. Insert DB
  console.log(`Inserimento card "${name}" nella categoria ${category}...`);
  const card = await insertCard(token, {
    userId,
    categoryId: category,
    name,
    imageUrl,
    soundUrl,
  });
  console.log(`Card creata:`, card);

  // Cleanup
  unlinkSync(tmpWebm);
  console.log(`\nFatto!`);
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
