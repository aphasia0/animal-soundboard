import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Music pieces with emojis and colors
const musicPieces = [
    { key: 'twinkle', emoji: '⭐', name: 'Twinkle Twinkle', gradient: ['#FFD93D', '#FFC107'] },
    { key: 'happy', emoji: '🎂', name: 'Happy Birthday', gradient: ['#FF6B9D', '#C44569'] },
    { key: 'wheels', emoji: '🚌', name: 'Wheels on the Bus', gradient: ['#FFA500', '#FF8C00'] },
    { key: 'bingo', emoji: '🐕', name: 'Bingo', gradient: ['#A0826D', '#8B6F47'] },
    { key: 'old_macdonald', emoji: '🚜', name: 'Old MacDonald', gradient: ['#51CF66', '#37B24D'] },
    { key: 'itsy_bitsy', emoji: '🕷️', name: 'Itsy Bitsy Spider', gradient: ['#868E96', '#495057'] },
    { key: 'mary_lamb', emoji: '🐑', name: 'Mary Had a Little Lamb', gradient: ['#E9ECEF', '#CED4DA'] },
    { key: 'row_boat', emoji: '🚣', name: 'Row Your Boat', gradient: ['#4DABF7', '#339AF0'] },
    { key: 'abc', emoji: '🔤', name: 'ABC Song', gradient: ['#FF6B6B', '#EE5A6F'] },
    { key: 'london_bridge', emoji: '🌉', name: 'London Bridge', gradient: ['#748FFC', '#5C7CFA'] }
];

// Create music directory if it doesn't exist
const musicDir = path.join(__dirname, '..', 'public', 'music');
if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true });
}

// Generate SVG for each music piece
musicPieces.forEach(piece => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad-${piece.key}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${piece.gradient[0]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${piece.gradient[1]};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="200" cy="200" r="180" fill="url(#grad-${piece.key})" />
  
  <!-- Musical note decoration -->
  <text x="80" y="120" font-size="40" fill="rgba(255,255,255,0.3)">♪</text>
  <text x="280" y="140" font-size="50" fill="rgba(255,255,255,0.3)">♫</text>
  
  <!-- Emoji -->
  <text x="200" y="240" font-size="140" text-anchor="middle" font-family="Arial, sans-serif">
    ${piece.emoji}
  </text>
  
  <!-- More musical notes -->
  <text x="100" y="320" font-size="35" fill="rgba(255,255,255,0.3)">♬</text>
  <text x="290" y="300" font-size="40" fill="rgba(255,255,255,0.3)">♩</text>
</svg>`;

    const filePath = path.join(musicDir, `${piece.key}.svg`);
    fs.writeFileSync(filePath, svg);
    console.log(`✓ Created ${piece.key}.svg`);
});

console.log('\n✅ All music images generated!');
console.log(`Created ${musicPieces.length} SVG files in public/music/`);
