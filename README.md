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

### 🔐 Cross-Domain Authentication (SSO-like)

Sound Pad supports **shared authentication** across all apps on `*.antoniogiordano.dev`. 
Once logged in on any app, you're automatically logged in on all others.

**Requirements:**
1. All apps must use the **same Supabase project** (same URL and anon key)
2. Set these environment variables on Netlify for each app:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**How it works:**
- On login: session token is saved to a cookie on `.antoniogiordano.dev`
- On page load: checks cookie first, restores session if found
- On logout: clears both localStorage and cookie
- Cookie expires after 7 days

**For other developers:**
Copy these files to your app to enable shared authentication:
- `src/authCookie.js` - Cookie utilities
- `src/authStore.js` - Updated auth logic
- `src/supabaseClient.js` - Supabase client

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
│   ├── authCookie.js      # Cross-domain cookie utilities
│   ├── supabaseClient.js  # Supabase client wrapper
│   ├── audioUtils.js      # Web Audio API utilities
│   └── main.js            # Entry point
├── scripts/               # Asset generation scripts
│   ├── generate-images.js
│   ├── generate-sounds.js
│   ├── generate-job-images.js
│   ├── generate-music-images.js
│   ├── generate-melodies.js
│   └── generateStoryAssets.js
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

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `public/` directory.

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
