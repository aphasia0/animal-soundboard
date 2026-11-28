# Worker container per Raspberry Pi 3

Piccolo servizio HTTP che esegue `scripts/upload-card.js` in un container.
Serve a far chiamare la generazione/upload delle card da n8n senza dare all'agente
accesso a una shell.

## Cosa fa

- `POST /upload` accetta un prompt, genera immagine e audio con le API già usate
  dal CLI, converte con ffmpeg e carica su Supabase.
- I job vengono eseguiti **in serie** (`MAX_QUEUE`, default 2) per non saturare
  il 1 GB di RAM del Pi 3.
- `requestId` rende le chiamate ripetibili: un secondo invio dello stesso job
  restituisce il risultato in cache invece di creare un'altra card.
- `GET /health` mostra stato, versione di ffmpeg e presenza delle variabili
  d'ambiente, senza esporre i valori. Il TTS HTTP non richiede chiavi.

L'idempotenza copre i retry dello stesso `requestId`, ma il CLI non è
transazionale: se il job muore dopo l'inserimento nel DB ma prima della
risposta, un `retry: true` può creare una seconda card. In quel caso controlla
ed eventualmente elimina la card prima di riprovare.

## Limiti importanti

- È esposto solo il comando `upload` da prompt. Il comando `video` non è
  disponibile: la codifica H.264 di un video è troppo pesante per un Pi 3.
- `upload --mode remote` scrive nella tabella **`user_cards`** e usa i path
  `<user_id>/...` nel bucket. **Non crea contenuti pubblici** in
  `soundpad_public_cards` / `public/<card_uuid>/...`: per quello serve una
  variante con `service_role`, che non è inclusa qui.
- Il CLI fa login con `SUPABASE_EMAIL` + `SUPABASE_PASSWORD`, non con
  `service_role`.

## Avvio rapido

```bash
cp worker/.env.example worker/.env
chmod 600 worker/.env
# modifica worker/.env con token, Supabase e chiavi AI

cd worker
docker compose up -d --build
```

Verifica:

```bash
curl http://localhost:8787/health
```

## Build per Raspberry Pi 3

Controlla l'architettura del sistema sul Pi:

```bash
uname -m
```

- `armv7l` → `linux/arm/v7`
- `aarch64` → `linux/arm64`

### Build consigliata da un computer x86

```bash
docker buildx build --platform linux/arm/v7 \
  -t soundpad-worker:armv7 -f worker/Dockerfile .
```

Per un sistema a 64 bit:

```bash
docker buildx build --platform linux/arm64 \
  -t soundpad-worker:arm64 -f worker/Dockerfile .
```

Trasferimento sul Pi senza registry:

```bash
docker save soundpad-worker:armv7 | gzip | \
  ssh pi@raspberrypi 'gunzip | docker load'
```

Poi, sul Pi:

```bash
cd worker
WORKER_IMAGE=soundpad-worker:armv7 docker compose up -d
```

In alternativa puoi compilare direttamente sul Pi con
`cd worker && docker compose up -d --build`, ma su un Pi 3 è lento e può
richiedere swap.

## API

### `POST /upload`

```bash
curl -X POST http://pi:8787/upload \
  -H "Authorization: Bearer $WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Un leone ruggente nella savana",
    "name": "Leone",
    "category": "00000000-0000-0000-0000-000000000000",
    "audioMode": "voice",
    "seconds": 5,
    "requestId": "test-1"
  }'
```

Header:

```http
Authorization: Bearer <WORKER_TOKEN>
Content-Type: application/json
```

Body:

```json
{
  "prompt": "Un leone ruggente nella savana",
  "name": "Leone",
  "category": "Animali",
  "audioMode": "voice",
  "seconds": 5,
  "additionalInfo": "stile illustrazione per bambini",
  "requestId": "n8n-execution-123"
}
```

Campi:

| Campo | Obbligatorio | Note |
|---|---|---|
| `prompt` | sì | Descrizione visiva per l'immagine; in `voice` è anche il testo pronunciato, ma solo se `name` non è indicato; in `effects` guida solo l'effetto |
| `category` | sì | UUID o nome della categoria in modalità `remote`; nome cartella in `local` |
| `name` | no | Etichetta della card e testo pronunciato in `voice` e `effects`; default: primi 35 caratteri del prompt |
| `mode` | no | `remote` (default) o `local` |
| `audioMode` | no | `voice` (default), `music`, `effects`; in `effects` il nome è letto dal TTS HTTP e ElevenLabs genera solo l'effetto |
| `seconds` | no | Solo `music` (1-600) ed `effects` (0,5-30, applicato al solo effetto); in `voice` la durata dipende dal testo e il campo viene ignorato |
| `additionalInfo` | no | Dettagli extra **solo visivi**: viene accodato al prompt per l'immagine (e per musica/effetti), mai pronunciato |
| `requestId` | no | Chiave di idempotenza; default UUID generato |
| `retry` | no | `true` per rieseguire un job fallito con lo stesso `requestId` |

Risposta riuscita:

```json
{
  "ok": true,
  "cached": false,
  "requestId": "n8n-execution-123",
  "cardId": "11111111-1111-4111-8111-111111111111",
  "exitCode": 0,
  "timedOut": false,
  "durationMs": 42000,
  "stdout": "...",
  "stderr": "..."
}
```

Se il CLI fallisce la risposta è `502` con `ok: false` e gli ultimi log in
`stdout`/`stderr`.

Per ottenere gli UUID delle categorie puoi usare il CLI dentro il container:

```bash
docker compose exec worker node scripts/upload-card.js categories --json
```

Altri stati:

- `401`: token mancante o errato.
- `409`: stesso `requestId` già in esecuzione.
- `429`: coda piena; riprova più tardi.
- `502`: job fallito o già fallito in cache.

### `GET /health`

Non richiede token e non espone segreti. Risponde `503` se ffmpeg non è
disponibile.

## Uso da n8n

Nel nodo **HTTP Request**:

- Method: `POST`
- URL: `http://<ip-del-pi>:8787/upload`
- Authentication: Header Auth / Generic Credential
  - Name: `Authorization`
  - Value: `Bearer <WORKER_TOKEN>`
- Send Body: JSON
- Body:

```json
{
  "prompt": "{{ $json.prompt }}",
  "name": "{{ $json.name }}",
  "category": "{{ $json.category_id }}",
  "audioMode": "voice",
  "requestId": "{{ $execution.id }}"
}
```

- Timeout: almeno `600000` ms (10 minuti), coerente con `JOB_TIMEOUT_MS`.

Per l'agente: dagli un tool HTTP con schema JSON, **non** un tool che esegue
comandi shell. Il worker valida i campi e non accetta comandi arbitrari.

### Workflow MCP pronti

Due JSON importabili in n8n (**Workflows → Import from File**):

| File | Ruolo |
| --- | --- |
| `worker/n8n-worker-upload.json` | validazione deterministica dei parametri + chiamata `POST /upload` |
| `worker/n8n-mcp-workflow.json` | MCP Server Trigger con i tool `crea_card` e `worker_health` |

`crea_card` è un **Call n8n Workflow Tool** che punta al primo workflow: il
server MCP resta sottile, mentre normalizzazione, default e messaggi di errore
vivono in un solo punto. Contratto dei campi:

| Campo | Ruolo |
| --- | --- |
| `name` | etichetta della card **e** parola pronunciata in `voice` e `effects` |
| `prompt` | descrizione visiva per l'immagine; se manca si usa `name` |
| `category` | nome o UUID della categoria |
| `audioMode` | `voice` / `music` / `effects` |
| `seconds` | durata audio |

Regole applicate prima di toccare il worker:

- `name` obbligatorio, max 200 caratteri
- `category` obbligatorio (nome o UUID), max 200 caratteri
- `prompt` facoltativo, max 2000 caratteri; default `name`
- `audioMode` in `voice` / `music` / `effects` (default `voice`, case-insensitive)
- `seconds` solo per `music` (1-600) ed `effects` (0,5-30, applicato al solo
  effetto); in `voice` viene scartato, perché la durata dipende dal testo
- `additionalInfo` non è esposto dal tool MCP, per non confondere il modello;
  il worker e il CLI continuano ad accettarlo come dettaglio visivo
- `requestId` facoltativo, `[A-Za-z0-9._-]{1,100}`

Un input non valido non fa fallire l'esecuzione: il workflow risponde
`{ ok: false, error, dettagli }`, così il client MCP riceve un messaggio
utilizzabile invece di un errore di nodo. Anche un worker irraggiungibile
(`onError: continueRegularOutput`) torna come `{ ok: false, error }`.

Dopo l'import del workflow MCP va selezionato il sottoworkflow nel nodo
`crea_card` (campo **Workflow**): il JSON contiene il segnaposto
`SOSTITUISCI_CON_ID_DEL_WORKFLOW_UPLOAD`, perché gli ID cambiano a ogni
istanza. I due file contengono `WORKER_TOKEN` in chiaro e sono in `.gitignore`.

In un **Call n8n Workflow Tool** ogni `$fromAI('campo', 'descrizione', 'tipo')`
senza quarto argomento diventa **obbligatorio** nello schema del tool: se il
modello omette il campo la chiamata fallisce con `did not match schema` prima
di arrivare al sottoworkflow. Per i campi facoltativi serve sempre un default,
anche vuoto: `$fromAI('name', '...', 'string', '')`.

## Variabili principali

| Variabile | Default | Note |
|---|---|---|
| `WORKER_TOKEN` | — | Obbligatorio |
| `SUPABASE_URL` | — | Obbligatorio per upload remoti |
| `SUPABASE_ANON_KEY` | — | Obbligatorio per upload remoti |
| `SUPABASE_EMAIL` | — | Login utente del CLI |
| `SUPABASE_PASSWORD` | — | Password del CLI |
| `GEMINI_API_KEY` | — | Immagini Nano Banana e musica Lyria |
| `TTS_URL` | `https://tts.antoniogiordano.dev` | Base dell'API TTS HTTP (speed fisso 3) |
| `ELEVENLABS_API_KEY` | — | Audio `effects` |
| `PORT` | `8787` | Porta interna |
| `MAX_QUEUE` | `2` | Job in coda + in esecuzione |
| `JOB_TIMEOUT_MS` | `600000` | Timeout per job |
| `MAX_LOG_CHARS` | `20000` | Log restituiti a n8n |
| `DATA_DIR` | `/data` | Stato dei job |

## Sicurezza

- Tieni `worker/.env` fuori da Git; il file è già in `.gitignore`.
- Non esporre la porta `8787` su Internet senza HTTPS/reverse proxy e firewall.
- Se metti un reverse proxy davanti al worker, aumenta i timeout (almeno 10 minuti)
  per non interrompere i job di generazione.
- Non mettere `SUPABASE_SERVICE_ROLE_KEY` nel worker attuale: il CLI non lo usa.
- Il worker può generare costi su Gemini/TTS/ElevenLabs: protegge il token e
  limita la coda.

## Problemi comuni

- **`exec format error`**: immagine compilata per l'architettura sbagliata.
  Controlla `uname -m` e rifai la build con `--platform` corretto.
- **`401`**: header `Authorization` assente o token diverso da `WORKER_TOKEN`.
- **`429`**: ci sono già `MAX_QUEUE` job; attendi o aumenta il valore (con
  cautela sul Pi 3).
- **`409`**: lo stesso `requestId` è ancora in esecuzione.
- **`502`**: guarda `stderr` nella risposta; spesso manca una API key o le
  credenziali Supabase.
- **`ffmpeg non trovato`**: l'immagine non è stata costruita dal Dockerfile
  corretto.
- **Build lentissima o OOM sul Pi**: compila da un computer x86 e trasferisci
  l'immagine con `docker save`/`docker load`.
