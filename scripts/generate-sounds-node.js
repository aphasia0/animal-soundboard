#!/usr/bin/env node

/**
 * Simple audio generator that creates 5-second WAV files with tones
 * These can be used as placeholder sounds or converted to more realistic sounds later
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const animalNames = [
    'lion', 'elephant', 'dog', 'cat', 'cow', 'horse', 'sheep', 'pig', 'chicken', 'duck',
    'goose', 'turkey', 'rooster', 'frog', 'owl', 'crow', 'parrot', 'peacock', 'monkey', 'bear',
    'wolf', 'fox', 'deer', 'goat', 'donkey', 'zebra', 'giraffe', 'hippo', 'rhino', 'tiger',
    'leopard', 'cheetah', 'panda', 'koala', 'kangaroo', 'penguin', 'seal', 'dolphin', 'whale', 'snake',
    'crocodile', 'bee', 'cricket', 'mosquito', 'seagull', 'eagle', 'hawk', 'coyote', 'hyena', 'gorilla'
];

const soundProfiles = {
    lion: { freq: 150, pattern: 'roar' },
    elephant: { freq: 100, pattern: 'trumpet' },
    dog: { freq: 400, pattern: 'bark' },
    cat: { freq: 500, pattern: 'meow' },
    cow: { freq: 200, pattern: 'moo' },
    horse: { freq: 300, pattern: 'simple' },
    sheep: { freq: 350, pattern: 'simple' },
    pig: { freq: 250, pattern: 'simple' },
    chicken: { freq: 600, pattern: 'cluck' },
    duck: { freq: 450, pattern: 'quack' },
    goose: { freq: 400, pattern: 'simple' },
    turkey: { freq: 300, pattern: 'simple' },
    rooster: { freq: 700, pattern: 'simple' },
    frog: { freq: 500, pattern: 'ribbit' },
    owl: { freq: 350, pattern: 'hoot' },
    crow: { freq: 550, pattern: 'simple' },
    parrot: { freq: 800, pattern: 'simple' },
    peacock: { freq: 600, pattern: 'simple' },
    monkey: { freq: 700, pattern: 'chatter' },
    bear: { freq: 120, pattern: 'growl' },
    wolf: { freq: 200, pattern: 'howl' },
    fox: { freq: 450, pattern: 'simple' },
    deer: { freq: 300, pattern: 'simple' },
    goat: { freq: 400, pattern: 'simple' },
    donkey: { freq: 250, pattern: 'bray' },
    zebra: { freq: 350, pattern: 'simple' },
    giraffe: { freq: 200, pattern: 'simple' },
    hippo: { freq: 150, pattern: 'grunt' },
    rhino: { freq: 130, pattern: 'simple' },
    tiger: { freq: 140, pattern: 'roar' },
    leopard: { freq: 160, pattern: 'growl' },
    cheetah: { freq: 180, pattern: 'chirp' },
    panda: { freq: 250, pattern: 'simple' },
    koala: { freq: 300, pattern: 'grunt' },
    kangaroo: { freq: 350, pattern: 'simple' },
    penguin: { freq: 500, pattern: 'trumpet' },
    seal: { freq: 400, pattern: 'bark' },
    dolphin: { freq: 1000, pattern: 'click' },
    whale: { freq: 80, pattern: 'song' },
    snake: { freq: 600, pattern: 'hiss' },
    crocodile: { freq: 150, pattern: 'growl' },
    bee: { freq: 1200, pattern: 'buzz' },
    cricket: { freq: 2000, pattern: 'chirp' },
    mosquito: { freq: 1500, pattern: 'buzz' },
    seagull: { freq: 800, pattern: 'simple' },
    eagle: { freq: 700, pattern: 'screech' },
    hawk: { freq: 750, pattern: 'screech' },
    coyote: { freq: 250, pattern: 'howl' },
    hyena: { freq: 400, pattern: 'laugh' },
    gorilla: { freq: 180, pattern: 'grunt' }
};

function generateWavFile(frequency, duration, pattern, filename) {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const numChannels = 1;
    const bytesPerSample = 2;

    // Create buffer for WAV file
    const dataSize = numSamples * numChannels * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // fmt chunk size
    buffer.writeUInt16LE(1, 20); // audio format (PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
    buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
    buffer.writeUInt16LE(bytesPerSample * 8, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Generate audio samples
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        let value = 0;

        // Generate different patterns
        switch (pattern) {
            case 'bark':
            case 'cluck':
                // Short bursts
                const burstTime = t % 1.5;
                if (burstTime < 0.3) {
                    value = Math.sin(2 * Math.PI * frequency * t);
                }
                break;

            case 'buzz':
            case 'hiss':
                // Continuous with noise
                value = Math.sin(2 * Math.PI * frequency * t) + (Math.random() - 0.5) * 0.3;
                break;

            case 'howl':
                // Sustained with vibrato
                const vibrato = frequency * (1 + 0.05 * Math.sin(2 * Math.PI * 5 * t));
                value = Math.sin(2 * Math.PI * vibrato * t);
                break;

            case 'chirp':
                // Frequency sweep
                const sweepFreq = frequency + (frequency * 0.5) * (t / duration);
                value = Math.sin(2 * Math.PI * sweepFreq * t);
                break;

            case 'meow':
                // Rising then falling
                const freqMod = frequency * (1 + 0.3 * Math.sin(2 * Math.PI * 2 * t));
                value = Math.sin(2 * Math.PI * freqMod * t);
                value *= Math.exp(-t * 0.5);
                break;

            case 'roar':
            case 'growl':
                // Low rumbling
                value = Math.sin(2 * Math.PI * frequency * t);
                value += 0.5 * Math.sin(2 * Math.PI * (frequency * 1.5) * t);
                value *= Math.exp(-t * 0.3);
                break;

            default:
                // Simple tone with harmonics
                value = Math.sin(2 * Math.PI * frequency * t);
                value += 0.3 * Math.sin(2 * Math.PI * (frequency * 2) * t);
        }

        // Apply envelope (fade in/out)
        const fadeTime = 0.1;
        if (t < fadeTime) {
            value *= t / fadeTime;
        } else if (t > duration - fadeTime) {
            value *= (duration - t) / fadeTime;
        }

        // Convert to 16-bit PCM
        const sample = Math.max(-1, Math.min(1, value * 0.3));
        const intSample = Math.floor(sample * 32767);
        buffer.writeInt16LE(intSample, 44 + i * 2);
    }

    fs.writeFileSync(filename, buffer);
}

// Generate sounds
const soundsDir = path.join(__dirname, '..', 'public', 'sounds');

console.log('Generating animal sounds...\n');

animalNames.forEach((animal, index) => {
    const profile = soundProfiles[animal] || { freq: 440, pattern: 'simple' };
    const wavPath = path.join(soundsDir, `${animal}.wav`);

    generateWavFile(profile.freq, 5.0, profile.pattern, wavPath);
    console.log(`✓ Created ${animal}.wav (${index + 1}/${animalNames.length})`);
});

console.log('\n✅ All 50 animal sounds generated successfully!');
console.log('\nNote: These are WAV files. The browser can play them directly.');
console.log('If you need MP3 files, you can convert them using ffmpeg or an online converter.');
