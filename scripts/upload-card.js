#!/usr/bin/env node
/**
 * upload-card.js — CLI per gestire e creare card su Supabase o in locale
 * con supporto alla generazione AI via prompt (Nano Banana / Google TTS) o da video.
 *
 * Comandi:
 *   upload            Crea una card (audio WebM + immagine) da PROMPT o da VIDEO
 *   categories        Elenca le categorie dell'utente (id, icona, nome, n. card)
 *   cards             Elenca le card (id, nome, categoria, audio, immagine)
 *   move-card         Sposta una o più card in un'altra categoria
 *   delete-card       Elimina una card dal Database e dai bucket Storage (card-images, card-sounds)
 *   create-category   Crea una nuova categoria e imposta CAT per i comandi successivi
 *   video             Crea un video locale da una categoria Supabase (TTS del nome + audio card)
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
 *   # Genera immagine (Nano Banana / Gemini 3.1 Flash Image) e audio voce TTS:
 *   GEMINI_API_KEY=*** GOOGLE_TTS_API_KEY=*** node upload-card.js upload \
 *     --prompt "Un leone ruggente nella savana" \
 *     --category <uuid_categoria>
 *
 *   # Modalità musica (Lyria 3.5: brano completo, convertito in WebM).
 *   # Senza --seconds conserva tutta la durata generata da Lyria.
 *   GEMINI_API_KEY=*** node upload-card.js upload \
 *     --prompt "Una sinfonia allegra di chitarra" \
 *     --audio-mode music \
 *     --category <uuid_categoria>
 *
 *   # Modalità effetti (ElevenLabs Sound Effects, immagine sempre Nano Banana).
 *   GEMINI_API_KEY=*** ELEVENLABS_API_KEY=*** node upload-card.js upload \
 *     --prompt "Un tuono lontano durante un temporale" \
 *     --audio-mode effects \
 *     --seconds 8 \
 *     --category <uuid_categoria>
 *
 * ── Prerequisiti ─────────────────────────────────────────────────────────────
 *   - Node.js 20+
 *   - ffmpeg nel PATH (verifica con `ffmpeg -version`)
 *   - GEMINI_API_KEY (immagini Nano Banana + musica Lyria)
 *   - GOOGLE_TTS_API_KEY (voce Google Text-to-Speech)
 *   - ELEVENLABS_API_KEY (o ELEVENLABS_TOKEN) per --audio-mode effects
 *   - SUPABASE_EMAIL e SUPABASE_PASSWORD per comandi remoti
 */

import { execSync, spawnSync } from "child_process";
import {
  readFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  writeFileSync,
  rmSync,
} from "fs";
import { tmpdir } from "os";
import { join, extname, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env"), quiet: true });
dotenv.config({ quiet: true });

// Categoria selezionata da create-category: file locale non versionato.
const CATEGORY_STATE_FILE = join(__dirname, "..", ".soundpad-cat.env");
dotenv.config({ path: CATEGORY_STATE_FILE, quiet: true, override: true });

function selectedCategoryRef(flags) {
  return flagValue(flags, "category") || process.env.CAT || null;
}

const PUBLIC_DIR = join(__dirname, "..", "public");

// ── Config Supabase ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "https://lkvurqiojgabbztkfjeo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdnVycWlvamdhYmJ6dGtmamVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzQyOTYsImV4cCI6MjA3NDU1MDI5Nn0.kI3-oq8WDi7WknWrPLejeLetmnXo0G-TMmKT3cDY-OE";
const EMAIL = process.env.SUPABASE_EMAIL;
const PASSWORD = process.env.SUPABASE_PASSWORD;

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_EMOJI = "📁";
const IMAGE_SIZE = 1024;
const SAMPLE_RATE = 44100;
const LYRIA_MODEL = "lyria-3.5";
// Nano Banana = famiglia Gemini Flash Image, il modello Google dedicato alla
// generazione e modifica di immagini.
const NANO_BANANA_MODEL = "gemini-3.1-flash-image";
const ELEVENLABS_SFX_ENDPOINT = "https://api.elevenlabs.io/v1/sound-generation";
const ELEVENLABS_SFX_MODEL = "eleven_text_to_sound_v3";
const ELEVENLABS_SFX_OUTPUT_FORMAT = "mp3_44100_128";
const ELEVENLABS_SFX_MIN_SECONDS = 0.5;
const ELEVENLABS_SFX_MAX_SECONDS = 30;
const ELEVENLABS_SFX_TIMEOUT_MS = 240000;
const DEFAULT_VIDEO_SIZE = "1080x1080";
const DEFAULT_VIDEO_FPS = 30;
const IMAGE_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
const SENSITIVE_LOG_KEYS = new Set([
  "elevenlabs-key",
  "elevenlabs-token",
  "effects-key",
  "token",
  "password",
  "authorization",
]);

// Log diagnostici su stderr: non corrompono l'output JSON/comandi su stdout.
function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    for (const key of ["key", "api_key", "apikey", "token"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return String(rawUrl).replace(
      /([?&](?:key|api_key|apikey|token)=)[^&]+/gi,
      "$1[REDACTED]"
    );
  }
}

function redactForLog(value, seen = new WeakSet()) {
  if (Buffer.isBuffer(value)) return `<binary ${value.length} bytes>`;
  if (Array.isArray(value)) return value.map((item) => redactForLog(item, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_LOG_KEYS.has(key) ? "[REDACTED]" : redactForLog(item, seen),
      ])
    );
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return redactForLog(parsed, seen);
      }
    } catch {
      // Non è JSON: viene mostrato come testo.
    }
    if (value.length > 4000) {
      return `${value.slice(0, 4000)}… (${value.length} caratteri)`;
    }
  }
  return value;
}

function logParams(label, params) {
  console.error(label);
  console.error(JSON.stringify(redactForLog(params), null, 2));
}

// ── Autenticazione Google ─────────────────────────────────────────────────────
// Le API key di AI Studio (auth key "AQ.") viaggiano nell'header x-goog-api-key.
// Nessun supporto a token OAuth.
function cleanCredential(value) {
  return typeof value === "string" ? value.trim() : value;
}

function googleAuthHeaders(apiKey) {
  return { "x-goog-api-key": apiKey };
}

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
  const audioMode = rawAudioMode.includes("music")
    ? "music"
    : rawAudioMode.includes("effect") || rawAudioMode === "sfx"
      ? "effects"
      : "voice";
  const musicModel = flagValue(flags, "music-model") || flagValue(flags, "lyria-model") || LYRIA_MODEL;
  const rawSeconds = flagValue(flags, "seconds");
  const seconds = rawSeconds === null ? null : Number(rawSeconds);

  const geminiApiKey = cleanCredential(process.env.GEMINI_API_KEY);
  const ttsApiKey = cleanCredential(process.env.GOOGLE_TTS_API_KEY);

  const elevenLabsApiKey = cleanCredential(
    flagValue(flags, "elevenlabs-key") ||
      flagValue(flags, "elevenlabs-token") ||
      flagValue(flags, "effects-key") ||
      process.env.ELEVENLABS_API_KEY ||
      process.env.ELEVENLABS_TOKEN
  );

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
    elevenLabsApiKey,
    input: flagValue(flags, "input"),
    start: parseFloat(flagValue(flags, "start")),
    end: parseFloat(flagValue(flags, "end")),
    image: flagValue(flags, "image"),
    name,
    key,
    category: selectedCategoryRef(flags),
  };
}

// ── Generazione Audio Google TTS (Voice Mode) ──────────────────────────────────
const TTS_VOICES = {
  FEMALE: [
    "it-IT-Neural2-A",
    "it-IT-Neural2-E",
    "it-IT-Wavenet-A",
    "it-IT-Wavenet-D",
    "it-IT-Standard-A",
    "it-IT-Standard-D",
    "it-IT-Journey-F",
  ],
  MALE: [
    "it-IT-Neural2-C",
    "it-IT-Wavenet-B",
    "it-IT-Wavenet-C",
    "it-IT-Standard-B",
    "it-IT-Standard-C",
    "it-IT-Journey-D",
  ],
};

function pickTtsVoice(voice) {
  const requested = voice ? String(voice).trim() : "";
  const gender = requested.toUpperCase();

  if (!requested) {
    const randomGender = Math.random() < 0.5 ? "FEMALE" : "MALE";
    const pool = TTS_VOICES[randomGender];
    return {
      name: pool[Math.floor(Math.random() * pool.length)],
      gender: randomGender,
    };
  }

  if (gender === "FEMALE" || gender === "MALE") {
    const pool = TTS_VOICES[gender];
    return {
      name: pool[Math.floor(Math.random() * pool.length)],
      gender,
    };
  }

  return { name: requested, gender: null };
}

async function synthesizeGoogleTtsMp3(text, apiKey, options = {}) {
  const {
    voice = null,
    pitch = null,
    speakingRate = null,
    languageCode = "it-IT",
  } = options;

  const selected = pickTtsVoice(voice);
  const isJourney = selected.name.includes("Journey");
  const audioConfig = { audioEncoding: "MP3" };

  if (!isJourney) {
    audioConfig.pitch =
      pitch === null ? Number((Math.random() * 8.0 - 4.0).toFixed(2)) : pitch;
    audioConfig.speakingRate =
      speakingRate === null
        ? Number((Math.random() * 0.24 + 0.88).toFixed(2))
        : speakingRate;
    console.log(
      `🎤 Google TTS: Voce=${selected.name}${
        selected.gender ? ` (${selected.gender})` : ""
      }, Pitch=${audioConfig.pitch}, Rate=${audioConfig.speakingRate}`
    );
  } else {
    console.log(
      `🎤 Google TTS: Voce=${selected.name}${
        selected.gender ? ` (${selected.gender})` : ""
      } [Voci Journey usano pitch/rate predefiniti]`
    );
  }

  const ttsBody = {
    input: { text },
    voice: {
      languageCode,
      name: selected.name,
      ...(selected.gender ? { ssmlGender: selected.gender } : {}),
    },
    audioConfig,
  };
  const endpoint = "https://texttospeech.googleapis.com/v1/text:synthesize";
  console.error(`🌐 POST ${endpoint}`);
  logParams("   Parametri TTS:", ttsBody);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...googleAuthHeaders(apiKey),
    },
    body: JSON.stringify(ttsBody),
  });
  console.error(`   ← HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);

  if (!response.ok) {
    const errText = await response.text();
    const hint = response.status === 401
      ? "\nSuggerimento: verifica che GOOGLE_TTS_API_KEY sia una API key valida."
      : "";
    throw new Error(`Google TTS Fallito (${response.status}): ${errText}${hint}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("Risposta Google TTS priva di audioContent.");
  }
  logParams("   Risposta TTS:", {
    audioBytes: Buffer.byteLength(data.audioContent, "base64"),
  });

  const tmpMp3 = join(
    options.dir || tmpdir(),
    `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
  );
  writeFileSync(tmpMp3, Buffer.from(data.audioContent, "base64"));
  return tmpMp3;
}

async function generateGoogleTTS(text, apiKey) {
  const tmpMp3 = await synthesizeGoogleTtsMp3(text, apiKey);

  const tmpWebm = join(tmpdir(), `card-voice-${Date.now()}.webm`);
  const convertCommand = `ffmpeg -y -i "${tmpMp3}" -c:a libopus -b:a 64k "${tmpWebm}"`;
  console.log(`ffmpeg: converto TTS mp3 in WebM (libopus)...`);
  console.error(`   Comando: ${convertCommand}`);
  execSync(convertCommand, { stdio: "pipe" });

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

function convertAudioToWebm(audioBase64, mimeType, seconds = null, source = "AI") {
  const extension = mimeType.includes("wav") ? "wav" : "mp3";
  const id = `${process.pid}-${Date.now()}`;
  const tmpAudio = join(tmpdir(), `audio-${id}.${extension}`);
  const tmpWebm = join(tmpdir(), `card-audio-${id}.webm`);
  const durationLimit = Number.isFinite(seconds) && seconds > 0
    ? `-af "atrim=duration=${seconds},asetpts=PTS-STARTPTS" -t ${seconds} `
    : "";

  writeFileSync(tmpAudio, Buffer.from(audioBase64, "base64"));
  try {
    // Con --seconds taglia i campioni reali e il container; senza il flag
    // converte l'intero audio restituito dal servizio senza rimuovere nulla.
    const limitLabel = durationLimit ? `, massimo ${seconds} secondi` : ", senza taglio";
    const convertCommand =
      `ffmpeg -y -i "${tmpAudio}" -vn -map 0:a:0 -map_metadata -1 ` +
      `${durationLimit}-c:a libopus -b:a 64k "${tmpWebm}"`;
    console.log(
      `ffmpeg: converto l'audio ${extension.toUpperCase()} generato da ${source} in WebM (libopus)${limitLabel}...`
    );
    console.error(`   Comando: ${convertCommand}`);
    execSync(convertCommand, { stdio: "pipe" });
    return tmpWebm;
  } catch (err) {
    try { unlinkSync(tmpWebm); } catch {}
    throw err;
  } finally {
    try { unlinkSync(tmpAudio); } catch {}
  }
}

async function generateGoogleMusic(prompt, apiKey, seconds = null) {
  if (!apiKey) {
    throw new Error("API Key Google mancante per la generazione musica con Lyria.");
  }
  const hasDurationLimit = seconds !== null && seconds !== undefined;
  if (hasDurationLimit && (!Number.isFinite(seconds) || seconds <= 0)) {
    throw new Error("--seconds deve essere un numero maggiore di 0.");
  }

  const musicPrompt = hasDurationLimit
    ? `${prompt}\n\nDurata del brano: circa ${seconds} secondi.`
    : prompt;
  const durationLabel = hasDurationLimit ? `, ${seconds} secondi richiesti` : ", durata libera";
  console.log(`🎵 Google Lyria AI: genero musica con il modello "${LYRIA_MODEL}" per "${prompt}"${durationLabel}...`);
  const lyriaRequest = {
    model: LYRIA_MODEL,
    input: musicPrompt,
  };
  console.error("🌐 POST Interactions API (Lyria)");
  logParams("   Parametri Lyria:", lyriaRequest);

  let interaction;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });
    interaction = await client.interactions.create(lyriaRequest);
    console.error(`   ← Interaction completata: ${interaction.status || "stato sconosciuto"}`);
  } catch (err) {
    throw new Error(`Generazione musica con Google Lyria (${LYRIA_MODEL}) fallita: ${err.message}`);
  }

  const { audioBase64, mimeType, text } = extractLyriaOutput(interaction);
  logParams("   Risposta Lyria:", {
    id: interaction.id || null,
    model: interaction.model || LYRIA_MODEL,
    status: interaction.status || null,
    audioMimeType: audioBase64 ? mimeType : null,
    audioBytes: audioBase64 ? Buffer.byteLength(audioBase64, "base64") : 0,
    text: text || null,
    usage: interaction.usage || null,
  });
  if (text) {
    console.log(`📝 Dettagli / Lyrics da Lyria:\n${text}`);
  }
  if (!audioBase64) {
    const status = interaction.status ? ` Stato risposta: ${interaction.status}.` : "";
    throw new Error(`Lyria (${LYRIA_MODEL}) non ha restituito audio.${status}`);
  }

  return convertAudioToWebm(audioBase64, mimeType, seconds, "Lyria");
}

// ── Generazione Effetti (ElevenLabs Sound Effects) ────────────────────────────
async function generateElevenLabsSoundEffect(prompt, apiKey, seconds = null) {
  if (!apiKey) {
    throw new Error("API Key ElevenLabs mancante per la generazione effetti.");
  }
  const hasDuration = seconds !== null && seconds !== undefined;
  if (
    hasDuration &&
    (!Number.isFinite(seconds) ||
      seconds < ELEVENLABS_SFX_MIN_SECONDS ||
      seconds > ELEVENLABS_SFX_MAX_SECONDS)
  ) {
    throw new Error(
      `--seconds per ElevenLabs deve essere tra ${ELEVENLABS_SFX_MIN_SECONDS} e ` +
        `${ELEVENLABS_SFX_MAX_SECONDS} secondi.`
    );
  }

  // La durata viene inviata solo come parametro dedicato dell'API:
  // il prompt resta esattamente quello fornito dall'utente.
  const requestBody = {
    text: prompt,
    model_id: ELEVENLABS_SFX_MODEL,
    prompt_influence: 0.3,
  };
  if (hasDuration) requestBody.duration_seconds = seconds;

  const url = `${ELEVENLABS_SFX_ENDPOINT}?output_format=${ELEVENLABS_SFX_OUTPUT_FORMAT}`;
  const durationLabel = hasDuration ? `${seconds} secondi` : "automatica";
  console.log(`🔊 ElevenLabs Sound Effects: genero l'effetto (${durationLabel})...`);
  console.error(`🌐 POST ${ELEVENLABS_SFX_ENDPOINT}?output_format=${ELEVENLABS_SFX_OUTPUT_FORMAT}`);
  logParams("   Parametri ElevenLabs:", requestBody);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(ELEVENLABS_SFX_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`Richiesta ElevenLabs fallita: ${err.message}`);
  }
  console.error(`   ← HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs Sound Effects fallito (${response.status}): ${errText}`);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (audioBuffer.length === 0) {
    throw new Error("ElevenLabs non ha restituito audio.");
  }
  logParams("   Risposta ElevenLabs:", {
    contentType,
    audioBytes: audioBuffer.length,
    requestedDurationSeconds: hasDuration ? seconds : null,
  });

  return convertAudioToWebm(
    audioBuffer.toString("base64"),
    contentType,
    seconds,
    "ElevenLabs"
  );
}

// ── Generazione Immagine Google AI (Nano Banana) ──────────────────────────────
function cropAndResizeSquare(inputImgPath) {
  const tmpSquare = join(tmpdir(), `card-img-square-${Date.now()}.jpg`);
  const cropCommand =
    `ffmpeg -y -i "${inputImgPath}" -q:v 2 ` +
    `-vf "scale=${IMAGE_SIZE}:${IMAGE_SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${IMAGE_SIZE}:${IMAGE_SIZE}" "${tmpSquare}"`;
  console.log(`ffmpeg: ridimensiono e ritaglio l'immagine in ${IMAGE_SIZE}x${IMAGE_SIZE}...`);
  console.error(`   Comando: ${cropCommand}`);
  execSync(cropCommand, { stdio: "pipe" });
  try { unlinkSync(inputImgPath); } catch {}
  return tmpSquare;
}

function saveGeneratedImage(imageBase64, mimeType = null) {
  const extension = mimeType?.includes("png")
    ? "png"
    : mimeType?.includes("webp")
      ? "webp"
      : "jpg";
  const tmpImg = join(tmpdir(), `card-gen-${Date.now()}.${extension}`);
  writeFileSync(tmpImg, Buffer.from(imageBase64, "base64"));
  return cropAndResizeSquare(tmpImg);
}

async function generateGoogleImage(prompt, apiKey) {
  console.log(
    `🍌 Nano Banana (${NANO_BANANA_MODEL}): genero l'immagine per "${prompt}"...`
  );
  const imagePrompt =
    `A cute, colorful children's illustration for an AAC card: ${prompt}. ` +
    "Clean background, bright friendly style, no text.";

  // 1. SDK @google/genai (percorso principale)
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const imageRequest = {
      model: NANO_BANANA_MODEL,
      contents: imagePrompt,
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    };
    console.error("🌐 POST generateContent (Nano Banana SDK)");
    logParams("   Parametri immagine:", imageRequest);

    const response = await ai.models.generateContent(imageRequest);

    const candidate = response.candidates?.[0];
    console.error(`   ← Candidati immagine: ${response.candidates?.length || 0}`);
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imgBuf = Buffer.from(part.inlineData.data, "base64");
          logParams("   Risposta immagine:", {
            mimeType: part.inlineData.mimeType || null,
            imageBytes: imgBuf.length,
          });
          return saveGeneratedImage(
            part.inlineData.data,
            part.inlineData.mimeType
          );
        }
      }
    }
    console.warn(
      "Avviso SDK Nano Banana: nessuna immagine nella risposta. Tento via REST..."
    );
  } catch (err) {
    console.warn(
      `Avviso SDK Nano Banana: ${err.message}. Tento via REST...`
    );
  }

  // 2. Fallback REST sullo stesso modello Nano Banana
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${NANO_BANANA_MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  };
  console.error(`🌐 POST ${endpoint}`);
  logParams("   Parametri Nano Banana:", body);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...googleAuthHeaders(apiKey),
    },
    body: JSON.stringify(body),
  });
  console.error(`   ← HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);

  if (!response.ok) {
    const errText = await response.text();
    const hint = response.status === 401
      ? "\nSuggerimento: verifica che GEMINI_API_KEY sia una API key completa " +
        "di AI Studio (AQ.…) abilitata alla Generative Language API."
      : "";
    throw new Error(`Nano Banana Fallito (${response.status}): ${errText}${hint}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart) {
    throw new Error("Immagine non restituita da Nano Banana.");
  }
  logParams("   Risposta Nano Banana:", {
    candidates: data.candidates?.length || 0,
    mimeType: imagePart.inlineData.mimeType || null,
    imageBytes: Buffer.byteLength(imagePart.inlineData.data, "base64"),
  });

  return saveGeneratedImage(
    imagePart.inlineData.data,
    imagePart.inlineData.mimeType
  );
}

// ── ffmpeg Clip Helper (da video) ─────────────────────────────────────────────
function trimToWebm(input, start, end) {
  const duration = end - start;
  const tmp = join(tmpdir(), `card-${Date.now()}.webm`);
  const trimCommand =
    `ffmpeg -y -i "${input}" -ss ${start} -t ${duration} -vn -c:a libopus -b:a 64k "${tmp}"`;
  console.log(`ffmpeg: taglio ${start}s → ${end}s (${duration}s) e converto in webm...`);
  console.error(`   Comando: ${trimCommand}`);
  execSync(trimCommand, { stdio: "inherit" });
  return tmp;
}

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "avi", "ogv"]);

function isVideoFile(input) {
  return VIDEO_EXTENSIONS.has(extname(input).replace(".", "").toLowerCase());
}

function extractMidFrame(input, start, end) {
  const time = ((start + end) / 2).toFixed(2);
  const tmp = join(tmpdir(), `card-frame-${Date.now()}.jpg`);
  const frameCommand =
    `ffmpeg -y -ss ${time} -i "${input}" -frames:v 1 -update 1 -q:v 2 ` +
    `-vf "scale=${IMAGE_SIZE}:${IMAGE_SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${IMAGE_SIZE}:${IMAGE_SIZE}" "${tmp}"`;
  console.log(
    `ffmpeg: estraggo il fotogramma centrale a ${time}s e lo ritaglio ${IMAGE_SIZE}x${IMAGE_SIZE}...`
  );
  console.error(`   Comando: ${frameCommand}`);
  execSync(frameCommand, { stdio: "inherit" });
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
  const method = (options.method || "GET").toUpperCase();
  const safeUrl = redactUrl(url);
  let res;
  let text;
  console.error(`🌐 ${method} ${safeUrl}`);
  if (options.body !== undefined) {
    logParams("   Parametri richiesta:", options.body);
  }
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
    text = await res.text();
    console.error(`   ← HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Timeout dopo ${REQUEST_TIMEOUT_MS / 1000}s: ${safeUrl}`);
    }
    throw new Error(`Richiesta fallita (${safeUrl}): ${err.message}`);
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
  if (!EMAIL) {
    throw new Error(
      "Imposta la variabile d'ambiente SUPABASE_EMAIL (email dell'account Supabase)."
    );
  }
  if (!PASSWORD) {
    throw new Error(
      `Imposta la variabile d'ambiente SUPABASE_PASSWORD (password dell'account ${EMAIL}).`
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

function splitFlagList(value) {
  if (value === null || value === undefined) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
  const { mode, prompt, fullPrompt, additionalInfo, audioMode, musicModel, seconds, geminiApiKey, ttsApiKey, elevenLabsApiKey, input, start, end, image, name, key, category } = args;

  logParams("📋 Parametri upload:", {
    mode,
    prompt,
    additionalInfo,
    fullPrompt,
    name,
    key,
    category,
    audioMode,
    musicModel,
    seconds: seconds === null ? "nessun taglio" : seconds,
    input,
    start: Number.isFinite(start) ? start : null,
    end: Number.isFinite(end) ? end : null,
    image,
    geminiApiKey: geminiApiKey ? "GEMINI_API_KEY configurata" : "GEMINI_API_KEY assente",
    ttsApiKey: ttsApiKey ? "GOOGLE_TTS_API_KEY configurata" : "GOOGLE_TTS_API_KEY assente",
    elevenLabsApiKey: elevenLabsApiKey ? "configurata" : "assente",
  });

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
            "GEMINI_API_KEY mancante per la generazione musica con Lyria."
          );
        }
        const durationLabel = seconds === null ? "nessun taglio" : `${seconds} secondi`;
        console.log(`Modalità Audio: MUSIC (Google ${LYRIA_MODEL}, ${durationLabel})...`);
        tempWebmAudio = await generateGoogleMusic(fullPrompt, musicKey, seconds);
      } else if (audioMode === "effects") {
        if (!elevenLabsApiKey) {
          throw new Error(
            "API Key ElevenLabs mancante per la generazione effetti. Passa --elevenlabs-key <key> " +
              "oppure imposta ELEVENLABS_API_KEY o ELEVENLABS_TOKEN."
          );
        }
        const durationLabel = seconds === null ? "durata automatica" : `${seconds} secondi`;
        console.log(
          `Modalità Audio: EFFECTS (ElevenLabs ${ELEVENLABS_SFX_MODEL}, ${durationLabel})...`
        );
        tempWebmAudio = await generateElevenLabsSoundEffect(
          fullPrompt,
          elevenLabsApiKey,
          seconds
        );
      } else {
        if (!ttsApiKey) {
          throw new Error(
            "GOOGLE_TTS_API_KEY mancante per la sintesi vocale."
          );
        }
        console.log("Modalità Audio: VOICE (generazione Google Text-to-Speech)...");
        tempWebmAudio = await generateGoogleTTS(prompt || name, ttsApiKey);
      }

      // 2. Image generation
      if (!geminiApiKey) {
        throw new Error(
          "GEMINI_API_KEY mancante per la generazione immagini."
        );
      }
      console.log(`Generazione Immagine con Nano Banana (${NANO_BANANA_MODEL})...`);
      tempImage = await generateGoogleImage(fullPrompt, geminiApiKey);

      args.audioWebm = tempWebmAudio;
      args.imagePath = tempImage;
    } else {
      // Flusso legacy da video / file audio
      if (!input || isNaN(start) || isNaN(end) || !name || !category) {
        console.error(
          "Parametri mancanti per upload. Usa:\n\n" +
            "  # DA PROMPT (Google AI):\n" +
            "  GEMINI_API_KEY=*** GOOGLE_TTS_API_KEY=*** node upload-card.js upload \\\n" +
            '    --prompt "Un leone ruggente nella savana" \\\n' +
            "    --category <uuid_categoria> [--audio-mode voice|music|effects] [--name \"Leone\"]\n\n" +
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
  const categoryRef = selectedCategoryRef(flags);

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

// ── Comando: move-card (sposta card tra categorie) ────────────────────────────
async function runMoveCard(flags) {
  const toRef = flagValue(flags, "to") || flagValue(flags, "destination");
  const fromRef = flagValue(flags, "from") || flagValue(flags, "source");
  const moveAll = Boolean(flags.all);
  const dryRun = Boolean(flags["dry-run"]);
  const jsonOutput = Boolean(flags.json);
  const info = jsonOutput ? console.error : console.log;

  const ids = [
    ...splitFlagList(flagValue(flags, "id")),
    ...splitFlagList(flagValue(flags, "ids")),
  ];
  const names = [
    ...splitFlagList(flagValue(flags, "name")),
    ...splitFlagList(flagValue(flags, "names")),
  ];

  if (!toRef) {
    throw new Error('Parametro mancante: --to <uuid|nome categoria di destinazione>');
  }
  if (moveAll && (ids.length > 0 || names.length > 0)) {
    throw new Error("Usa --all da solo, oppure --id/--ids/--name/--names per scegliere le card.");
  }
  if (!moveAll && ids.length === 0 && names.length === 0) {
    throw new Error(
      "Indica le card da spostare: --id <uuid>, --ids <uuid1,uuid2>, " +
        '--name "Leone", --names "Leone,Gatto", oppure --all --from <categoria>.'
    );
  }
  if (moveAll && !fromRef) {
    throw new Error(
      "--all richiede --from <categoria>: sposterebbe tutte le card dell'utente."
    );
  }

  const { token } = await connect();
  console.error("Carico categorie e card...");
  const categories = await fetchCategories(token);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const destination = resolveCategory(categories, toRef, "--to");
  const source = fromRef ? resolveCategory(categories, fromRef, "--from") : null;

  if (source && source.id === destination.id) {
    throw new Error(
      `La categoria di partenza e quella di destinazione coincidono: ${describeCategory(destination)}`
    );
  }

  const cards = await fetchCards(token);
  const cardById = new Map(cards.map((card) => [card.id, card]));
  let candidates = [];
  let unscopedMatches = new Map();

  if (ids.length > 0) {
    const missing = [];
    for (const id of ids) {
      const card = cardById.get(id);
      if (card) candidates.push(card);
      else missing.push(id);
    }
    if (missing.length > 0) {
      throw new Error(`Card non trovate con ID:\n  ${missing.join("\n  ")}`);
    }
  } else if (names.length > 0) {
    for (const name of names) {
      const matches = cards.filter((card) => foldName(card.name) === foldName(name));
      const scoped = source
        ? matches.filter((card) => card.category_id === source.id)
        : matches;

      if (matches.length === 0) {
        throw new Error(`Nessuna card trovata con nome "${name}".`);
      }
      if (scoped.length === 0) {
        throw new Error(
          `La card "${name}" non è in ${describeCategory(source)}. Si trova in:\n` +
            matches
              .map((card) => {
                const category = categoryById.get(card.category_id);
                return `  ${card.id}  "${card.name}" in ${
                  category ? describeCategory(category) : card.category_id
                }`;
              })
              .join("\n")
        );
      }
      if (scoped.length > 1) {
        throw new Error(
          `Più card si chiamano "${name}" nella stessa categoria:\n` +
            scoped.map((card) => `  ${card.id}  "${card.name}"`).join("\n") +
            "\nUsa --id <uuid> per scegliere quella giusta."
        );
      }
      if (!source && matches.length > 1) {
        unscopedMatches.set(name, matches);
      }
      candidates.push(scoped[0]);
    }

    if (unscopedMatches.size > 0) {
      const lines = [];
      for (const [name, matches] of unscopedMatches) {
        lines.push(`"${name}":`);
        for (const card of matches) {
          const category = categoryById.get(card.category_id);
          lines.push(
            `  ${card.id}  in ${category ? describeCategory(category) : card.category_id}`
          );
        }
      }
      throw new Error(
        "Alcune card con lo stesso nome esistono in più categorie. " +
          "Aggiungi --from <categoria> per disambiguare:\n" +
          lines.join("\n")
      );
    }
  } else {
    candidates = cards.filter((card) => card.category_id === source.id);
  }

  if (source) {
    const outside = candidates.filter((card) => card.category_id !== source.id);
    if (outside.length > 0) {
      throw new Error(
        `Queste card non sono in ${describeCategory(source)}:\n` +
          outside
            .map((card) => {
              const category = categoryById.get(card.category_id);
              return `  ${card.id}  "${card.name}" in ${
                category ? describeCategory(category) : card.category_id
              }`;
            })
            .join("\n")
      );
    }
  }

  // Deduplica (es. stesso id indicato con --id e --ids)
  candidates = [...new Map(candidates.map((card) => [card.id, card])).values()];

  const alreadyThere = candidates.filter(
    (card) => card.category_id === destination.id
  );
  candidates = candidates.filter((card) => card.category_id !== destination.id);

  if (alreadyThere.length > 0) {
    info(
      `ℹ️  ${alreadyThere.length} card già in ${describeCategory(destination)}, saltate:`
    );
    for (const card of alreadyThere) {
      info(`  - "${card.name}" (${card.id})`);
    }
  }

  if (candidates.length === 0) {
    info("\nNessuna card da spostare.");
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            source,
            destination,
            moved: [],
            failed: [],
            alreadyThere: alreadyThere.map((card) => ({ id: card.id, name: card.name })),
          },
          null,
          2
        )
      );
    }
    return;
  }

  info(
    `\nSposto ${candidates.length} card verso ${describeCategory(destination)}:`
  );
  for (const card of candidates) {
    const category = categoryById.get(card.category_id);
    info(
      `  - "${card.name}" (${card.id})  ${
        category ? `da ${describeCategory(category)}` : "categoria sconosciuta"
      }`
    );
  }

  if (dryRun) {
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            source,
            destination,
            cards: candidates.map((card) => ({
              id: card.id,
              name: card.name,
              from_category_id: card.category_id,
            })),
            alreadyThere: alreadyThere.map((card) => ({ id: card.id, name: card.name })),
          },
          null,
          2
        )
      );
    } else {
      console.log("\n[Dry run] Nessuna modifica eseguita su Supabase.");
    }
    return;
  }

  const moved = [];
  const failed = [];

  for (const card of candidates) {
    const category = categoryById.get(card.category_id);
    info(
      `\n🔀 Sposto "${card.name}" da ${
        category ? describeCategory(category) : card.category_id
      } → ${describeCategory(destination)}...`
    );
    try {
      const updated = await apiPatch(
        token,
        `user_cards?id=eq.${encodeURIComponent(card.id)}`,
        { category_id: destination.id }
      );
      if (!Array.isArray(updated) || updated.length === 0) {
        throw new Error("nessuna riga aggiornata (permessi o card inesistente)");
      }
      moved.push(card);
      info(`  ✅ Spostata.`);
    } catch (err) {
      failed.push({ card, message: err.message });
      console.warn(`  ⚠️  Salto "${card.name}": ${err.message}`);
    }
  }

  if (failed.length > 0) {
    console.warn(`\n⚠️  Card non spostate (${failed.length}):`);
    for (const failure of failed) {
      console.warn(`  - "${failure.card.name}": ${failure.message}`);
    }
  }
  info(`\nRiepilogo: ${moved.length} card spostate, ${failed.length} fallite.`);

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          source,
          destination,
          moved: moved.map((card) => ({ id: card.id, name: card.name })),
          failed: failed.map((failure) => ({
            id: failure.card.id,
            name: failure.card.name,
            error: failure.message,
          })),
          alreadyThere: alreadyThere.map((card) => ({ id: card.id, name: card.name })),
        },
        null,
        2
      )
    );
  }

  if (moved.length === 0) {
    throw new Error("Nessuna card è stata spostata.");
  }
}

async function runDeleteCard(flags) {
  const cardId = flagValue(flags, "id");
  const cardName = flagValue(flags, "name");
  const categoryRef = selectedCategoryRef(flags);
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

  // Salva la categoria corrente così i comandi successivi la usano di default.
  process.env.CAT = category.id;
  writeFileSync(CATEGORY_STATE_FILE, `CAT=${category.id}\n`);
  console.error(`CAT=${category.id} salvata in ${CATEGORY_STATE_FILE}`);

  if (flags.export) {
    console.log(`export CAT=${category.id}`);
    return;
  }

  if (flags.json) {
    console.log(JSON.stringify(category, null, 2));
    return;
  }

  console.log(`\nCategoria creata!`);
  console.log(`  ID:    ${category.id}`);
  console.log(`  Nome:  ${category.emoji} ${category.name}`);
  console.log(`\nCAT=${category.id} impostata automaticamente per i prossimi comandi.`);
  console.log(`Per esportarla anche in questa shell: export CAT=${category.id}`);
}

// ── Comando: video (categoria Supabase → video locale) ────────────────────────
function safeFileName(value, fallback = "video") {
  const cleaned = String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

function extensionFromUrl(url) {
  try {
    return extname(new URL(url).pathname).replace(".", "").toLowerCase() || "bin";
  } catch {
    return "bin";
  }
}

async function downloadToFile(url, dir, prefix) {
  console.error(`🌐 GET ${redactUrl(url)}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Download fallito (${response.status}) da ${redactUrl(url)}`
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const file = join(
    dir,
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFromUrl(url)}`
  );
  writeFileSync(file, buffer);
  console.error(`   ← ${buffer.length} bytes → ${file}`);
  return file;
}

function runFfmpeg(args, label) {
  const display = ["ffmpeg", ...args]
    .map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
    .join(" ");
  if (label) console.log(label);
  console.error(`   Comando: ${display}`);

  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.error) {
    throw new Error(`Impossibile eseguire ffmpeg: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = (result.stderr || "").trim().split("\n").slice(-3).join(" ");
    throw new Error(`ffmpeg fallito (exit ${result.status}): ${details}`);
  }
}

function videoScaleFilter(size) {
  const [width, height] = size.split("x");
  return (
    `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,format=yuv420p`
  );
}

// Costruisce un segmento video: immagine fissa + [TTS del nome][audio Supabase],
// oppure [audio Supabase][TTS del nome] con --audio-order sound-first.
async function buildCardSegment({
  card,
  index,
  apiKey,
  voice,
  languageCode,
  size,
  fps,
  soundFirst,
  gap,
  workDir,
}) {
  if (!card.image_url) throw new Error("immagine mancante su Supabase");
  if (!card.sound_url) throw new Error("audio mancante su Supabase");

  console.log(`🖼️  Scarico l'immagine della card...`);
  const imagePath = await downloadToFile(card.image_url, workDir, `img-${index}`);

  console.log(`🔊 Scarico l'audio della card...`);
  const soundPath = await downloadToFile(card.sound_url, workDir, `snd-${index}`);

  console.log(`🗣️  Genero il TTS del nome "${card.name}"...`);
  const ttsPath = await synthesizeGoogleTtsMp3(card.name, apiKey, {
    voice,
    languageCode,
    pitch: 0,
    speakingRate: 1,
    dir: workDir,
  });

  const sequence = soundFirst ? [soundPath, ttsPath] : [ttsPath, soundPath];
  const inputs = [];
  const audioChains = [];

  sequence.forEach((file, position) => {
    inputs.push("-i", file);
    const pad = gap > 0 ? `,apad=pad_dur=${gap}` : "";
    audioChains.push(
      `[${position + 1}:a]aresample=44100:async=1,` +
        `aformat=sample_fmts=fltp:channel_layouts=stereo${pad}[a${position}]`
    );
  });

  const concatInputs = sequence.map((_, position) => `[a${position}]`).join("");
  const filter =
    `[0:v]${videoScaleFilter(size)}[vout];` +
    audioChains.join(";") +
    `;${concatInputs}concat=n=${sequence.length}:v=0:a=1[aout]`;

  const segmentPath = join(workDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
  runFfmpeg(
    [
      "-loop", "1",
      "-framerate", String(fps),
      "-i", imagePath,
      ...inputs,
      "-filter_complex", filter,
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "stillimage",
      "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-c:a", "aac",
      "-b:a", "128k",
      "-ar", "44100",
      "-ac", "2",
      "-shortest",
      "-movflags", "+faststart",
      segmentPath,
    ],
    `🎬 Creo il segmento ${index + 1}: "${card.name}"`
  );

  return { path: segmentPath, card, index };
}

async function concatVideoSegments(segmentPaths, outputPath, workDir) {
  const listPath = join(workDir, "concat-list.txt");
  const list = segmentPaths
    .map((segment) => `file '${segment.replace(/'/g, "'\\''")}'`)
    .join("\n");
  writeFileSync(listPath, `${list}\n`);

  runFfmpeg(
    [
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      "-movflags", "+faststart",
      outputPath,
    ],
    "🎞️  Unisco tutti i segmenti in un unico video..."
  );
}

async function runVideo(flags) {
  const categoryRef = selectedCategoryRef(flags);
  if (!categoryRef) {
    throw new Error('Parametro mancante: --category <uuid_categoria|nome>');
  }

  const apiKey = cleanCredential(process.env.GOOGLE_TTS_API_KEY);
  if (!apiKey) {
    throw new Error(
      "GOOGLE_TTS_API_KEY mancante per il text-to-speech."
    );
  }

  const outDir = resolve(flagValue(flags, "out") || join(process.cwd(), "videos"));
  const perCard = Boolean(flags["per-card"]);
  const size = (flagValue(flags, "size") || DEFAULT_VIDEO_SIZE).toLowerCase();
  if (!/^\d{2,5}x\d{2,5}$/.test(size)) {
    throw new Error(`--size non valido: ${size} (usa ad esempio 1080x1080)`);
  }

  const fps = Number(flagValue(flags, "fps") || DEFAULT_VIDEO_FPS);
  if (!Number.isFinite(fps) || fps <= 0 || fps > 60) {
    throw new Error(`--fps non valido: ${flagValue(flags, "fps")} (1-60)`);
  }

  const gap = Number(flagValue(flags, "gap") || 0);
  if (!Number.isFinite(gap) || gap < 0) {
    throw new Error(`--gap non valido: ${flagValue(flags, "gap")} (secondi >= 0)`);
  }

  const order = (flagValue(flags, "order") || "created").toLowerCase();
  if (!["created", "name"].includes(order)) {
    throw new Error(`--order non valido: ${order} (usa "created" o "name")`);
  }

  const audioOrder = (flagValue(flags, "audio-order") || "name-first").toLowerCase();
  if (!["name-first", "sound-first"].includes(audioOrder)) {
    throw new Error(
      `--audio-order non valido: ${audioOrder} (usa "name-first" o "sound-first")`
    );
  }

  const voice = pickTtsVoice(flagValue(flags, "voice")).name;
  const languageCode = flagValue(flags, "lang") || "it-IT";
  const rawLimit = flagValue(flags, "limit");
  const limit = rawLimit === null ? null : Number(rawLimit);
  if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error(`--limit non valido: ${rawLimit} (intero > 0)`);
  }

  logParams("📋 Parametri video:", {
    category: categoryRef,
    out: outDir,
    perCard,
    size,
    fps,
    gap,
    order,
    audioOrder,
    voice: voice || "casuale (una sola voce per tutte le card)",
    languageCode,
    limit,
    apiKey: "configurata",
  });

  const { token } = await connect();
  console.error("Carico categorie e card...");
  const categories = await fetchCategories(token);
  const category = resolveCategory(categories, categoryRef, "--category");

  let cards = (await fetchCards(token)).filter(
    (card) => card.category_id === category.id
  );
  if (order === "name") {
    cards.sort((a, b) => String(a.name).localeCompare(String(b.name), "it"));
  }
  if (limit !== null) cards = cards.slice(0, limit);

  if (cards.length === 0) {
    throw new Error(`Nessuna card trovata in ${describeCategory(category)}.`);
  }

  console.log(
    `\n🎬 Creo il video per ${describeCategory(category)} (${cards.length} card)`
  );

  mkdirSync(outDir, { recursive: true });
  const workDir = join(
    tmpdir(),
    `soundpad-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(workDir, { recursive: true });

  const baseName = safeFileName(
    flagValue(flags, "name") || slugify(category.name),
    "categoria"
  );
  const results = [];
  const failures = [];

  try {
    for (const [index, card] of cards.entries()) {
      console.log(`\n── Card ${index + 1}/${cards.length}: "${card.name}" ──`);
      try {
        const segment = await buildCardSegment({
          card,
          index,
          apiKey,
          voice,
          languageCode,
          size,
          fps,
          soundFirst: audioOrder === "sound-first",
          gap,
          workDir,
        });
        results.push(segment);
      } catch (err) {
        failures.push({ card, message: err.message });
        console.warn(`⚠️  Salto "${card.name}": ${err.message}`);
      }
    }

    if (results.length === 0) {
      throw new Error("Nessun segmento video generato: tutte le card sono fallite.");
    }

    if (perCard) {
      for (const { path, card, index } of results) {
        const fileName = `${baseName}-${String(index + 1).padStart(2, "0")}-${safeFileName(
          card.name,
          "card"
        )}.mp4`;
        const dest = join(outDir, fileName);
        copyFileSync(path, dest);
        console.log(`✅ Video card salvato: ${dest}`);
      }
    } else {
      const outputPath = join(outDir, `${baseName}.mp4`);
      await concatVideoSegments(
        results.map((result) => result.path),
        outputPath,
        workDir
      );
      console.log(`\n✅ Video creato: ${outputPath}`);
    }

    if (failures.length > 0) {
      console.warn(`\n⚠️  Card saltate (${failures.length}):`);
      for (const failure of failures) {
        console.warn(`  - ${failure.card.name}: ${failure.message}`);
      }
    }
    console.log(
      `\nRiepilogo: ${results.length} card incluse, ${failures.length} saltate.`
    );
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {}
  }
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
  move-card         Sposta una o più card in un'altra categoria
  delete-card       Elimina una card dal DB e dai bucket Storage (card-images e card-sounds)
  upload            Crea una card (audio WebM + immagine) da PROMPT o da VIDEO/FILE
  video             Crea un video locale partendo da una categoria Supabase
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
  # Crea una nuova categoria specificando nome ed emoji.
  # L'UUID viene salvato in .soundpad-cat.env e diventa il valore di CAT
  # usato dai comandi successivi quando --category viene omesso.
  SUPABASE_PASSWORD=*** node upload-card.js create-category --name "Strumenti" --emoji "🎺"

  # Crea una categoria con emoji predefinita (📁)
  SUPABASE_PASSWORD=*** node upload-card.js create-category --name "Natura"

  # Imposta CAT anche nella shell corrente (eval):
  eval "$(SUPABASE_PASSWORD=*** node upload-card.js create-category --name "Natura" --export)"

3. Comando: cards (Elenco card)
  # Elenca tutte le card dell'utente in tutte le categorie
  SUPABASE_PASSWORD=*** node upload-card.js cards

  # Elenca le card di una specifica categoria (per nome o UUID)
  SUPABASE_PASSWORD=*** node upload-card.js cards --category "Animali"
  SUPABASE_PASSWORD=*** node upload-card.js cards --category <uuid_categoria> --json

4. Comando: move-card (Sposta card tra categorie)
  # Sposta una card per nome (confronto senza maiuscole/accenti)
  SUPABASE_PASSWORD=*** node upload-card.js move-card \\
    --name "Leone" --to "Animali"

  # Sposta più card in una volta (nomi separati da virgola)
  SUPABASE_PASSWORD=*** node upload-card.js move-card \\
    --names "Leone,Tigre,Orso" --to "Animali"

  # Sposta per UUID (uno o più separati da virgola)
  SUPABASE_PASSWORD=*** node upload-card.js move-card \\
    --ids <uuid1>,<uuid2> --to <uuid_categoria>

  # Disambigua con --from se lo stesso nome esiste in più categorie
  SUPABASE_PASSWORD=*** node upload-card.js move-card \\
    --name "Albero" --from "Natura" --to "Alfabeto"

  # Sposta tutte le card di una categoria in un'altra
  SUPABASE_PASSWORD=*** node upload-card.js move-card \\
    --all --from "Animali" --to "Dinosauri"

  # Mostra cosa verrebbe spostato senza modificare nulla
  SUPABASE_PASSWORD=*** node upload-card.js move-card \\
    --names "Leone,Tigre" --to "Animali" --dry-run

5. Comando: delete-card (Eliminazione card da DB e Storage)
  # Elimina una card per ID (rimuove il record da DB e i file da card-images/card-sounds)
  SUPABASE_PASSWORD=*** node upload-card.js delete-card --id <uuid_card>

  # Simula l'eliminazione per nome senza cancellare nulla (--dry-run)
  SUPABASE_PASSWORD=*** node upload-card.js delete-card --name "Leone" --dry-run

  # Elimina una card per nome, filtrando per categoria
  SUPABASE_PASSWORD=*** node upload-card.js delete-card --name "Leone" --category "Animali"

  # Elimina tutte le card corrispondenti a quel nome
  SUPABASE_PASSWORD=*** node upload-card.js delete-card --name "Gatto" --all

6. Comando: upload (Creazione e caricamento card)
  # A) Da PROMPT con Google AI (Voce TTS casuale + Immagine Nano Banana):
  GEMINI_API_KEY=*** GOOGLE_TTS_API_KEY=*** node upload-card.js upload \\
    --prompt "Leone" \\
    --additional-info "un maestoso leone che ruggisce nella savana al tramonto" \\
    --category <uuid_categoria>

  # B) Da PROMPT in modalità MUSICA con Google Lyria 3.5:
  GEMINI_API_KEY=*** node upload-card.js upload \\
    --prompt "Chitarra" \\
    --additional-info "una chitarra acustica di legno con note musicali colorate" \\
    --audio-mode music \\
    --seconds 20 \\
    --category <uuid_categoria>

  # C) Da PROMPT in modalità EFFETTI con ElevenLabs Sound Effects:
  GEMINI_API_KEY=*** ELEVENLABS_API_KEY=*** node upload-card.js upload \\
    --prompt "Un tuono lontano durante un temporale" \\
    --additional-info "pioggia intensa, atmosfera cinematografica" \\
    --audio-mode effects \\
    --seconds 8 \\
    --category <uuid_categoria>

  # D) Da PROMPT in LOCALE (salva gli asset in public/):
  GEMINI_API_KEY=*** GOOGLE_TTS_API_KEY=*** node upload-card.js upload \\
    --prompt "Un albero fiorito" \\
    --category animals \\
    --mode local

  # E) Da FILE VIDEO (estrae traccia audio WebM + fotogramma centrale):
  SUPABASE_PASSWORD=*** node upload-card.js upload \\
    --input video.mp4 --start 10 --end 25 \\
    --name "Leone" --category <uuid_categoria>

  # F) Da FILE AUDIO e IMMAGINE già pronti:
  SUPABASE_PASSWORD=*** node upload-card.js upload \\
    --input audio.m4a --start 0 --end 15 \\
    --image foto.jpg --name "Leone" --category <uuid_categoria>

7. Comando: video (Video locale da una categoria Supabase)
  # Scarica tutte le card della categoria, genera il TTS del nome e monta
  # per ogni card: immagine fissa + [TTS nome][audio della card].
  # I segmenti vengono uniti in un unico video con cambio immagine a fine audio.
  SUPABASE_PASSWORD=*** GOOGLE_TTS_API_KEY=*** node upload-card.js video \\
    --category "Animali" --out ./videos

  # Un video separato per ogni card (invece di un unico montaggio)
  SUPABASE_PASSWORD=*** GOOGLE_TTS_API_KEY=*** node upload-card.js video \\
    --category "Animali" --per-card --out ./videos

  # Ordine audio inverso (prima il suono della card, poi il nome) e pausa di 0.4s
  SUPABASE_PASSWORD=*** GOOGLE_TTS_API_KEY=*** node upload-card.js video \\
    --category <uuid_categoria> --audio-order sound-first --gap 0.4

  # Formato verticale, voce fissa e nome file personalizzato
  SUPABASE_PASSWORD=*** GOOGLE_TTS_API_KEY=*** node upload-card.js video \\
    --category "Animali" --size 1080x1920 --voice it-IT-Neural2-A --name animali

8. Comando: help (Aiuto)
  node upload-card.js help

────────────────────────────────────────────────────────────────────────────────
PARAMETRI D'AMBIENTE E FLAG GLOBALI
────────────────────────────────────────────────────────────────────────────────
Variabili d'ambiente:
  SUPABASE_PASSWORD   Password dell'account Supabase (richiesta per comandi remoti)
  SUPABASE_EMAIL      Email dell'account Supabase
  GEMINI_API_KEY      API key AI Studio per immagini Nano Banana e musica Lyria
  GOOGLE_TTS_API_KEY  API key per Google Text-to-Speech
  ELEVENLABS_API_KEY  API Key ElevenLabs per --audio-mode effects
  ELEVENLABS_TOKEN    Alias supportato per ELEVENLABS_API_KEY
  CAT                 Categoria corrente, impostata da create-category

Flag upload da Prompt:
  --prompt <testo>          Titolo/messaggio principale della card (es. "Gatto")
  --additional-info <info>  Dettagli aggiuntivi per guidare l'AI (es. "gatto rosso sul divano")
  --audio-mode <tipo>       voice (Google TTS), music (Google Lyria 3.5) o effects (ElevenLabs) [default: voice]
  --music-model lyria-3.5   Unico modello disponibile per la musica [default: lyria-3.5]
  --seconds <n>             Durata audio; music: taglio opzionale, effects: parametro API 0.5-30s
  --elevenlabs-key <key>    Chiave ElevenLabs (o ELEVENLABS_API_KEY / ELEVENLABS_TOKEN)
  --name <nome>             Nome della card (default: testo del prompt)
  --category <uuid|nome>    UUID (per remoto) o cartella public/ (per locale) [default: CAT]
  --mode remote|local       remote (upload Supabase) o local (salva in public/)

Log diagnostici:
  Richieste HTTP, parametri Google/ElevenLabs/Supabase e comandi ffmpeg sono stampati su stderr.
  Chiavi API, token e password vengono redatti automaticamente.

Flag move-card:
  --to <uuid|nome>          Categoria di destinazione (obbligatorio)
  --from <uuid|nome>        Categoria di partenza (consigliato, obbligatorio con --all)
  --id <uuid>               Sposta una card per ID
  --ids <uuid1,uuid2,...>   Sposta più card per ID (separati da virgola)
  --name "Nome"             Sposta una card per nome
  --names "A,B,C"           Sposta più card per nome (separati da virgola)
  --all                     Sposta tutte le card di --from
  --dry-run                 Mostra cosa verrebbe spostato senza modificare nulla
  --json                    Stampa l'esito (o il piano) in JSON

Flag delete-card:
  --id <uuid>               ID della card da cancellare
  --name "Nome"             Nome della card da cancellare
  --category <uuid|nome>    Filtra per categoria se ci sono più card con lo stesso nome
  --all                     Cancella tutte le card trovate con quel nome
  --dry-run                 Mostra cosa verrebbe cancellato senza eseguire

Flag video:
  --category <uuid|nome>    Categoria Supabase da trasformare in video (obbligatorio)
  --out <dir>               Cartella di destinazione [default: ./videos]
  --name <nome>             Nome del file video, senza estensione [default: nome categoria]
  --per-card                Crea un video separato per ogni card
  --size <WxH>              Risoluzione del video [default: 1080x1080]
  --fps <n>                 Frame rate del video [default: 30]
  --order created|name      Ordine delle card [default: created]
  --audio-order name-first|sound-first
                            Ordine audio: prima il TTS del nome o prima il suono
                            della card [default: name-first]
  --gap <secondi>           Pausa di silenzio dopo ogni audio [default: 0]
  --voice <nome|FEMALE|MALE>
                            Voce TTS fissa (una sola voce per tutto il video)
  --lang <codice>           Lingua TTS [default: it-IT]
  --limit <n>               Limita il video alle prime n card
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
    "move-card": "move-card",
    move: "move-card",
    mv: "move-card",
    "add-category": "create-category",
    "make-video": "video",
    "category-video": "video",
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

  logParams("⚙️ Comando CLI:", { command, flags });

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
    case "move-card":
      await runMoveCard(flags);
      break;
    case "delete-card":
      await runDeleteCard(flags);
      break;
    case "create-category":
      await runCreateCategory(flags);
      break;
    case "video":
      await runVideo(flags);
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
