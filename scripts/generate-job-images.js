import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Job data with emojis
const jobs = [
    { key: 'doctor', emoji: '👨‍⚕️', name: 'Dottore', gradient: ['#FF6B6B', '#FF8E8E'] },
    { key: 'teacher', emoji: '👨‍🏫', name: 'Insegnante', gradient: ['#4ECDC4', '#44A08D'] },
    { key: 'firefighter', emoji: '👨‍🚒', name: 'Pompiere', gradient: ['#FF6B6B', '#C92A2A'] },
    { key: 'police', emoji: '👮', name: 'Poliziotto', gradient: ['#4C6EF5', '#3B5BDB'] },
    { key: 'chef', emoji: '👨‍🍳', name: 'Cuoco', gradient: ['#FFD93D', '#FFC107'] },
    { key: 'farmer', emoji: '👨‍🌾', name: 'Contadino', gradient: ['#51CF66', '#37B24D'] },
    { key: 'builder', emoji: '👷', name: 'Muratore', gradient: ['#FF922B', '#FD7E14'] },
    { key: 'pilot', emoji: '👨‍✈️', name: 'Pilota', gradient: ['#748FFC', '#5C7CFA'] },
    { key: 'artist', emoji: '👨‍🎨', name: 'Artista', gradient: ['#DA77F2', '#CC5DE8'] },
    { key: 'mechanic', emoji: '👨‍🔧', name: 'Meccanico', gradient: ['#868E96', '#495057'] }
];

// Create jobs directory if it doesn't exist
const jobsDir = path.join(__dirname, '..', 'public', 'jobs');
if (!fs.existsSync(jobsDir)) {
    fs.mkdirSync(jobsDir, { recursive: true });
}

// Generate SVG for each job
jobs.forEach(job => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad-${job.key}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${job.gradient[0]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${job.gradient[1]};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="200" cy="200" r="180" fill="url(#grad-${job.key})" />
  
  <!-- Emoji -->
  <text x="200" y="240" font-size="160" text-anchor="middle" font-family="Arial, sans-serif">
    ${job.emoji}
  </text>
</svg>`;

    const filePath = path.join(jobsDir, `${job.key}.svg`);
    fs.writeFileSync(filePath, svg);
    console.log(`✓ Created ${job.key}.svg`);
});

console.log('\n✅ All job images generated!');
console.log(`Created ${jobs.length} SVG files in public/jobs/`);
