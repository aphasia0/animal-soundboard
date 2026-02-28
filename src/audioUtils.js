
// Web Audio API based audio engine for instant playback on iOS
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioContext = null;

// Cache: sound path -> decoded AudioBuffer
const bufferCache = new Map();

// Single-channel state
let currentSource = null;
let currentSourceStartCtxTime = 0;
let currentBuffer = null;

// Multi-channel sources: channelId -> { source, startCtxTime, buffer }
const channelSources = new Map();

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
        if (!path) return; // skip undefined/null paths
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
 * Fetches or retrieves a cached AudioBuffer for the given source.
 */
async function getBuffer(src) {
    const ctx = getAudioContext();
    let buffer = bufferCache.get(src);
    if (!buffer) {
        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            buffer = await ctx.decodeAudioData(arrayBuffer);
            bufferCache.set(src, buffer);
        } catch (err) {
            console.warn('Audio load failed:', err);
            return null;
        }
    }
    return buffer;
}

/**
 * Plays an audio file with looping enabled (single-channel).
 * Optionally starts playback from a given offset (in seconds).
 *
 * @param {string} src - Path to the audio file
 * @param {number} [offset=0] - Playback start offset in seconds
 */
export async function playAudio(src, offset = 0) {
    if (!src) return; // skip undefined/null paths
    stopAudio();

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    const buffer = await getBuffer(src);
    if (!buffer) return;

    // Clamp offset within buffer duration
    const safeOffset = offset % buffer.duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start(0, safeOffset);

    currentSource = source;
    currentSourceStartCtxTime = ctx.currentTime - safeOffset;
    currentBuffer = buffer;
}

/**
 * Stops the currently playing audio (single-channel).
 * Returns the current playback offset in seconds so it can be resumed later.
 *
 * @returns {number} offset in seconds
 */
export function stopAudio() {
    let offset = 0;
    if (currentSource && currentBuffer) {
        const ctx = getAudioContext();
        const elapsed = ctx.currentTime - currentSourceStartCtxTime;
        offset = elapsed % currentBuffer.duration;
        try { currentSource.stop(); } catch (e) { /* already stopped */ }
        currentSource.disconnect();
    }
    currentSource = null;
    currentBuffer = null;
    currentSourceStartCtxTime = 0;
    return offset;
}

/**
 * Plays an audio file on a named channel. Each channel is independent.
 * Optionally starts from a given offset in seconds.
 *
 * @param {string} src - Path to the audio file
 * @param {string} channelId - Unique channel identifier
 * @param {number} [offset=0] - Playback start offset in seconds
 */
export async function playAudioChannel(src, channelId, offset = 0) {
    if (!src) return; // skip undefined/null paths
    stopAudioChannel(channelId);

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    const buffer = await getBuffer(src);
    if (!buffer) return;

    const safeOffset = offset % buffer.duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start(0, safeOffset);

    channelSources.set(channelId, {
        source,
        startCtxTime: ctx.currentTime - safeOffset,
        buffer
    });
}

/**
 * Stops audio on a specific named channel.
 * Returns the current playback offset in seconds.
 *
 * @param {string} channelId - The channel to stop
 * @returns {number} offset in seconds
 */
export function stopAudioChannel(channelId) {
    const entry = channelSources.get(channelId);
    let offset = 0;
    if (entry) {
        const ctx = getAudioContext();
        const elapsed = ctx.currentTime - entry.startCtxTime;
        offset = elapsed % entry.buffer.duration;
        try { entry.source.stop(); } catch (e) { /* already stopped */ }
        entry.source.disconnect();
        channelSources.delete(channelId);
    }
    return offset;
}

/**
 * Stops all named channels.
 */
export function stopAllChannels() {
    for (const [id] of channelSources) {
        stopAudioChannel(id);
    }
}
