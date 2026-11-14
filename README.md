# Sound Pad 🦁

**Sound Pad** è un'applicazione avanzata di **Comunicazione Aumentativa e Alternativa (CAA)** progettata per bambini con disabilità, tra cui **autismo, paralisi cerebrale e ritardi nel linguaggio**. L'interfaccia intuitiva permette di toccare grandi schede per ascoltare suoni, vedere immagini e ascoltare la sintesi vocale, permettendo la comunicazione a chi non può parlare.

**Sound Pad** is an advanced **AAC (Augmentative and Alternative Communication)** web application designed for children with disabilities like autism, cerebral palsy, and speech delays. Features a single-button interface for communicating through sounds, images, and text-to-speech.

## ✨ Features

### 📂 Categories

| Category | Items | Description |
|----------|-------|-------------|
| **Animals** 🦁 | 50 | Leone, Elefante, Cane, Gatto, Mucca, Cavallo, and more |
| **Jobs** 👷 | 10 | Doctor, Teacher, Firefighter, Police, Chef, Farmer, Builder, Pilot, Artist, Mechanic |
| **People** 👨‍👩‍👧 | 5 | Papà, Mamma, Nonna, Nonno, Michele |
| **Vehicles** 🚗 | 30 | Automobile, Motorcycle, Bicycle, Bus, Train, Plane, Helicopter, Boat, and more |
| **Games** 🎲 | 6 | Ruota, Trottola, Tamburello, Macchina, Pianoforte, Uccellino |
| **Music** 🎵 | 10 | Children's songs: Twinkle Twinkle, Happy Birthday, Wheels on the Bus, and more |
| **Sentences** 💬 | 8 | Common phrases: "Ho fame", "Ho sete", "Andiamo a casa", and more |

### 🎮 Interaction Modes

| Mode | Description |
|------|-------------|
| **Scheda Singola** | One large card displayed at a time |
| **Scheda Doppia** | Two cards side-by-side for comparison/choice |
| **Cantastorie** | Interactive storytelling with chapters |

### 🔀 Navigation Modes

- **Shuffle** - Random card selection
- **Lineare** - Sequential progression through cards
- **Bloccato** - Stay on current card without advancing

### ▶️ Playback Modes

| Mode | Behavior |
|------|----------|
| **Singolo Click** | Plays sound once, then auto-advances |
| **Ricomincia** | Each press restarts from beginning |
| **Riprendi** | Pause/resume from where it stopped |
| **Autoplay** | Continuous playback with auto-advancement |

### ⏱️ Time Settings

Configurable max time: **3s, 5s, 10s, 30s**, or auto (sound duration)

### 🎨 Visual Customization

- Primary and secondary **color picker** for card themes
- **Responsive design** for mobile/tablet/desktop
- High-contrast, child-friendly UI
- Large touch targets (accessibility-first)

### 📚 Interactive Stories (Cantastorie)

4 built-in Italian stories with narration:

1. **Cappuccetto Rosso** - Little Red Riding Hood (11 chapters)
2. **Pinocchio** - (10 chapters)
3. **I Tre Porcellini** - Three Little Pigs (9 chapters)
4. **Biancaneve** - Snow White (10 chapters)

### 👤 User Accounts

- **Create custom categories** with emoji icons
- **Add custom cards** with image upload and sound recording
- All stored in **Supabase database**
- Settings sync between local storage and cloud

### 🇮🇹 Key Features

- **Italian Localization**: All 50+ animal names with proper TTS pronunciation (Alice voice)
- **Text-to-Speech Audio**: Italian voice pronouncing each item name
- **Single-Button Interface**: Large, accessible button occupying 90% of screen
- **Cumulative Progress Bar**: Tracks press duration across multiple interactions
- **Automatic Transitions**: Random or sequential card changes

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm
- (Optional) Supabase account for cloud features

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/soundpad.git
cd soundpad

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Environment Variables (Optional)

For cloud features, create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🎮 How to Use

### Basic Mode

1. **Select a category** from the home screen
2. **Press and hold** the large card button to hear the sound
3. The **progress bar** fills as you hold the button
4. After the configured time, a new card appears

### Stories Mode

1. Select **"Cantastorie"** from the menu
2. Choose a story (Cappuccetto Rosso, Pinocchio, etc.)
3. Press the card to advance through chapters
4. Listen to the narration and see the illustrations

### Custom Cards

1. **Sign in** or create an account
2. Click **"Aggiungi Categoria"** to create a new category
3. Click **"Aggiungi Scheda"** to add cards with:
   - Image upload (auto-compressed)
   - Sound recording via microphone
4. Your custom content syncs to the cloud

## 🏗️ Project Structure

```
soundpad/
├── public/
│   ├── animals/          # 50 SVG animal images
│   ├── vehicles/         # 30 SVG vehicle images
│   ├── jobs/             # 10 SVG job images
│   ├── games/            # Game images
│   ├── people/           # People images
│   ├── sentences/        # Sentence images (SVG)
│   ├── music/            # Music images (SVG)
│   ├── sounds/           # WAV audio files
│   ├── assets/stories/   # Story images and audio
│   ├── build/            # Compiled JS/CSS
│   ├── global.css        # Global styles
│   └── index.html        # Entry point
├── src/
│   ├── App.svelte         # Main app component
│   ├── Home.svelte        # Category selection view
│   ├── ModeSelect.svelte  # Game mode selection
│   ├── CategoryView.svelte # Card display/interaction
│   ├── StoryView.svelte   # Interactive story player
│   ├── StorySelect.svelte # Story selection
│   ├── CardSelector.svelte # Cross-category card picker
│   ├── AuthModal.svelte   # Login/register modal
│   ├── AddCategoryModal.svelte # Category creation
│   ├── AddCardModal.svelte # Card creation with recording
│   ├── InfoView.svelte    # About/version info
│   ├── animals.js         # Animal data
│   ├── vehicles.js        # Vehicle data
│   ├── jobs.js            # Job data
│   ├── games.js           # Game data
│   ├── music.js           # Music data
│   ├── people.js          # People data
│   ├── sentences.js       # Sentence data
│   ├── stories.js         # Story content
│   ├── i18n.js            # Italian translations
│   ├── settingsStore.js   # Settings state management
│   ├── authStore.js       # Authentication state
│   ├── supabaseClient.js  # Supabase client wrapper
│   ├── audioUtils.js      # Web Audio API utilities
│   └── main.js            # Entry point
├── e2e/                   # Test end-to-end Playwright
│   ├── auth.spec.js
│   ├── navigation.spec.js
│   ├── sections.spec.js
│   ├── card-selector.spec.js
│   └── helpers/
│       └── supabase-mock.js
├── scripts/               # Asset generation scripts
│   ├── generate-images.js
│   ├── generate-sounds.js
│   ├── generate-job-images.js
│   ├── generate-music-images.js
│   ├── generate-melodies.js
│   ├── generateStoryAssets.js
│   ├── upload-card.js     # CLI: categorie, card, upload, video
│   └── lib/
│       ├── analyze.js     # Pipeline: audio → OCR → frame → comandi
│       └── ocr.swift      # OCR etichette via macOS Vision
├── supabase-schema.sql    # Database schema
├── rollup.config.js       # Build configuration
└── package.json
```

## 🎨 Assets

### 50 Animals (Italian TTS)

Leone, Elefante, Cane, Gatto, Mucca, Cavallo, Pecora, Maiale, Gallina, Anatra, Oca, Tacchino, Gallo, Rana, Gufo, Corvo, Pappagallo, Pavone, Scimmia, Orso, Lupo, Volpe, Cervo, Capra, Asino, Zebra, Giraffa, Ippopotamo, Rinoceronte, Tigre, Leopardo, Ghepardo, Panda, Koala, Canguro, Pinguino, Foca, Delfino, Balena, Serpente, Coccodrillo, Ape, Grillo, Zanzara, Gabbiano, Aquila, Falco, Coyote, Iena, Gorilla

### 10 Jobs

Dottore, Insegnante, Pompiere, Poliziotto, Cuoco, Contadino, Muratore, Pilota, Artista, Meccanico

### 30 Vehicles

Automobile, Motocicletta, Bicicletta, Autobus, Camion, Trattore, Furgone, Ambulanza, Auto della Polizia, Auto dei Pompieri, Taxi, Monopattino, Skateboard, Barca, Nave, Barca a Vela, Aeroplano, Elicottero, Dirigibile, Treno, Metro, Tram, Trenino, Motorino, Suv, Campagnola, Muletto, Rimorchio, Camion dei Pompieri, Pulmino

## 🔧 Development

### Generate Assets

```bash
# Generate animal images (SVG)
node scripts/generate-images.js

# Generate job images
node scripts/generate-job-images.js

# Generate music images
node scripts/generate-music-images.js

# Generate melodies
node scripts/generate-melodies.js

# Generate story assets
node scripts/generateStoryAssets.js

# Generate Italian TTS audio (requires macOS)
node scripts/generate-sounds.js
```

### CLI contenuti (categorie, card, upload)

`scripts/upload-card.js` è una piccola CLI per gestire le categorie e caricare
nuove card partendo da una clip audio + un'immagine ricavate da un video.
Serve `ffmpeg` nel PATH e le dipendenze in `scripts/`
(`cd scripts && npm install`). Tutti i comandi remoti richiedono
`SUPABASE_PASSWORD` (password dell'account configurato nello script).

```bash
# Mostra id, icona, nome e numero di card delle tue categorie
SUPABASE_PASSWORD=*** node scripts/upload-card.js categories
SUPABASE_PASSWORD=*** node scripts/upload-card.js categories --json

# Crea una categoria: il suo UUID viene salvato come CAT e usato
# automaticamente dai comandi successivi (se --category è omesso)
SUPABASE_PASSWORD=*** node scripts/upload-card.js create-category \
  --name "Animali" --emoji "🐾"

# Per impostare CAT anche nella shell corrente:
eval "$(SUPABASE_PASSWORD=*** node scripts/upload-card.js create-category \
  --name "Animali" --emoji "🐾" --export)"

# Elenca le card (id, nome, categoria); --category filtra una sezione
SUPABASE_PASSWORD=*** node scripts/upload-card.js cards
SUPABASE_PASSWORD=*** node scripts/upload-card.js cards --category "Animali"

# Sposta una card in un'altra sezione (prima con --dry-run)
SUPABASE_PASSWORD=*** node scripts/upload-card.js move-card \
  --name "Albero" --to "Alfabeto" --dry-run
SUPABASE_PASSWORD=*** node scripts/upload-card.js move-card \
  --id <uuid_card> --to <uuid_categoria>

# Analizza un video: trova i suoni, legge le etichette (OCR), estrae le
# immagini e stampa i comandi di upload pronti da eseguire
# CAT è già impostata da create-category; usa --category per sovrascriverla
node scripts/upload-card.js analyze --input video.webm > upload.sh
bash upload.sh
# oppure: npm run --silent analyze -- --input video.webm > upload.sh

# Rilascio locale passando direttamente il video (mp4, webm, mov…):
# senza --image viene estratto il fotogramma centrale, quadrato 1024x1024
node scripts/upload-card.js upload --mode local \
  --input video.mp4 --start 12 --end 27 \
  --name "Nome Card" --category animals

# Rilascio su Supabase (--category = UUID di user_categories)
SUPABASE_PASSWORD=*** node scripts/upload-card.js upload --mode remote \
  --input video.mp4 --start 12 --end 27 \
  --name "Nome Card" --category <uuid_categoria>

# Puoi sempre passare un'immagine già pronta
node scripts/upload-card.js upload --mode local \
  --input video.mp4 --start 12 --end 27 \
  --image frame.jpg --name "Nome Card" --category animals
```

`--input` accetta audio (m4a, mp3, wav…) e video (mp4, webm, mov…): dai video
viene usata solo la traccia audio. `--image` è facoltativo: se manca e `--input`
è un video, lo script estrae con ffmpeg il fotogramma a metà clip
(`start + (end - start) / 2`) e lo ritaglia quadrato 1024×1024 con un crop
centrale, così la card non deve tagliarlo ulteriormente. Con un input audio
`--image` resta obbligatorio; in ogni caso deve essere un'immagine
(jpg, png, webp, gif), non un video.

#### `video`: da categoria Supabase a video locale

Crea un video locale partendo da una categoria esistente: per ogni card scarica
immagine e audio da Supabase, genera con Google TTS la voce del nome e monta un
segmento con l'immagine fissa; quando l'audio finisce l'immagine passa alla card
successiva. Di default i segmenti vengono uniti in un unico MP4.

```bash
export SUPABASE_PASSWORD=***
export GOOGLE_TTS_API_KEY=***

# Un unico video con tutte le card della categoria
node scripts/upload-card.js video --category "Animali" --out ./videos

# Un video separato per ogni card
node scripts/upload-card.js video --category "Animali" --per-card

# Ordine audio inverso (prima il suono, poi il nome) e pausa tra le card
node scripts/upload-card.js video --category "Animali" \
  --audio-order sound-first --gap 0.4 --size 1080x1920
```

Opzioni: `--out <dir>` (default `./videos`), `--name <file>`, `--size WxH`
(default `1080x1080`), `--fps 30`, `--order created|name`, `--audio-order
name-first|sound-first`, `--gap <sec>`, `--voice <nome|FEMALE|MALE>`, `--lang
it-IT`, `--limit <n>`, `--per-card`.

Senza `--voice` viene scelta una voce casuale una sola volta e riusata per tutte
le card, così il video resta coerente. Le card senza immagine o audio vengono
saltate con un avviso.

#### `analyze`: da video a comandi pronti

Il comando `analyze` automatizza l'analisi del video:

1. trova i segmenti audio con `ffmpeg silencedetect`
2. legge le etichette mostrate nel video con OCR (macOS Vision)
3. raggruppa i suoni per etichetta (gestisce clacson e campanelli)
4. estrae e ritaglia un'immagine 1024×1024 per ogni veicolo
5. stampa su **stdout** un comando `upload` per ogni card

I log e la tabella riepilogativa vanno su **stderr**, quindi l'output è
redirigibile e direttamente eseguibile:

```bash
export SUPABASE_PASSWORD=***
# CAT è già impostata da create-category; usa --category per sovrascriverla

node scripts/upload-card.js analyze --input video.webm > upload.sh
cat upload.sh     # controlla i comandi
bash upload.sh
```

Opzioni principali: `--out <dir>` (default `<video>-cards`), `--category <uuid>`,
`--frame-offset <sec>` (default 4), `--lang it|en`, `--no-ocr`, `--json`.

L'OCR è opzionale: richiede macOS con Xcode Command Line Tools. Senza OCR
(`--no-ocr` o sistema non macOS) i suoni vengono comunque rilevati e
raggruppati, ma i nomi diventano `Veicolo 1`, `Veicolo 2`, ecc.

#### `cards` e `move-card`: gestire le card esistenti

`cards` elenca le card con UUID, nome e categoria; serve a trovare l'UUID da
usare con `move-card`.

```bash
SUPABASE_PASSWORD=*** node scripts/upload-card.js cards
SUPABASE_PASSWORD=*** node scripts/upload-card.js cards --category "Veicoli"
SUPABASE_PASSWORD=*** node scripts/upload-card.js cards --json
```

`move-card` cambia la categoria di una o più card: aggiorna solo `category_id`,
audio e immagine restano dove sono (nessun nuovo upload).

```bash
# Per nome: confronto senza maiuscole/accenti
SUPABASE_PASSWORD=*** node scripts/upload-card.js move-card \
  --name "Albero" --to "Alfabeto"

# Più card in una volta (nomi separati da virgola)
SUPABASE_PASSWORD=*** node scripts/upload-card.js move-card \
  --names "Leone,Tigre,Orso" --to "Animali"

# Per UUID, con sezione di partenza e prova a vuoto
SUPABASE_PASSWORD=*** node scripts/upload-card.js move-card \
  --ids <uuid1>,<uuid2> --from "Veicoli" --to <uuid_categoria> --dry-run

# Tutte le card di una categoria verso un'altra
SUPABASE_PASSWORD=*** node scripts/upload-card.js move-card \
  --all --from "Animali" --to "Dinosauri"
```

`--to` e `--from` accettano sia l'UUID sia il nome della categoria. Se lo stesso
nome esiste in più categorie, lo script elenca le corrispondenze e si ferma:
aggiungi `--from` per disambiguare oppure usa `--ids`. `--all` richiede sempre
`--from`. Con `--json` stampa l'esito (o il piano, con `--dry-run`) in JSON.

Per compatibilità, i flag senza il comando valgono come `upload`:

```bash
node scripts/upload-card.js --mode local --input ... --name ... --category ...
```

Aiuto completo: `node scripts/upload-card.js help`. Flag, prerequisiti e
troubleshooting sono documentati nell'intestazione dello script. I path in
`--start/--end` sono relativi al file passato in `--input`.

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `public/` directory.

### Test E2E (Playwright)

Il repo ha test **end-to-end** in `e2e/`; non ci sono test unitari (es. per la
CLI `scripts/upload-card.js`) né test di API.

#### Configurazione

`playwright.config.js`:

- timeout 30s per test, 7s per le `expect`
- due progetti: **desktop** (Desktop Chrome) e **mobile** (emulazione Pixel 7),
  entrambi con `channel: 'chrome'` → serve Chrome installato
- esecuzione sequenziale (`workers: 1`, `fullyParallel: false`)
- su CI: 1 retry e `forbidOnly`
- artefatti solo in caso di fallimento: trace, screenshot e video
- **web server automatico**: esegue `npm run build` e serve `public/` con `sirv`
  sulla porta `4173` (`E2E_PORT` per cambiarla); in locale riusa un server già
  attivo

#### Mock Supabase

`e2e/helpers/supabase-mock.js` intercetta le chiamate con `page.route`:

- `auth/v1/token` → sessione finta con JWT costruito ad hoc
- `auth/v1/logout` → 204
- `rest/v1/user_confs` → 406 `PGRST116` (simula "nessuna riga", come `.maybeSingle()`)
- `rest/v1/user_categories` → `[]`

Il codice client reale viene comunque eseguito (storage sessione, cookie,
listener): vengono falsate solo le risposte backend, così i test sono
deterministici e non servono credenziali reali.

#### Cosa coprono

`e2e/auth.spec.js`

- apertura del modal di login, passaggio a "Registrati" e chiusura
- credenziali errate → mostra l'errore del backend
- refresh diretto su `/category/:id`: la sessione viene ripristinata prima di
  caricare le card e una cache vuota vecchia non nasconde una card aggiunta nel
  frattempo
- login riuscito: il modal si chiude, compare l'avatar, il cookie Supabase è
  host-only su localhost, la sessione sopravvive al reload e il logout la cancella

`e2e/navigation.spec.js`

- la schermata iniziale mostra le 4 modalità: Una Card, Due Card, Cantastorie,
  Giochi
- flusso Una Card: modalità → `/home` → `/animals` → indietro
- ogni categoria statica apre il proprio mazzo di card
- modalità Due Card: mostra sia la card primaria sia la secondaria
- deep link diretto a `/animals` e comportamento del tasto Indietro del browser

`e2e/card-selector.spec.js`

- le categorie Supabase si caricano anche se il selettore viene aperto mentre
  `initAuth()` sta ancora ripristinando la sessione (viene ritardato
  `getSession` di 1,5s)
- se la prima fetch fallisce con 500, alla riapertura si riprova
- una cache vuota non viene trattata come risposta valida
- alla terza apertura si usa la cache JSON, senza nuove richieste (restano 2
  fetch totali)

`e2e/sections.spec.js`

- **Cantastorie**: elenca le storie, apre la prima, verifica il testo e torna
  indietro
- **Giochi**: elenca i giochi, avvia "Tocca la Scatola" (verifica "Livello
  1/10") e torna alla hub
- **Info**: si apre dalla schermata iniziale, mostra la riga "Build" con un anno
  valido e torna indietro

#### Esecuzione

```bash
npm run test:e2e          # headless, tutti i progetti
npm run test:e2e:headed   # con browser visibile
npm run test:e2e:ui       # modalità interattiva Playwright
npm run test:e2e:report   # apre l'ultimo report HTML
```

Il report HTML viene salvato in `playwright-report/`; gli artefatti dei test
falliti in `test-results/`.

#### Cosa non è coperto

- CLI `scripts/upload-card.js`: `upload`, `video`, `move-card`, TTS, ffmpeg e
  Supabase reale
- funzioni di cache/auth e componenti Svelte a livello unitario
- test visuali/regressione
- non c'è una pipeline CI (`.github/` assente): i test vanno lanciati manualmente

### Database Setup (Supabase)

1. Create a new Supabase project
2. Run the SQL schema from `supabase-schema.sql`
3. Enable **Email** auth in Supabase dashboard
4. Copy your project URL and anon key to `.env`

## 🌐 Deployment

### Netlify

1. Build the project: `npm run build`
2. Drag the `public/` folder to Netlify

### Vercel

1. Connect your GitHub repository
2. Vercel will auto-detect Svelte and deploy

### GitHub Pages

```bash
npm run build
# Deploy the public/ folder to gh-pages branch
```

## 🛠️ Technologies

- **Svelte 3.55** - Reactive UI framework
- **Rollup** - Module bundler
- **Web Audio API** - Custom audio engine with buffer caching
- **Supabase** - Database, Auth, and Storage
- **MediaRecorder API** - Sound recording for custom cards
- **macOS TTS (Alice)** - Italian text-to-speech generation

## ♿ Accessibility Features

- **Single-button interface** - Large tap targets (90% of screen)
- **High contrast colors** - Customizable primary/secondary colors
- **Touch & mouse support** - Works on desktop, tablet, mobile
- **Keyboard support** - Space and A keys for card interaction
- **Visual progress feedback** - Progress bars during press
- **No time pressure** - Cumulative timing allows flexible interaction
- **Educational audio** - Animal names, phrases, songs
- **Interactive stories** - Engaging visual narratives

## 🎯 Target Audience

- Non-verbal children
- Children with autism
- Speech therapy
- Special education
- Caregivers/parents
- Schools/therapists

## 📝 License

MIT License - feel free to use this project for educational purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Designed for children with disabilities
- Italian TTS using macOS Alice voice
- Built with Svelte for reactivity and performance
- Powered by Supabase for cloud sync

---

## 🔌 Hardware - Controller ESP32

È possibile controllare Sound Pad fisicamente usando un **controller Bluetooth** basato su ESP32 con due grandi pulsanti. Il firmware `soundpad.c` trasforma l'ESP32 in una **tastiera Bluetooth (BLE)** che invia i tasti `A` e `Spazio` al dispositivo connesso.

### Componenti Necessari

| Componente | Specifica |
|------------|-----------|
| ESP32 | Qualsiasi board ESP32 (es. DevKit, Wemos, LilyGo) |
| 2 Pulsanti | Pulsanti grandi per bambini (normally open) |
| 2 Resistenze | 10kΩ (opzionali, usiamo pull-up interno) |
| Power Bank | Qualsiasi power bank USB standard |

### Schema Collegamenti

```
┌─────────────────────────────────────────────────────────────┐
│                         ESP32                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │   GPIO 4 ──────┬─────┐  (Button A)                  │    │
│  │               │     │                               │    │
│  │   GPIO 5 ─────┼─────┼──┐  (Button Space)           │    │
│  │               │     │  │                            │    │
│  │   GND ─────────┴─────┴──┴──┐                        │    │
│  │                             │                        │    │
│  └─────────────────────────────┼────────────────────────┘    │
│                                │                              │
│                          ┌─────┴─────┐                       │
│                          │  POWER    │                       │
│                          │  BANK     │                       │
│                          │  (USB)    │                      │
│                          └───────────┘                      │
└─────────────────────────────────────────────────────────────┘

Collegamento semplificato:

  GPIO 4 (Tasto A) ───┬─── Pulsante A ───┬─── GND
  GPIO 5 (Spazio) ────┴─── Pulsante ␣ ──┴─── GND
```

### Pinout ESP32

| ESP32 Pin | Funzione | Collegamento |
|-----------|----------|--------------|
| GPIO 4 | Tasto A | Pulsante → GND |
| GPIO 5 | Tasto Spazio | Pulsante → GND |
| GND | Massa | Cavo negativo |
| USB 5V | Alimentazione | Power Bank |

### Configurazione Arduino IDE

1. **Installa le schede ESP32**:
   - File → Preferenze → URL Gestore Schede:
     ```
     https://dl.espressif.com/dl/package_esp32_index.json
     ```
   - Strumenti → Scheda → ESP32 Arduino → "ESP32 Dev Module"

2. **Installa la libreria BleKeyboard**:
   - Sketch → Include Libreria → Gestione Librerie
   - Cerca e installa: **BleKeyboard** by T-vK

3. **Carica il firmware**:
   - Apri `soundpad.c` nell'Arduino IDE
   - Seleziona la porta USB corretta
   - Carica (Upload)

### Funzionamento

1. L'ESP32 si connette via **Bluetooth Low Energy** al tablet/phone
2. Il tablet vede l'ESP32 come "**Tastiera Accessibile**"
3. Premendo il **Pulsante A** → invia il tasto `a`
4. Premendo il **Pulsante Spazio** → invia il tasto `␣`
5. Nella app Sound Pad, usa i tasti `A` e `Spazio` per controllare le schede

### Autonomia

- **Power Bank**: 5000mAh circa
- **Consumo ESP32**: ~50mA in standby, ~100mA in trasmissione
- **Durata stimata**: **2-4 settimane** con uso normale
- Per durata massima: rimuovi LED indicatori, usa deep sleep quando non connesso

### Foto del Progetto

![Sound Pad Hardware Controller](public/soundpad-hw.png)

Controller ESP32 con pulsanti grandi per bambini, alimentato da power bank.


---

Made with ❤️ for accessible education
