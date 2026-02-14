import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'sounds');
const SAMPLE_RATE = 44100;
const DURATION = 5; // seconds

// Note frequencies
const NOTES = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
    'REST': 0
};

// Simple melodies (approximate for 5 seconds)
// Format: [Note, Duration (beats)]
// Tempo: approx 120 BPM (0.5s per beat) -> Actually let's make it faster notes for 5s clip
// We'll use 0.25s as base unit
const MELODIES = {
    'twinkle': [ // Twinkle Twinkle Little Star
        ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
        ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2]
    ],
    'happy': [ // Happy Birthday
        ['C4', 0.75], ['C4', 0.25], ['D4', 1], ['C4', 1], ['F4', 1], ['E4', 2],
        ['C4', 0.75], ['C4', 0.25], ['D4', 1], ['C4', 1], ['G4', 1], ['F4', 2]
    ],
    'wheels': [ // Wheels on the Bus
        ['C4', 1], ['F4', 1], ['F4', 0.5], ['F4', 0.5], ['F4', 1], ['A4', 1], ['C5', 1], ['A4', 1], ['F4', 2],
        ['G4', 1], ['E4', 1], ['C4', 2]
    ],
    'bingo': [ // Bingo
        ['G4', 1], ['C5', 1], ['C5', 1], ['C5', 0.5], ['C5', 0.5], ['A4', 1], ['A4', 1],
        ['G4', 0.5], ['G4', 0.5], ['F4', 1], ['F4', 1], ['E4', 1], ['D4', 1], ['C4', 2]
    ],
    'old_macdonald': [ // Old MacDonald
        ['G4', 1], ['G4', 1], ['G4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
        ['B4', 1], ['B4', 1], ['A4', 1], ['A4', 1], ['G4', 2]
    ],
    'itsy_bitsy': [ // Itsy Bitsy Spider
        ['G4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 1], ['D4', 0.5], ['C4', 0.5],
        ['D4', 1], ['E4', 1], ['C4', 2]
    ],
    'mary_lamb': [ // Mary Had a Little Lamb
        ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 2],
        ['D4', 1], ['D4', 1], ['D4', 2], ['E4', 1], ['G4', 1], ['G4', 2]
    ],
    'row_boat': [ // Row Your Boat
        ['C4', 1.5], ['C4', 1.5], ['C4', 1], ['D4', 0.5], ['E4', 1.5],
        ['E4', 1], ['D4', 0.5], ['E4', 1], ['F4', 0.5], ['G4', 3]
    ],
    'abc': [ // ABC Song
        ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
        ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2] // Same as Twinkle roughly
    ],
    'london_bridge': [ // London Bridge
        ['G4', 1.5], ['A4', 0.5], ['G4', 1], ['F4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
        ['D4', 1], ['E4', 1], ['F4', 2], ['E4', 1], ['F4', 1], ['G4', 2]
    ]
};

// WAV Header functions
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function generateSilence(duration) {
    return new Float32Array(SAMPLE_RATE * duration);
}

function generateTone(freq, duration, type = 'sine') {
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const buffer = new Float32Array(numSamples);
    const envelope = 0.1; // Attack/Release time in seconds
    const attackSamples = SAMPLE_RATE * 0.05;
    const decaySamples = SAMPLE_RATE * 0.4;

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        let value = 0;

        // Sine wave
        value = Math.sin(2 * Math.PI * freq * t);

        // Add some harmonics for "Music Box" sound (like a triangle/bell)
        if (freq > 0) {
            value += 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
            value += 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
        }

        // Apply Envelope (Attack, Decay, Sustain, Release)
        let amp = 0.5; // Master volume
        if (i < attackSamples) {
            amp *= i / attackSamples;
        } else {
            // Natural exponential decay for bell-like sound
            const decayProgress = (i - attackSamples) / SAMPLE_RATE;
            amp *= Math.exp(-3 * decayProgress);
        }

        buffer[i] = value * amp;
    }
    return buffer;
}

function bufferToWav(buffer) {
    const numChannels = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = SAMPLE_RATE * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    // RIFF chunk
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write samples
    const pcmData = new Int16Array(arrayBuffer, 44, buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        // Clip and scale to 16-bit
        let s = Math.max(-1, Math.min(1, buffer[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    return Buffer.from(arrayBuffer);
}

// Generate all melodies
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

Object.entries(MELODIES).forEach(([key, notes]) => {
    let fullBuffer = new Float32Array(0);

    // Calculate timing to fit roughly in 5 seconds or loop
    // Base unit duration
    const beatDuration = 0.35; // seconds

    notes.forEach(([note, beats]) => {
        const freq = NOTES[note];
        const duration = beats * beatDuration;
        const toneBuffer = generateTone(freq, duration);

        // Concatenate
        const newBuffer = new Float32Array(fullBuffer.length + toneBuffer.length);
        newBuffer.set(fullBuffer);
        newBuffer.set(toneBuffer, fullBuffer.length);
        fullBuffer = newBuffer;
    });

    // Pad or trim to exactly 5 seconds
    const targetSamples = SAMPLE_RATE * DURATION;
    let finalBuffer = new Float32Array(targetSamples);

    if (fullBuffer.length < targetSamples) {
        // Loop if too short
        let offset = 0;
        while (offset < targetSamples) {
            const chunk = Math.min(fullBuffer.length, targetSamples - offset);
            finalBuffer.set(fullBuffer.subarray(0, chunk), offset);
            offset += chunk;
        }
    } else {
        finalBuffer.set(fullBuffer.subarray(0, targetSamples));
    }

    // Apply a fade out at the very end to avoid clicking
    const fadeOutSamples = 1000;
    for (let i = 0; i < fadeOutSamples; i++) {
        finalBuffer[targetSamples - 1 - i] *= (i / fadeOutSamples);
    }

    const wavData = bufferToWav(finalBuffer);
    const filePath = path.join(OUTPUT_DIR, `${key}.wav`);
    fs.writeFileSync(filePath, wavData);
    console.log(`✓ Generated ${key}.wav`);
});

console.log('✅ Generated all melody files!');
