# Animal Soundboard 🦁🔊

Un'applicazione interattiva di soundboard con animali, progettata per bambini con disabilità. Interfaccia a pulsante singolo con nomi di animali in italiano e sintesi vocale.

An interactive animal soundboard game designed for children with disabilities. Features a single-button interface with Italian animal names and text-to-speech.

## ✨ Features

- 🇮🇹 **Italian Localization**: All 50 animal names in Italian with proper TTS pronunciation
- 🎯 **Single-Button Interface**: Large, accessible button occupying 90% of screen
- 📊 **Cumulative Progress Bar**: Tracks press duration across multiple interactions
- 🔄 **Automatic Transitions**: Random animal change after 5 seconds of cumulative pressing
- 🔊 **Text-to-Speech Audio**: Italian voice (Alice) pronouncing each animal name
- 📱 **Touch & Mouse Support**: Works on desktop and mobile devices
- 🎨 **Child-Friendly Design**: Vibrant colors, large emoji icons, high contrast
- ♿ **Accessibility First**: Designed specifically for children with disabilities

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm

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

## 🎮 How to Use

1. **Press and hold** the large animal button to hear the Italian name
2. The **progress bar** at the top fills as you hold the button
3. After **5 seconds** of cumulative pressing, a new random animal appears
4. Release and press again - the progress bar remembers your previous time!

## 🏗️ Project Structure

```
soundpad/
├── public/
│   ├── animals/          # 50 SVG animal images
│   ├── sounds/           # 50 WAV audio files (Italian TTS)
│   └── global.css        # Global styles
├── src/
│   ├── App.svelte        # Main application component
│   ├── animals.js        # Animal data structure
│   ├── i18n.js           # Italian translations
│   └── main.js           # App entry point
├── scripts/
│   ├── generate-images.js        # Generate SVG animal images
│   └── generate-tts-italian.sh   # Generate Italian TTS audio
└── package.json
```

## 🎨 Animals Included

50 animals with Italian names and TTS:

Leone, Elefante, Cane, Gatto, Mucca, Cavallo, Pecora, Maiale, Gallina, Anatra, Oca, Tacchino, Gallo, Rana, Gufo, Corvo, Pappagallo, Pavone, Scimmia, Orso, Lupo, Volpe, Cervo, Capra, Asino, Zebra, Giraffa, Ippopotamo, Rinoceronte, Tigre, Leopardo, Ghepardo, Panda, Koala, Canguro, Pinguino, Foca, Delfino, Balena, Serpente, Coccodrillo, Ape, Grillo, Zanzara, Gabbiano, Aquila, Falco, Coyote, Iena, Gorilla

## 🔧 Development

### Generate Assets

```bash
# Generate animal images (SVG)
node scripts/generate-images.js

# Generate Italian TTS audio (requires macOS)
./scripts/generate-tts-italian.sh
```

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `public/` directory.

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
- **Web Audio API** - For audio playback
- **macOS TTS (Alice)** - Italian text-to-speech generation

## ♿ Accessibility Features

- Large tap targets (90% of screen)
- High contrast colors
- Simple single-action interaction
- Visual progress feedback
- No time pressure - cumulative timing
- Touch and mouse support
- Educational audio (animal names)

## 📝 License

MIT License - feel free to use this project for educational purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Designed for children with disabilities
- Italian TTS using macOS Alice voice
- Emoji icons for visual representation

---

Made with ❤️ for accessible education
