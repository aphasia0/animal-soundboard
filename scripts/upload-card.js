#!/usr/bin/env node
/**
 * upload-card.js — CLI per gestire e creare card su Supabase o in locale
 * con supporto alla generazione AI via prompt (Google Gemini / TTS) o da video.
 *
 * Comandi:
 *   upload            Crea una card (audio WebM + immagine) da PROMPT o da VIDEO
 *   categories        Elenca le categorie dell'utente (id, icona, nome, n. card)
 *   cards             Elenca le card (id, nome, categoria, audio, immagine)
 *   delete-card       Elimina una card dal Database e dai bucket Storage (card-images, card-sounds)
 *   create-category   Crea una nuova categoria e stampa il suo UUID
 *   help              Mostra l'aiuto
 *
 * ── Visualizzazione e Cancellazione Card ──────────────────────────────────────
 *   # Elenca le card di una specifica categoria:
 *   SUPABASE_PASSWORD=*** node upload-card.js cards --category <uuid_o_nome_categoria>
 *
 *   # Elimina una card per ID (cancella sia DB che Storage):
 *   SUPABASE_PASSWORD=*** node upload-card.js delete-card --id <uuid_card>
 *
 *   # Elimina una card per Nome (con prima verifica via --dry-run):
 *   SUPABASE_PASSWORD=*** node upload-card.js delete-card --name "Leone" --dry-run
 *   SUPABASE_PASSWORD=*** node upload-card.js delete-card --name "Leone"
 *
 * ── Flusso da Prompt (Google AI) ──────────────────────────────────────────────
 *   # Genera immagine (Google Imagen/Gemini) e audio voce TTS (Google TTS):
 *   node upload-card.js upload \
 *     --prompt "Un leone ruggente nella savana" \
 *     --category <uuid_categoria> \
 *     --api-key <GOOGLE_API_KEY>
 *
 *   # Modalità musica (Lyria 3.5: brano completo, convertito in WebM):
 *   node upload-card.js upload \
 *     --prompt "Una sinfonia allegra di chitarra" \
 *     --audio-mode music \
 *     --seconds 20 \
 *     --category <uuid_categoria> \
 *     --api-key <GOOGLE_API_KEY>
 *
 * ── Prerequisiti ─────────────────────────────────────────────────────────────
 *   - Node.js 20+
 *   - ffmpeg nel PATH (verifica con `ffmpeg -version`)
 *   - GOOGLE_API_KEY o GEMINI_API_KEY (passata come env o flag --api-key)
 *   - SUPABASE_PASSWORD per comandi remoti
 */

import { execSync } from "child_process";
import { readFileSync, copyFileSync, mkdirSync, existsSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });
dotenv.config();

const PUBLIC_DIR = join(__dirname, "..", "public");

// ── Config Supabase ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "https://lkvurqiojgabbztkfjeo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdnVycWlvamdhYmJ6dGtmamVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzQyOTYsImV4cCI6MjA3NDU1MDI5Nn0.kI3-oq8WDi7WknWrPLejeLetmnXo0G-TMmKT3cDY-OE";
const EMAIL = process.env.SUPABASE_EMAIL || "tony.dream@gmail.com";
const PASSWORD = process.env.SUPABASE_PASSWORD;

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_EMOJI = "📁";
const IMAGE_SIZE = 1024;
const SAMPLE_RATE = 44100;
const LYRIA_MODEL = "lyria-3.5";
const DEFAULT_MUSIC_SECONDS = 20;
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
    const separator = token.indexOf("=");
    if (separator !== -1) {
      flags[token.slice(2, separator)] = token.slice(separator + 1);
      continue;
    }
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
  const prompt = flagValue(flags, "prompt") || flagValue(flags, "text");
  const additionalInfo =
    flagValue(flags, "additional-info") ||
    flagValue(flags, "info") ||
    flagValue(flags, "additional") ||
    flagValue(flags, "context");

  const rawName = flagValue(flags, "name");
  const name = rawName || (prompt ? prompt.slice(0, 35).trim() : null);
  const key = flagValue(flags, "key") || (name ? slugify(name) : null);

  const basePrompt = prompt || name;
  const fullPrompt = basePrompt
    ? additionalInfo
      ? `${basePrompt}. ${additionalInfo}`
      : basePrompt
    : null;

  const rawAudioMode = (flagValue(flags, "audio-mode") || flagValue(flags, "audio-type") || "voice").toLowerCase().trim();
  const audioMode = rawAudioMode.includes("music") ? "music" : "voice";
  const musicModel = flagValue(flags, "music-model") || flagValue(flags, "lyria-model") || LYRIA_MODEL;
  const rawSeconds = flagValue(flags, "seconds");
  const seconds = rawSeconds === null ? DEFAULT_MUSIC_SECONDS : Number(rawSeconds);

  const sharedKey =
    flagValue(flags, "api-key") ||
    flagValue(flags, "google-key") ||
    flagValue(flags, "token") ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_ACCESS_TOKEN;

  const geminiApiKey =
    flagValue(flags, "gemini-key") ||
    process.env.GEMINI_API_KEY ||
    sharedKey;

  const ttsApiKey =
    flagValue(flags, "tts-key") ||
    process.env.GOOGLE_TTS_API_KEY ||
    process.env.GOOGLE_CLOUD_API_KEY ||
    sharedKey;

  return {
    mode: flagValue(flags, "mode") || "remote", // 'local' | 'remote'
    prompt,
    additionalInfo,
    fullPrompt,
    audioMode,
    musicModel,
    seconds,
    geminiApiKey,
    ttsApiKey,
    input: flagValue(flags, "input"),
    start: parseFloat(flagValue(flags, "start")),
    end: parseFloat(flagValue(flags, "end")),
    image: flagValue(flags, "image"),
    name,
    key,
    category: flagValue(flags, "category"),
  };
}

// ── Generazione Audio Google TTS (Voice Mode) ──────────────────────────────────
async function generateGoogleTTS(text, apiKey) {
  const isFemale = Math.random() < 0.5;
  const femaleVoices = [
    "it-IT-Neural2-A",
    "it-IT-Neural2-E",
    "it-IT-Wavenet-A",
    "it-IT-Wavenet-D",
    "it-IT-Standard-A",
    "it-IT-Standard-D",
    "it-IT-Journey-F",
  ];
  const maleVoices = [
    "it-IT-Neural2-C",
    "it-IT-Wavenet-B",
    "it-IT-Wavenet-C",
    "it-IT-Standard-B",
    "it-IT-Standard-C",
    "it-IT-Journey-D",
  ];

  const pool = isFemale ? femaleVoices : maleVoices;
  const selectedVoice = pool[Math.floor(Math.random() * pool.length)];
  const selectedGender = isFemale ? "FEMALE" : "MALE";

  const isJourney = selectedVoice.includes("Journey");
  const audioConfig = { audioEncoding: "MP3" };

  if (!isJourney) {
    audioConfig.pitch = Number((Math.random() * 8.0 - 4.0).toFixed(2));
    audioConfig.speakingRate = Number((Math.random() * 0.24 + 0.88).toFixed(2));
    console.log(`🎤 Google TTS: Voce=${selectedVoice} (${selectedGender}), Pitch=${audioConfig.pitch}, Rate=${audioConfig.speakingRate}`);
  } else {
    console.log(`🎤 Google TTS: Voce=${selectedVoice} (${selectedGender}) [Voci Journey usano pitch/rate predefiniti]`);
  }

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: "it-IT",
        name: selectedVoice,
        ssmlGender: selectedGender,
      },
      audioConfig,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google TTS Fallito (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("Risposta Google TTS priva di audioContent.");
  }

  const tmpMp3 = join(tmpdir(), `tts-${Date.now()}.mp3`);
  writeFileSync(tmpMp3, Buffer.from(data.audioContent, "base64"));

  const tmpWebm = join(tmpdir(), `card-voice-${Date.now()}.webm`);
  console.log(`ffmpeg: converto TTS mp3 in WebM (libopus)...`);
  execSync(`ffmpeg -y -i "${tmpMp3}" -c:a libopus -b:a 64k "${tmpWebm}"`, { stdio: "pipe" });

  try { unlinkSync(tmpMp3); } catch {}
  return tmpWebm;
}

// ── Generazione Audio Musica (Google Lyria 3.5 Music Generation) ───────────────
function extractLyriaOutput(interaction) {
  let audio = interaction.output_audio?.data ? interaction.output_audio : null;
  const textBlocks = [];

  // Fallback documentato per le risposte con testo e audio interallacciati.
  // Come output_audio, conserva l'ultimo blocco audio generato.
  for (const step of interaction.steps || []) {
    if (step.type !== "model_output") continue;
    for (const block of step.content || []) {
      if (block.type === "audio" && block.data) {
        audio = block;
      } else if (block.type === "text" && block.text) {
        textBlocks.push(block.text);
      }
    }
  }

  return {
    audioBase64: audio?.data || null,
    mimeType: audio?.mime_type || "audio/mp3",
    text: interaction.output_text || textBlocks.join("\n"),
  };
}

function convertLyriaAudioToWebm(audioBase64, mimeType, seconds) {
  const extension = mimeType.includes("wav") ? "wav" : "mp3";
  const id = `${process.pid}-${Date.now()}`;
  const tmpAudio = join(tmpdir(), `lyria-${id}.${extension}`);
  const tmpWebm = join(tmpdir(), `card-lyria-${id}.webm`);

  writeFileSync(tmpAudio, Buffer.from(audioBase64, "base64"));
  try {
    // Lyria 3.5 può ignorare la durata richiesta e generare circa 60 secondi.
    // atrim taglia i campioni audio reali, mentre -t limita anche il container.
    console.log(`ffmpeg: converto l'audio ${extension.toUpperCase()} in WebM (libopus), massimo ${seconds} secondi...`);
    execSync(
      `ffmpeg -y -i "${tmpAudio}" -vn -map 0:a:0 -map_metadata -1 ` +
        `-af "atrim=duration=${seconds},asetpts=PTS-STARTPTS" -t ${seconds} ` +
        `-c:a libopus -b:a 64k "${tmpWebm}"`,
      { stdio: "pipe" }
    );
    return tmpWebm;
  } catch (err) {
    try { unlinkSync(tmpWebm); } catch {}
    throw err;
  } finally {
    try { unlinkSync(tmpAudio); } catch {}
  }
}

async function generateGoogleMusic(prompt, apiKey, seconds = DEFAULT_MUSIC_SECONDS) {
  if (!apiKey) {
    throw new Error("API Key Google mancante per la generazione musica con Lyria.");
  }
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("--seconds deve essere un numero maggiore di 0.");
  }

  const musicPrompt = `${prompt}\n\nDurata del brano: circa ${seconds} secondi.`;
  console.log(`🎵 Google Lyria AI: genero musica con il modello "${LYRIA_MODEL}" per "${prompt}" (${seconds} secondi)...`);

  let interaction;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });
    interaction = await client.interactions.create({
      model: LYRIA_MODEL,
      input: musicPrompt,
    });
  } catch (err) {
    throw new Error(`Generazione musica con Google Lyria (${LYRIA_MODEL}) fallita: ${err.message}`);
  }

  const { audioBase64, mimeType, text } = extractLyriaOutput(interaction);
  if (text) {
    console.log(`📝 Dettagli / Lyrics da Lyria:\n${text}`);
  }
  if (!audioBase64) {
    const status = interaction.status ? ` Stato risposta: ${interaction.status}.` : "";
    throw new Error(`Lyria (${LYRIA_MODEL}) non ha restituito audio.${status}`);
  }

  return convertLyriaAudioToWebm(audioBase64, mimeType, seconds);
}

// ── Generazione Immagine Google AI (Gemini / Imagen) ───────────────────────────
function cropAndResizeSquare(inputImgPath) {
  const tmpSquare = join(tmpdir(), `card-img-square-${Date.now()}.jpg`);
  console.log(`ffmpeg: ridimensiono e ritaglio l'immagine in ${IMAGE_SIZE}x${IMAGE_SIZE}...`);
  execSync(
    `ffmpeg -y -i "${inputImgPath}" -q:v 2 ` +
      `-vf "scale=${IMAGE_SIZE}:${IMAGE_SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${IMAGE_SIZE}:${IMAGE_SIZE}" "${tmpSquare}"`,
    { stdio: "pipe" }
  );
  try { unlinkSync(inputImgPath); } catch {}
  return tmpSquare;
}

async function generateGoogleImage(prompt, apiKey) {
  console.log(`🖼️  Google AI: genero l'immagine per "${prompt}"...`);

  // 1. Tenta con l'SDK @google/genai se disponibile
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: `A cute, colorful children's illustration for an AAC card: ${prompt}. Clean background, bright friendly style, no text.`,
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K",
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imgBuf = Buffer.from(part.inlineData.data, "base64");
          const tmpImg = join(tmpdir(), `card-gen-${Date.now()}.jpg`);
          writeFileSync(tmpImg, imgBuf);
          return cropAndResizeSquare(tmpImg);
        }
      }
    }
  } catch (err) {
    console.warn(`Avviso SDK Google GenAI: ${err.message}. Tento via endpoint Imagen 3...`);
  }

  // 2. Fallback via Imagen 3 REST API endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `A cute, colorful children's book illustration for an AAC card: ${prompt}. Friendly artwork, simple clean background, no text.`,
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
        outputMimeType: "image/jpeg",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Imagen 3 Fallito (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const b64 = data.generatedImages?.[0]?.image?.imageBytes;
  if (!b64) {
    throw new Error("Immagine non restituita da Google Imagen.");
  }

  const tmpImg = join(tmpdir(), `card-gen-${Date.now()}.jpg`);
  writeFileSync(tmpImg, Buffer.from(b64, "base64"));
  return cropAndResizeSquare(tmpImg);
}

// ── ffmpeg Clip Helper (da video) ─────────────────────────────────────────────
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
    `ffmpeg: estraggo il fotogramma centrale a ${time}s e lo ritaglio ${IMAGE_SIZE}x${IMAGE_SIZE}...`
  );
  execSync(
    `ffmpeg -y -ss ${time} -i "${input}" -frames:v 1 -update 1 -q:v 2 ` +
      `-vf "scale=${IMAGE_SIZE}:${IMAGE_SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${IMAGE_SIZE}:${IMAGE_SIZE}" "${tmp}"`,
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

async function apiDelete(token, path) {
  try {
    return await request(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "DELETE",
      headers: {
        ...authHeaders(token),
        Prefer: "return=representation",
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(`DELETE ${path} fallito: ${err.reason()}`);
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

async function deleteFromStorage(token, bucket, filePaths) {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  if (paths.length === 0) return;
  try {
    await request(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: paths }),
    });
  } catch (err) {
    console.warn(`Avviso: cancellazione file da storage ${bucket} non riuscita (${err.message})`);
  }
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

async function fetchCards(token) {
  return apiGet(
    token,
    "user_cards?select=id,name,category_id,image_url,sound_url,created_at&order=created_at.asc"
  );
}

function cardCount(category) {
  return category.card_count ?? 0;
}

// ── Ricerca e risoluzione categorie ──────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function foldName(value) {
  return String(value || "")
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
    `${flagName}: categoria "${ref}" non trovata. Categorie disponibili:\n` +
      categories.map((category) => `  ${describeCategory(category)}`).join("\n")
  );
}

// ── Modalità locale ───────────────────────────────────────────────────────────
async function runLocal({ audioWebm, imagePath, name, key, category }) {
  const soundDest = join(PUBLIC_DIR, "sounds", `${key}.webm`);
  copyFileSync(audioWebm, soundDest);
  console.log(`Audio salvato: ${soundDest}`);

  const imgExt = extname(imagePath).replace(".", "").toLowerCase() || "jpg";
  const categoryDir = join(PUBLIC_DIR, category);
  if (!existsSync(categoryDir)) mkdirSync(categoryDir, { recursive: true });
  const imgDest = join(categoryDir, `${key}.${imgExt}`);
  copyFileSync(imagePath, imgDest);
  console.log(`Immagine salvata: ${imgDest}`);

  console.log(`\nFatto (locale)!`);
  console.log(`Aggiungi manualmente in src/${category}.js:`);
  console.log(`  { id: <N>, key: '${key}', image: '/${category}/${key}.${imgExt}', sound: '/sounds/${key}.webm' }`);
}

// ── Modalità remota ───────────────────────────────────────────────────────────
async function runRemote({ audioWebm, imagePath, name, category }) {
  const ts = Date.now();
  const { token, userId } = await connect();

  // Audio WebM
  const audioPath = `${userId}/${ts}.webm`;
  console.log(`Upload audio → card-sounds/${audioPath}`);
  const soundUrl = await uploadToStorage(
    token,
    "card-sounds",
    audioPath,
    readFileSync(audioWebm),
    "audio/webm"
  );
  console.log(`Audio URL: ${soundUrl}`);

  // Immagine JPG/PNG
  const imgExt = extname(imagePath).replace(".", "").toLowerCase() || "jpg";
  const contentType = IMAGE_CONTENT_TYPES[imgExt] || "image/jpeg";
  const imgPath = `${userId}/${ts}.${imgExt}`;
  console.log(`Upload immagine → card-images/${imgPath}`);
  const imageUrl = await uploadToStorage(
    token,
    "card-images",
    imgPath,
    readFileSync(imagePath),
    contentType
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
  console.log(`✅ Card creata con successo:`, card);
  console.log(`\nFatto (remoto)!`);
}

// ── Comando: upload ───────────────────────────────────────────────────────────
async function runUpload(flags) {
  const args = parseUploadArgs(flags);
  const { mode, prompt, fullPrompt, additionalInfo, audioMode, musicModel, seconds, geminiApiKey, ttsApiKey, input, start, end, image, name, category } = args;

  let tempWebmAudio = null;
  let tempImage = null;

  try {
    if (prompt || fullPrompt) {
      if (!category) {
        throw new Error("Parametro mancante: --category <uuid_categoria|nome>");
      }

      console.log(`\n🚀 Generazione card per: "${name}"`);
      if (additionalInfo) {
        console.log(`ℹ️  Dettagli aggiuntivi per AI: "${additionalInfo}"`);
      }
      console.log(`🎯 Prompt AI completo: "${fullPrompt}"`);

      // 1. Audio generation
      if (audioMode === "music") {
        if (musicModel !== LYRIA_MODEL) {
          throw new Error(`--music-model supporta solo "${LYRIA_MODEL}".`);
        }
        const musicKey = geminiApiKey;
        if (!musicKey) {
          throw new Error(
            "API Key Google mancante per la generazione musica con Lyria. Passa --api-key <key> " +
              "oppure imposta GOOGLE_API_KEY o GEMINI_API_KEY."
          );
        }
        console.log(`Modalità Audio: MUSIC (Google ${LYRIA_MODEL}, durata richiesta ${seconds} secondi)...`);
        tempWebmAudio = await generateGoogleMusic(fullPrompt, musicKey, seconds);
      } else {
        if (!ttsApiKey) {
          throw new Error(
            "API Key Google mancante per la sintesi vocale. Passa --api-key <key> " +
              "oppure imposta GOOGLE_API_KEY o GOOGLE_TTS_API_KEY."
          );
        }
        console.log("Modalità Audio: VOICE (generazione Google Text-to-Speech)...");
        tempWebmAudio = await generateGoogleTTS(prompt || name, ttsApiKey);
      }

      // 2. Image generation
      if (!geminiApiKey) {
        throw new Error(
          "API Key Google mancante per la generazione immagini. Passa --api-key <key> " +
            "oppure imposta GOOGLE_API_KEY o GEMINI_API_KEY."
        );
      }
      console.log("Generazione Immagine con servizi Google AI...");
      tempImage = await generateGoogleImage(fullPrompt, geminiApiKey);

      args.audioWebm = tempWebmAudio;
      args.imagePath = tempImage;
    } else {
      // Flusso legacy da video / file audio
      if (!input || isNaN(start) || isNaN(end) || !name || !category) {
        console.error(
          "Parametri mancanti per upload. Usa:\n\n" +
            "  # DA PROMPT (Google AI):\n" +
            "  GOOGLE_API_KEY=*** node upload-card.js upload \\\n" +
            '    --prompt "Un leone ruggente nella savana" \\\n' +
            "    --category <uuid_categoria> [--audio-mode voice|music] [--name \"Leone\"]\n\n" +
            "  # DA VIDEO/FILE:\n" +
            "  node upload-card.js upload --mode local|remote \\\n" +
            "    --input video.mp4 --start 0 --end 15 \\\n" +
            '    [--image frame.jpg] --name "Leone" --category <categoria_id>'
        );
        process.exit(1);
      }

      if (end <= start) {
        throw new Error(`--end (${end}) deve essere > --start (${start})`);
      }

      if (!image) {
        if (!isVideoFile(input)) {
          throw new Error(
            "--image mancante: con un input audio serve un'immagine (--image <file>)."
          );
        }
        tempImage = extractMidFrame(input, start, end);
        args.imagePath = tempImage;
      } else {
        args.imagePath = image;
      }

      tempWebmAudio = trimToWebm(input, start, end);
      args.audioWebm = tempWebmAudio;
    }

    if (mode === "local") {
      await runLocal(args);
    } else if (mode === "remote") {
      await runRemote(args);
    } else {
      throw new Error(`--mode non valido: ${mode} (usa "local" o "remote")`);
    }
  } finally {
    if (tempWebmAudio) {
      try { unlinkSync(tempWebmAudio); } catch {}
    }
    if (tempImage && prompt) {
      try { unlinkSync(tempImage); } catch {}
    }
  }
}

// ── Comandi Categorie e Card ──────────────────────────────────────────────────
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

async function runCards(flags) {
  const categoryRef = flagValue(flags, "category");

  const { token } = await connect();
  console.error("Carico categorie e card...");
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
        ? `Nessuna card trovata in ${describeCategory(filter)}.`
        : "Nessuna card trovata."
    );
    return;
  }

  const nameWidth = Math.max(4, ...rows.map((row) => (row.name || "").length));
  const categoryWidth = Math.max(
    4,
    ...rows.map((row) => (row.category_name || "").length)
  );
  const header = [
    "ID".padEnd(36),
    "NOME".padEnd(nameWidth),
    "CATEGORIA".padEnd(categoryWidth + 3),
    "AUDIO",
    "IMMAGINE",
  ].join("  ");

  console.log(`\n${header}`);
  console.log("-".repeat(header.length + 30));
  for (const row of rows) {
    console.log(
      [
        row.id.padEnd(36),
        (row.name || "").padEnd(nameWidth),
        `${row.category_emoji || DEFAULT_EMOJI} ${row.category_name || "?"}`.padEnd(
          categoryWidth + 3
        ),
        row.sound_url ? "✓ Audio" : "✗ Audio",
        row.image_url ? "✓ Immagine" : "✗ Immagine",
      ].join("  ")
    );
  }
  console.log(`\nTotale: ${rows.length} card`);
}

async function runDeleteCard(flags) {
  const cardId = flagValue(flags, "id");
  const cardName = flagValue(flags, "name");
  const categoryRef = flagValue(flags, "category");
  const deleteAll = Boolean(flags.all);
  const dryRun = Boolean(flags["dry-run"]);

  if (!cardId && !cardName) {
    throw new Error(
      'Indica la card da eliminare: --id <uuid> oppure --name "Nome card".'
    );
  }

  const { token } = await connect();
  console.error("Carico categorie e card...");
  const categories = await fetchCategories(token);
  const filterCategory = categoryRef
    ? resolveCategory(categories, categoryRef, "--category")
    : null;

  const cards = await fetchCards(token);
  let candidates = [];

  if (cardId) {
    candidates = cards.filter((c) => c.id === cardId);
    if (candidates.length === 0) {
      throw new Error(`Nessuna card trovata con ID ${cardId}`);
    }
  } else {
    candidates = cards.filter(
      (c) => foldName(c.name) === foldName(cardName)
    );
    if (filterCategory) {
      candidates = candidates.filter((c) => c.category_id === filterCategory.id);
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      `Nessuna card trovata` +
        (cardName ? ` con nome "${cardName}"` : "") +
        (filterCategory ? ` in ${describeCategory(filterCategory)}` : "") +
        "."
    );
  }

  if (candidates.length > 1 && !deleteAll) {
    throw new Error(
      `Trovate ${candidates.length} card con il nome "${cardName}":\n` +
        candidates.map((c) => `  ${c.id}  "${c.name}"`).join("\n") +
        "\nUsa --id <uuid> per sceglierne una, oppure passa --all per eliminarle tutte."
    );
  }

  console.log(`\nCard identificate per l'eliminazione (${candidates.length}):`);
  for (const c of candidates) {
    console.log(`  - [${c.id}] "${c.name}"`);
    if (c.image_url) console.log(`    Immagine: ${c.image_url}`);
    if (c.sound_url) console.log(`    Audio:    ${c.sound_url}`);
  }

  if (dryRun) {
    console.log(`\n[Dry run] Nessuna modifica eseguita su DB e Storage.`);
    return;
  }

  for (const card of candidates) {
    console.log(`\nEliminazione card "${card.name}" (${card.id})...`);

    // 1. Storage cleanup - Image
    if (card.image_url && card.image_url.includes("/card-images/")) {
      const imgPath = card.image_url.split("/card-images/")[1];
      if (imgPath) {
        console.log(`  🗑️  Cancellazione immagine da storage: card-images/${imgPath}`);
        await deleteFromStorage(token, "card-images", imgPath);
      }
    }

    // 2. Storage cleanup - Sound
    if (card.sound_url && card.sound_url.includes("/card-sounds/")) {
      const sndPath = card.sound_url.split("/card-sounds/")[1];
      if (sndPath) {
        console.log(`  🗑️  Cancellazione audio da storage: card-sounds/${sndPath}`);
        await deleteFromStorage(token, "card-sounds", sndPath);
      }
    }

    // 3. Database record deletion
    console.log(`  🗑️  Cancellazione record dal database user_cards...`);
    await apiDelete(token, `user_cards?id=eq.${encodeURIComponent(card.id)}`);
    console.log(`  ✅ Card "${card.name}" eliminata con successo da DB e Storage!`);
  }

  console.log(`\nOperazione completata: ${candidates.length} card eliminate.`);
}

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
}

// ── Help ──────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
Sound Pad CLI — gestione e generazione card con Google AI e Supabase

Uso:
  node upload-card.js <comando> [opzioni]

Comandi disponibili:
  categories        Elenca tutte le categorie dell'utente
  create-category   Crea una nuova categoria (restituisce il suo UUID)
  cards             Elenca le card dell'utente (filtrabili per categoria)
  delete-card       Elimina una card dal DB e dai bucket Storage (card-images e card-sounds)
  upload            Crea una card (audio WebM + immagine) da PROMPT o da VIDEO/FILE
  help              Mostra questo manuale d'aiuto

────────────────────────────────────────────────────────────────────────────────
ESEMPI PER OGNI COMANDO
────────────────────────────────────────────────────────────────────────────────

1. Comando: categories (Elenco categorie)
  # Elenca ID, icona, nome e numero card di tutte le tue categorie
  SUPABASE_PASSWORD=*** node upload-card.js categories

  # Stampa in formato JSON
  SUPABASE_PASSWORD=*** node upload-card.js categories --json

2. Comando: create-category (Creazione categoria)
  # Crea una nuova categoria specificando nome ed emoji
  SUPABASE_PASSWORD=*** node upload-card.js create-category --name "Strumenti" --emoji "🎺"

  # Crea una categoria con emoji predefinita (📁)
  SUPABASE_PASSWORD=*** node upload-card.js create-category --name "Natura"

3. Comando: cards (Elenco card)
  # Elenca tutte le card dell'utente in tutte le categorie
  SUPABASE_PASSWORD=*** node upload-card.js cards

  # Elenca le card di una specifica categoria (per nome o UUID)
  SUPABASE_PASSWORD=*** node upload-card.js cards --category "Animali"
  SUPABASE_PASSWORD=*** node upload-card.js cards --category <uuid_categoria> --json

4. Comando: delete-card (Eliminazione card da DB e Storage)
  # Elimina una card per ID (rimuove il record da DB e i file da card-images/card-sounds)
  SUPABASE_PASSWORD=*** node upload-card.js delete-card --id <uuid_card>

  # Simula l'eliminazione per nome senza cancellare nulla (--dry-run)
  SUPABASE_PASSWORD=*** node upload-card.js delete-card --name "Leone" --dry-run

  # Elimina una card per nome, filtrando per categoria
  SUPABASE_PASSWORD=*** node upload-card.js delete-card --name "Leone" --category "Animali"

  # Elimina tutte le card corrispondenti a quel nome
  SUPABASE_PASSWORD=*** node upload-card.js delete-card --name "Gatto" --all

5. Comando: upload (Creazione e caricamento card)
  # A) Da PROMPT con Google AI (Voce TTS casuale + Immagine Gemini/Imagen):
  GOOGLE_API_KEY=*** node upload-card.js upload \\
    --prompt "Leone" \\
    --additional-info "un maestoso leone che ruggisce nella savana al tramonto" \\
    --category <uuid_categoria>

  # B) Da PROMPT in modalità MUSICA con Google Lyria 3.5:
  GOOGLE_API_KEY=*** node upload-card.js upload \\
    --prompt "Chitarra" \\
    --additional-info "una chitarra acustica di legno con note musicali colorate" \\
    --audio-mode music \\
    --seconds 20 \\
    --category <uuid_categoria>

  # C) Da PROMPT in LOCALE (salva gli asset in public/):
  GOOGLE_API_KEY=*** node upload-card.js upload \\
    --prompt "Un albero fiorito" \\
    --category animals \\
    --mode local

  # D) Da FILE VIDEO (estrae traccia audio WebM + fotogramma centrale):
  SUPABASE_PASSWORD=*** node upload-card.js upload \\
    --input video.mp4 --start 10 --end 25 \\
    --name "Leone" --category <uuid_categoria>

  # E) Da FILE AUDIO e IMMAGINE già pronti:
  SUPABASE_PASSWORD=*** node upload-card.js upload \\
    --input audio.m4a --start 0 --end 15 \\
    --image foto.jpg --name "Leone" --category <uuid_categoria>

6. Comando: help (Aiuto)
  node upload-card.js help

────────────────────────────────────────────────────────────────────────────────
PARAMETRI D'AMBIENTE E FLAG GLOBALI
────────────────────────────────────────────────────────────────────────────────
Variabili d'ambiente:
  SUPABASE_PASSWORD   Password dell'account Supabase (richiesta per comandi remoti)
  SUPABASE_EMAIL      Email dell'account (default: tony.dream@gmail.com)
  GOOGLE_API_KEY      API Key unica per Google AI (Gemini + Lyria + Text-to-Speech)
  GEMINI_API_KEY      API Key specifica per Gemini / Imagen / Lyria
  GOOGLE_TTS_API_KEY  API Key specifica per Google Text-to-Speech

Flag upload da Prompt:
  --prompt <testo>          Titolo/messaggio principale della card (es. "Gatto")
  --additional-info <info>  Dettagli aggiuntivi per guidare l'AI (es. "gatto rosso sul divano")
  --audio-mode voice|music  voice (Google TTS) o music (Google Lyria 3.5) [default: voice]
  --music-model lyria-3.5   Unico modello disponibile per la musica [default: lyria-3.5]
  --seconds <n>             Durata massima del brano in secondi [default: 20]
  --api-key <key>           Google API Key Unica (oppure imposta GOOGLE_API_KEY in .env)
  --gemini-key <key>        Chiave specifica per Gemini/Lyria (o GEMINI_API_KEY)
  --tts-key <key>           Chiave specifica per TTS (o GOOGLE_TTS_API_KEY)
  --name <nome>             Nome della card (default: testo del prompt)
  --category <uuid|nome>    UUID (per remoto) o cartella public/ (per locale)
  --mode remote|local       remote (upload Supabase) o local (salva in public/)

Flag delete-card:
  --id <uuid>               ID della card da cancellare
  --name "Nome"             Nome della card da cancellare
  --category <uuid|nome>    Filtra per categoria se ci sono più card con lo stesso nome
  --all                     Cancella tutte le card trovate con quel nome
  --dry-run                 Mostra cosa verrebbe cancellato senza eseguire
`.trim());
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const aliases = {
    "list-categories": "categories",
    "list-cards": "cards",
    "delete-card": "delete-card",
    delete: "delete-card",
    remove: "delete-card",
    "remove-card": "delete-card",
    "add-category": "create-category",
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
    case "delete-card":
      await runDeleteCard(flags);
      break;
    case "create-category":
      await runCreateCategory(flags);
      break;
    default:
      console.error(`Comando sconosciuto: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n❌ Errore: ${err.message}`);
  process.exit(1);
});
