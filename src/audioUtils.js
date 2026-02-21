
// Web Audio API based audio engine for instant playback on iOS
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioContext = null;

// Cache: sound path -> decoded AudioBuffer
const bufferCache = new Map();

let currentSource = null;

/**
 * Returns the shared AudioContext, creating it lazily.
 */
function getAudioContext() {
    if (!audioContext) {
        audioContext = new AudioContextClass();
    }
    return audioContext;
}

/**
 * Resumes the AudioContext if it is suspended.
 * Must be called from a user gesture handler on iOS.
 */
export async function resumeAudioContext() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }
}

/**
 * Preloads an array of sound file paths, fetching and decoding them
 * into AudioBuffers stored in cache. Subsequent playAudio() calls
 * for these paths will be instant.
 *
 * @param {string[]} paths - Array of sound file paths to preload
 */
export async function preloadSounds(paths) {
    const ctx = getAudioContext();
    const promises = paths.map(async (path) => {
        if (bufferCache.has(path)) return; // already cached
        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            bufferCache.set(path, audioBuffer);
        } catch (err) {
            console.warn(`Failed to preload "${path}":`, err);
        }
    });
    await Promise.all(promises);
}

/**
 * Plays an audio file with looping enabled.
 * Uses pre-decoded AudioBuffers for instant start on iOS.
 *
 * @param {string} src - Path to the audio file
 */
export async function playAudio(src) {
    // Stop any currently playing sound
    stopAudio();

    const ctx = getAudioContext();

    // Ensure the context is running (iOS may suspend it)
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    let buffer = bufferCache.get(src);

    // Fallback: if not preloaded, fetch & decode now
    if (!buffer) {
        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            buffer = await ctx.decodeAudioData(arrayBuffer);
            bufferCache.set(src, buffer);
        } catch (err) {
            console.warn('Audio load failed:', err);
            return;
        }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start(0);
    currentSource = source;
}

/**
 * Stops the currently playing audio.
 */
export function stopAudio() {
    if (currentSource) {
        try {
            currentSource.stop();
        } catch (e) {
            // Ignore if already stopped
        }
        currentSource.disconnect();
        currentSource = null;
    }
}
