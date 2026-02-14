import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Animal list
const animalNames = [
    'lion', 'elephant', 'dog', 'cat', 'cow', 'horse', 'sheep', 'pig', 'chicken', 'duck',
    'goose', 'turkey', 'rooster', 'frog', 'owl', 'crow', 'parrot', 'peacock', 'monkey', 'bear',
    'wolf', 'fox', 'deer', 'goat', 'donkey', 'zebra', 'giraffe', 'hippo', 'rhino', 'tiger',
    'leopard', 'cheetah', 'panda', 'koala', 'kangaroo', 'penguin', 'seal', 'dolphin', 'whale', 'snake',
    'crocodile', 'bee', 'cricket', 'mosquito', 'seagull', 'eagle', 'hawk', 'coyote', 'hyena', 'gorilla'
];

// Create directories
const animalsDir = path.join(__dirname, '..', 'public', 'animals');
const soundsDir = path.join(__dirname, '..', 'public', 'sounds');

if (!fs.existsSync(animalsDir)) {
    fs.mkdirSync(animalsDir, { recursive: true });
}
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
}

// Generate SVG images for each animal
function generateAnimalSVG(animalName, index) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
        '#FF8FA3', '#6C5CE7', '#00B894', '#FDCB6E', '#E17055',
        '#74B9FF', '#A29BFE', '#FD79A8', '#FFEAA7', '#DFE6E9'
    ];

    const color = colors[index % colors.length];
    const emoji = getAnimalEmoji(animalName);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${adjustColor(color, -30)};stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="400" cy="400" r="350" fill="url(#grad${index})" />
  <text x="400" y="480" font-size="280" text-anchor="middle" fill="white" font-family="Arial, sans-serif">${emoji}</text>
  <text x="400" y="680" font-size="60" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold">${capitalizeFirst(animalName)}</text>
</svg>`;

    return svg;
}

function getAnimalEmoji(name) {
    const emojiMap = {
        lion: '🦁', elephant: '🐘', dog: '🐕', cat: '🐱', cow: '🐄',
        horse: '🐴', sheep: '🐑', pig: '🐷', chicken: '🐔', duck: '🦆',
        goose: '🦢', turkey: '🦃', rooster: '🐓', frog: '🐸', owl: '🦉',
        crow: '🐦', parrot: '🦜', peacock: '🦚', monkey: '🐵', bear: '🐻',
        wolf: '🐺', fox: '🦊', deer: '🦌', goat: '🐐', donkey: '🫏',
        zebra: '🦓', giraffe: '🦒', hippo: '🦛', rhino: '🦏', tiger: '🐯',
        leopard: '🐆', cheetah: '🐆', panda: '🐼', koala: '🐨', kangaroo: '🦘',
        penguin: '🐧', seal: '🦭', dolphin: '🐬', whale: '🐋', snake: '🐍',
        crocodile: '🐊', bee: '🐝', cricket: '🦗', mosquito: '🦟', seagull: '🕊️',
        eagle: '🦅', hawk: '🦅', coyote: '🐺', hyena: '🐺', gorilla: '🦍'
    };
    return emojiMap[name] || '🐾';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function adjustColor(color, amount) {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Generate images
console.log('Generating animal images...');
animalNames.forEach((name, index) => {
    const svg = generateAnimalSVG(name, index);
    const filename = path.join(animalsDir, `${name}.svg`);
    fs.writeFileSync(filename, svg);
    console.log(`Created ${name}.svg`);
});

console.log('\nAll animal images generated successfully!');
console.log('\nNote: Audio files need to be generated separately.');
console.log('For now, you can use placeholder audio or record/download animal sounds.');
