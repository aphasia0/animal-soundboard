#!/usr/bin/env node
/**
 * Worker HTTP per scripts/upload-card.js.
 *
 * Pensato per girare in un container su Raspberry Pi 3 e essere chiamato da
 * n8n. Non esegue comandi arbitrari: accetta solo i campi previsti e li passa
 * al CLI con spawn + array di argomenti (niente shell).
 *
 * Endpoint:
 *   GET  /health   stato del worker (pubblico, senza segreti)
 *   POST /upload   crea una card via prompt AI
 *
 * In modalità remote `category` accetta l'UUID oppure il nome della categoria:
 * il CLI risolve il nome sull'account connesso.
 *
 * Variabili d'ambiente principali:
 *   WORKER_TOKEN       obbligatorio, Bearer token per /upload
 *   SUPABASE_*         usate da upload-card.js per il login e l'upload
 *   GEMINI_API_KEY     immagini (Nano Banana) e musica (Lyria)
 *   GOOGLE_TTS_API_KEY voce Google TTS
 *   ELEVENLABS_API_KEY effetti audio
 *   DATA_DIR           dove salvare lo stato dei job (default: /data)
 *   APP_DIR            radice del progetto nel container (default: /app)
 *   MAX_QUEUE          job in coda + in esecuzione (default: 2)
 *   JOB_TIMEOUT_MS     timeout per singolo job (default: 10 minuti)
 */

import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = process.env.APP_DIR || ROOT;
const SCRIPT = process.env.UPLOAD_SCRIPT || join(APP_DIR, "scripts", "upload-card.js");
const DATA_DIR = process.env.DATA_DIR || join(APP_DIR, ".worker-data");
const JOBS_DIR = join(DATA_DIR, "jobs");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.WORKER_TOKEN || "";
const CHILD_ENV = { ...process.env };
delete CHILD_ENV.WORKER_TOKEN;
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS || 10 * 60 * 1000);
const MAX_QUEUE = Number(process.env.MAX_QUEUE || 2);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 256 * 1024);
const MAX_LOG_CHARS = Number(process.env.MAX_LOG_CHARS || 20_000);

const UUID_IN_TEXT_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const JOB_ID_RE = /^[A-Za-z0-9._-]{1,100}$/;
const LOCAL_CATEGORY_RE = /^[A-Za-z0-9._-]{1,64}$/;

if (!TOKEN) {
  console.error("[worker] WORKER_TOKEN mancante: il worker non può partire.");
  process.exit(1);
}

class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const jobs = new Map();
let queueDepth = 0;
let queueTail = Promise.resolve();

function send(res, status, body, extraHeaders = {}) {
  if (res.writableEnded) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function isAuthorized(req) {
  const header = req.headers.authorization || "";
  const expected = `Bearer ${TOKEN}`;
  const actualBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, `Body troppo grande (massimo ${MAX_BODY_BYTES} byte).`);
    }
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Body JSON non valido.");
  }
}

function readString(value, field, { required = false, max = 200 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `Campo obbligatorio: ${field}.`);
    return null;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `Il campo ${field} deve essere una stringa.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) throw new HttpError(400, `Campo obbligatorio: ${field}.`);
    return null;
  }
  if (trimmed.length > max) {
    throw new HttpError(400, `Il campo ${field} supera ${max} caratteri.`);
  }
  return trimmed;
}

function parseInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Il body deve essere un oggetto JSON.");
  }

  const prompt = readString(body.prompt, "prompt", { required: true, max: 2000 });
  const category = readString(body.category, "category", { required: true, max: 200 });
  const name = readString(body.name, "name", { max: 200 }) || prompt.slice(0, 35).trim();
  const additionalInfo = readString(
    body.additionalInfo ?? body.additional_info,
    "additionalInfo",
    { max: 1000 },
  );

  const mode = (readString(body.mode, "mode", { max: 10 }) || "remote").toLowerCase();
  if (!["remote", "local"].includes(mode)) {
    throw new HttpError(400, 'mode deve essere "remote" o "local".');
  }
  if (mode === "local" && !LOCAL_CATEGORY_RE.test(category)) {
    throw new HttpError(
      400,
      "In modalità local category deve essere un nome cartella sicuro (lettere, numeri, . _ -).",
    );
  }

  const audioMode = (
    readString(body.audioMode ?? body.audio_mode, "audioMode", { max: 20 }) || "voice"
  ).toLowerCase();
  if (!["voice", "music", "effects"].includes(audioMode)) {
    throw new HttpError(400, 'audioMode deve essere "voice", "music" o "effects".');
  }

  let seconds = null;
  const rawSeconds = body.seconds;
  if (rawSeconds !== undefined && rawSeconds !== null && rawSeconds !== "") {
    seconds = Number(rawSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600) {
      throw new HttpError(400, "seconds deve essere un numero tra 0 e 600.");
    }
  }

  const rawRequestId = body.requestId ?? body.request_id;
  const requestId =
    rawRequestId === undefined || rawRequestId === null || rawRequestId === ""
      ? randomUUID()
      : String(rawRequestId).trim();
  if (!JOB_ID_RE.test(requestId)) {
    throw new HttpError(
      400,
      "requestId può contenere solo lettere, numeri, punto, underscore e trattino (max 100).",
    );
  }

  return {
    prompt,
    name,
    category,
    additionalInfo,
    mode,
    audioMode,
    seconds,
    requestId,
    retry: body.retry === true,
  };
}

function buildArgs(input) {
  // Forma --flag=valore: evita che un prompt che inizia con "--" venga
  // interpretato come un flag dal parser del CLI.
  const args = [
    "upload",
    `--prompt=${input.prompt}`,
    `--name=${input.name}`,
    `--category=${input.category}`,
    `--mode=${input.mode}`,
    `--audio-mode=${input.audioMode}`,
  ];
  if (input.additionalInfo) args.push(`--additional-info=${input.additionalInfo}`);
  if (input.seconds !== null) args.push(`--seconds=${String(input.seconds)}`);
  return args;
}

function appendLog(current, chunk) {
  const next = current + chunk.toString("utf8");
  return next.length > MAX_LOG_CHARS ? next.slice(-MAX_LOG_CHARS) : next;
}

function extractCardId(stdout) {
  const marker = stdout.lastIndexOf("Card creata con successo");
  if (marker < 0) return null;
  const match = UUID_IN_TEXT_RE.exec(stdout.slice(marker));
  return match ? match[0] : null;
}

function runCli(args) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let jobTimer = null;
    let killTimer = null;

    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: APP_DIR,
      env: CHILD_ENV,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (jobTimer) clearTimeout(jobTimer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ ...result, durationMs: Date.now() - startedAt });
    };

    child.stdout.on("data", (chunk) => {
      stdout = appendLog(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendLog(stderr, chunk);
    });
    child.on("error", (error) => {
      finish({
        ok: false,
        exitCode: null,
        signal: null,
        timedOut: false,
        cardId: null,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
      });
    });
    child.on("close", (code, signal) => {
      finish({
        ok: !timedOut && code === 0,
        exitCode: code,
        signal,
        timedOut,
        cardId: extractCardId(stdout),
        stdout,
        stderr,
      });
    });

    jobTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
    }, JOB_TIMEOUT_MS);
    jobTimer.unref?.();
  });
}

function enqueue(task) {
  queueDepth += 1;
  const run = queueTail.then(task, task);
  queueTail = run.catch(() => {});
  return run.finally(() => {
    queueDepth -= 1;
  });
}

async function persistJob(job) {
  const file = join(JOBS_DIR, `${job.requestId}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(job), { mode: 0o600 });
  await rename(tmp, file);
}

async function loadJobs() {
  let files = [];
  try {
    files = await readdir(JOBS_DIR);
  } catch {
    return;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const job = JSON.parse(await readFile(join(JOBS_DIR, file), "utf8"));
      if (!job?.requestId) continue;
      if (job.status === "running") {
        job.status = "failed";
        job.finishedAt = new Date().toISOString();
        job.error = "Worker riavviato mentre il job era in esecuzione.";
      }
      jobs.set(job.requestId, job);
    } catch {
      // File corrotto: lo ignoriamo e lasciamo ripartire il job.
    }
  }
}

function checkFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.error || result.status !== 0) return null;
  return (result.stdout || "").split("\n")[0].trim() || "ffmpeg";
}

function healthPayload() {
  const ffmpeg = checkFfmpeg();
  return {
    ok: Boolean(ffmpeg),
    node: process.version,
    ffmpeg,
    uptimeSeconds: Math.round(process.uptime()),
    queue: { depth: queueDepth, max: MAX_QUEUE },
    jobs: jobs.size,
    env: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
      supabaseEmail: Boolean(process.env.SUPABASE_EMAIL),
      supabasePassword: Boolean(process.env.SUPABASE_PASSWORD),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      googleTts: Boolean(process.env.GOOGLE_TTS_API_KEY),
      elevenLabs: Boolean(
        process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_TOKEN,
      ),
    },
  };
}

async function handleUpload(req, res) {
  if (!isAuthorized(req)) {
    throw new HttpError(401, "Token mancante o non valido.");
  }

  const body = await readJson(req);
  const input = parseInput(body);
  const existing = jobs.get(input.requestId);

  if (existing?.status === "succeeded") {
    return send(res, 200, {
      ok: true,
      cached: true,
      requestId: input.requestId,
      ...existing.result,
    });
  }
  if (existing?.status === "running") {
    throw new HttpError(409, "Job già in esecuzione con questo requestId.", {
      requestId: input.requestId,
    });
  }
  if (existing?.status === "failed" && !input.retry) {
    return send(res, 502, {
      ok: false,
      cached: true,
      requestId: input.requestId,
      error: existing.error || "Job fallito.",
      ...existing.result,
    });
  }

  if (queueDepth >= MAX_QUEUE) {
    throw new HttpError(429, `Coda piena (${MAX_QUEUE} job). Riprova più tardi.`);
  }

  const job = {
    requestId: input.requestId,
    status: "running",
    startedAt: new Date().toISOString(),
    input: {
      prompt: input.prompt,
      name: input.name,
      category: input.category,
      mode: input.mode,
      audioMode: input.audioMode,
      seconds: input.seconds,
      additionalInfo: input.additionalInfo,
    },
  };
  jobs.set(input.requestId, job);

  try {
    await persistJob(job);
  } catch (error) {
    jobs.delete(input.requestId);
    throw new HttpError(500, `Impossibile salvare lo stato del job: ${error.message}`);
  }

  const result = await enqueue(async () => {
    const run = await runCli(buildArgs(input));
    job.status = run.ok ? "succeeded" : "failed";
    job.finishedAt = new Date().toISOString();
    job.result = run;
    if (!run.ok) {
      job.error = run.timedOut
        ? `Timeout dopo ${Math.round(JOB_TIMEOUT_MS / 1000)}s.`
        : `upload-card.js è uscito con codice ${run.exitCode ?? "sconosciuto"}.`;
    }
    try {
      await persistJob(job);
    } catch (error) {
      console.error(`[worker] impossibile salvare il job ${job.requestId}: ${error.message}`);
    }
    return run;
  });

  const status = result.ok ? 200 : 502;
  return send(res, status, {
    ok: result.ok,
    cached: false,
    requestId: input.requestId,
    ...result,
    ...(result.ok ? {} : { error: job.error }),
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      const health = healthPayload();
      return send(res, health.ok ? 200 : 503, health);
    }

    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, {
        ok: true,
        service: "soundpad-upload-worker",
        endpoints: ["GET /health", "POST /upload"],
      });
    }

    if (req.method === "POST" && url.pathname === "/upload") {
      return await handleUpload(req, res);
    }

    throw new HttpError(404, "Endpoint non trovato.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    if (!(error instanceof HttpError)) {
      console.error(error);
    }
    console.error(
      `[worker] ${status} ${req.method} ${url.pathname}: ${message}`,
    );
    send(res, status, {
      ok: false,
      error: message,
      ...(error?.details ? { details: error.details } : {}),
    });
  }
});

await mkdir(JOBS_DIR, { recursive: true });
await loadJobs();

if (!checkFfmpeg()) {
  console.warn("[worker] ffmpeg non trovato: /health sarà 503 e gli upload falliranno.");
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_EMAIL || !process.env.SUPABASE_PASSWORD) {
  console.warn(
    "[worker] SUPABASE_URL / SUPABASE_EMAIL / SUPABASE_PASSWORD non tutte impostate: gli upload remoti falliranno.",
  );
}

server.listen(PORT, HOST, () => {
  console.log(`[worker] in ascolto su http://${HOST}:${PORT}`);
  console.log(`[worker] script: ${SCRIPT}`);
  console.log(`[worker] data: ${DATA_DIR}`);
});

function shutdown(signal) {
  console.log(`[worker] ${signal}: chiusura...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
