
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
        if (path.startsWith('synth:')) return; // skip synth paths
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
 * Preloads an array of image URLs by creating Image objects in memory.
 * Subsequent renders of these image URLs in <img> tags will be instant.
 *
 * @param {string[]} urls - Array of image URLs to preload
 */
export function preloadImages(urls) {
    if (!urls || !Array.isArray(urls)) return;
    urls.forEach((url) => {
        if (!url) return;
        const img = new Image();
        img.src = url;
    });
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
 * @param {boolean} [loop=true] - Whether the sound should loop
 */
export async function playAudio(src, offset = 0, loop = true) {
    if (!src) return; // skip undefined/null paths
    stopAudio();

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    if (src.startsWith('synth:')) {
        const instrument = src.split(':')[1];
        const synthObj = triggerSynth(instrument, loop);
        currentSource = synthObj;
        currentSourceStartCtxTime = ctx.currentTime;
        currentBuffer = { duration: 3 }; // mock buffer
        return;
    }

    const buffer = await getBuffer(src);
    if (!buffer) return;

    // Clamp offset within buffer duration
    const safeOffset = offset % buffer.duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
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
 * @param {boolean} [loop=true] - Whether the sound should loop
 */
export async function playAudioChannel(src, channelId, offset = 0, loop = true) {
    if (!src) return; // skip undefined/null paths
    stopAudioChannel(channelId);

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    if (src.startsWith('synth:')) {
        const instrument = src.split(':')[1];
        const synthObj = triggerSynth(instrument, loop);
        channelSources.set(channelId, {
            source: synthObj,
            startCtxTime: ctx.currentTime,
            buffer: { duration: 3 } // mock buffer
        });
        return;
    }

    const buffer = await getBuffer(src);
    if (!buffer) return;

    const safeOffset = offset % buffer.duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
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

/**
 * Returns the duration (in seconds) of a cached sound buffer.
 * Returns 0 if the sound hasn't been loaded yet.
 *
 * @param {string} src - Path to the audio file
 * @returns {number} duration in seconds
 */
export function getAudioDuration(src) {
    if (src && src.startsWith('synth:')) {
        return 3;
    }
    const buffer = bufferCache.get(src);
    return buffer ? buffer.duration : 0;
}

/**
 * Triggers a short haptic feedback (vibration) if supported by the device.
 *
 * @param {number} [duration=50] - Duration of the vibration in ms
 */
export function triggerVibration(duration = 50) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

// Synthesis engine for 20 musical instruments
let cachedNoiseBuffer = null;
function createNoiseBuffer(ctx) {
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}
function getNoiseBuffer() {
    if (!cachedNoiseBuffer && audioContext) {
        cachedNoiseBuffer = createNoiseBuffer(audioContext);
    }
    return cachedNoiseBuffer;
}

function triggerSynth(instrument, loop = false) {
    const ctx = getAudioContext();
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    
    const activeNodes = [];
    let loopInterval = null;

    function play() {
        const now = ctx.currentTime;
        
        switch (instrument) {
            case 'pianoforte': {
                function playPianoNote(freq, startTime, duration) {
                    const osc1 = ctx.createOscillator();
                    const osc2 = ctx.createOscillator();
                    const osc3 = ctx.createOscillator();
                    const noteGain = ctx.createGain();

                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(freq, startTime);

                    osc2.type = 'triangle';
                    osc2.frequency.setValueAtTime(freq, startTime);

                    osc3.type = 'sine';
                    osc3.frequency.setValueAtTime(freq * 2, startTime);

                    noteGain.gain.setValueAtTime(0, startTime);
                    noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.005);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc1.connect(noteGain);
                    osc2.connect(noteGain);
                    osc3.connect(noteGain);
                    noteGain.connect(masterGain);

                    osc1.start(startTime);
                    osc2.start(startTime);
                    osc3.start(startTime);

                    osc1.stop(startTime + duration);
                    osc2.stop(startTime + duration);
                    osc3.stop(startTime + duration);

                    activeNodes.push(osc1, osc2, osc3, noteGain);
                }
                playPianoNote(261.63, now, 2.5); // C4
                playPianoNote(329.63, now + 0.15, 2.5); // E4
                playPianoNote(392.00, now + 0.3, 2.5); // G4
                playPianoNote(523.25, now + 0.45, 2.5); // C5
                break;
            }
            case 'chitarra': {
                function playGuitarNote(freq, startTime) {
                    const osc = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const noteGain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, startTime);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(2000, startTime);
                    filter.frequency.exponentialRampToValueAtTime(100, startTime + 1.2);

                    noteGain.gain.setValueAtTime(0, startTime);
                    noteGain.gain.linearRampToValueAtTime(0.4, startTime + 0.002);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.8);

                    osc.connect(filter);
                    filter.connect(noteGain);
                    noteGain.connect(masterGain);

                    osc.start(startTime);
                    osc.stop(startTime + 1.8);

                    activeNodes.push(osc, filter, noteGain);
                }
                playGuitarNote(130.81, now);
                playGuitarNote(196.00, now + 0.05);
                playGuitarNote(261.63, now + 0.1);
                playGuitarNote(329.63, now + 0.15);
                playGuitarNote(392.00, now + 0.2);
                break;
            }
            case 'flauto': {
                function playFluteNote(freq, startTime, duration) {
                    const osc = ctx.createOscillator();
                    const lfo = ctx.createOscillator();
                    const lfoGain = ctx.createGain();
                    const noteGain = ctx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, startTime);

                    lfo.frequency.setValueAtTime(5.5, startTime);
                    lfoGain.gain.setValueAtTime(5, startTime);

                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);

                    const noise = ctx.createBufferSource();
                    const noiseBuf = getNoiseBuffer();
                    if (noiseBuf) {
                        noise.buffer = noiseBuf;
                        const noiseFilter = ctx.createBiquadFilter();
                        noiseFilter.type = 'bandpass';
                        noiseFilter.frequency.setValueAtTime(freq, startTime);
                        noiseFilter.Q.setValueAtTime(12, startTime);
                        const noiseGain = ctx.createGain();
                        noiseGain.gain.setValueAtTime(0.015, startTime);

                        noise.connect(noiseFilter);
                        noiseFilter.connect(noiseGain);
                        noiseGain.connect(noteGain);
                        
                        noise.start(startTime);
                        noise.stop(startTime + duration);
                        activeNodes.push(noise, noiseFilter, noiseGain);
                    }

                    noteGain.gain.setValueAtTime(0, startTime);
                    noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.08);
                    noteGain.gain.setValueAtTime(0.3, startTime + duration - 0.08);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc.connect(noteGain);
                    noteGain.connect(masterGain);

                    osc.start(startTime);
                    lfo.start(startTime);

                    osc.stop(startTime + duration);
                    lfo.stop(startTime + duration);

                    activeNodes.push(osc, lfo, lfoGain, noteGain);
                }
                playFluteNote(523.25, now, 0.4); // C5
                playFluteNote(587.33, now + 0.45, 0.4); // D5
                playFluteNote(659.25, now + 0.9, 0.4); // E5
                playFluteNote(783.99, now + 1.35, 0.8); // G5
                break;
            }
            case 'tamburo': {
                function playKick(startTime) {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.frequency.setValueAtTime(150, startTime);
                    osc.frequency.exponentialRampToValueAtTime(45, startTime + 0.12);
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.8, startTime + 0.002);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
                    osc.connect(gain);
                    gain.connect(masterGain);
                    osc.start(startTime);
                    osc.stop(startTime + 0.25);
                    activeNodes.push(osc, gain);
                }
                function playSnare(startTime) {
                    const noiseBuf = getNoiseBuffer();
                    if (!noiseBuf) return;
                    const noise = ctx.createBufferSource();
                    noise.buffer = noiseBuf;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(1000, startTime);
                    const gain = ctx.createGain();
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.4, startTime + 0.002);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);
                    noise.start(startTime);
                    noise.stop(startTime + 0.2);
                    activeNodes.push(noise, filter, gain);
                }
                function playHihat(startTime) {
                    const noiseBuf = getNoiseBuffer();
                    if (!noiseBuf) return;
                    const noise = ctx.createBufferSource();
                    noise.buffer = noiseBuf;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.setValueAtTime(8000, startTime);
                    const gain = ctx.createGain();
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.15, startTime + 0.001);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);
                    noise.start(startTime);
                    noise.stop(startTime + 0.06);
                    activeNodes.push(noise, filter, gain);
                }
                playKick(now);
                playHihat(now + 0.2);
                playSnare(now + 0.4);
                playHihat(now + 0.6);
                playKick(now + 0.8);
                playSnare(now + 1.2);
                break;
            }
            case 'tromba': {
                function playTrumpetNote(freq, startTime, duration) {
                    const osc = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const gain = ctx.createGain();

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, startTime);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(800, startTime);
                    filter.frequency.exponentialRampToValueAtTime(3000, startTime + 0.08);
                    filter.frequency.setValueAtTime(3000, startTime + duration - 0.05);
                    filter.frequency.exponentialRampToValueAtTime(1000, startTime + duration);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.25, startTime + 0.06);
                    gain.gain.setValueAtTime(0.25, startTime + duration - 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    osc.stop(startTime + duration);

                    activeNodes.push(osc, filter, gain);
                }
                playTrumpetNote(392.00, now, 0.15); // G4
                playTrumpetNote(523.25, now + 0.2, 0.15); // C5
                playTrumpetNote(659.25, now + 0.4, 0.6); // E5
                break;
            }
            case 'violino': {
                function playViolinNote(freq, startTime, duration) {
                    const osc = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const gain = ctx.createGain();
                    const lfo = ctx.createOscillator();
                    const lfoGain = ctx.createGain();

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, startTime);

                    lfo.frequency.setValueAtTime(6, startTime);
                    lfoGain.gain.setValueAtTime(8, startTime);
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(1400, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.15);
                    gain.gain.setValueAtTime(0.2, startTime + duration - 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    lfo.start(startTime);
                    osc.stop(startTime + duration);
                    lfo.stop(startTime + duration);

                    activeNodes.push(osc, filter, gain, lfo, lfoGain);
                }
                playViolinNote(440.00, now, 0.5); // A4
                playViolinNote(493.88, now + 0.55, 0.5); // B4
                playViolinNote(523.25, now + 1.1, 1.0); // C5
                break;
            }
            case 'xilofono': {
                function playXyloNote(freq, startTime) {
                    const osc1 = ctx.createOscillator();
                    const osc2 = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(freq, startTime);

                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(freq * 3, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.002);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

                    osc1.connect(gain);
                    const overtoneGain = ctx.createGain();
                    overtoneGain.gain.setValueAtTime(0.08, startTime);
                    osc2.connect(overtoneGain);
                    overtoneGain.connect(gain);

                    gain.connect(masterGain);

                    osc1.start(startTime);
                    osc2.start(startTime);
                    osc1.stop(startTime + 0.25);
                    osc2.stop(startTime + 0.25);

                    activeNodes.push(osc1, osc2, gain, overtoneGain);
                }
                playXyloNote(523.25, now);
                playXyloNote(587.33, now + 0.12);
                playXyloNote(659.25, now + 0.24);
                playXyloNote(783.99, now + 0.36);
                playXyloNote(880.00, now + 0.48);
                break;
            }
            case 'sassofono': {
                function playSaxNote(freq, startTime, duration) {
                    const osc = ctx.createOscillator();
                    const filterBP = ctx.createBiquadFilter();
                    const filterLP = ctx.createBiquadFilter();
                    const gain = ctx.createGain();
                    const lfo = ctx.createOscillator();
                    const lfoGain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, startTime);

                    lfo.frequency.setValueAtTime(5.5, startTime);
                    lfoGain.gain.setValueAtTime(6, startTime);
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);

                    filterBP.type = 'bandpass';
                    filterBP.frequency.setValueAtTime(800, startTime);
                    filterBP.Q.setValueAtTime(1.5, startTime);

                    filterLP.type = 'lowpass';
                    filterLP.frequency.setValueAtTime(1500, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.08);
                    gain.gain.setValueAtTime(0.2, startTime + duration - 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc.connect(filterBP);
                    filterBP.connect(filterLP);
                    filterLP.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    lfo.start(startTime);
                    osc.stop(startTime + duration);
                    lfo.stop(startTime + duration);

                    activeNodes.push(osc, filterBP, filterLP, gain, lfo, lfoGain);
                }
                playSaxNote(261.63, now, 0.3);
                playSaxNote(329.63, now + 0.35, 0.3);
                playSaxNote(392.00, now + 0.7, 0.3);
                playSaxNote(440.00, now + 1.05, 0.6);
                break;
            }
            case 'arpa': {
                function playHarpNote(freq, startTime) {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.25, startTime + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    osc.stop(startTime + 2.0);

                    activeNodes.push(osc, gain);
                }
                const harpNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51];
                harpNotes.forEach((f, idx) => {
                    playHarpNote(f, now + idx * 0.08);
                });
                break;
            }
            case 'organo': {
                function playOrganNote(freq, startTime, duration) {
                    const harmonics = [1, 2, 3, 4, 8];
                    const gains = [0.15, 0.1, 0.08, 0.05, 0.02];
                    
                    harmonics.forEach((h, i) => {
                        const osc = ctx.createOscillator();
                        const gainNode = ctx.createGain();
                        
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq * h, startTime);
                        
                        gainNode.gain.setValueAtTime(0, startTime);
                        gainNode.gain.linearRampToValueAtTime(gains[i], startTime + 0.1);
                        gainNode.gain.setValueAtTime(gains[i], startTime + duration - 0.1);
                        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                        
                        osc.connect(gainNode);
                        gainNode.connect(masterGain);
                        
                        osc.start(startTime);
                        osc.stop(startTime + duration);
                        
                        activeNodes.push(osc, gainNode);
                    });
                }
                playOrganNote(261.63, now, 1.8); // C4
                playOrganNote(329.63, now, 1.8); // E4
                playOrganNote(392.00, now, 1.8); // G4
                break;
            }
            case 'clarinetto': {
                function playClarinetNote(freq, startTime, duration) {
                    const osc = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const gain = ctx.createGain();

                    osc.type = 'square';
                    osc.frequency.setValueAtTime(freq, startTime);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(800, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.05);
                    gain.gain.setValueAtTime(0.18, startTime + duration - 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    osc.stop(startTime + duration);

                    activeNodes.push(osc, filter, gain);
                }
                playClarinetNote(261.63, now, 0.4);
                playClarinetNote(293.66, now + 0.45, 0.4);
                playClarinetNote(329.63, now + 0.9, 0.8);
                break;
            }
            case 'fisarmonica': {
                function playAccordionNote(freq, startTime, duration) {
                    const detunes = [-10, 10];
                    detunes.forEach(det => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();

                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(freq, startTime);
                        osc.detune.setValueAtTime(det, startTime);

                        gain.gain.setValueAtTime(0, startTime);
                        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.1);
                        gain.gain.setValueAtTime(0.12, startTime + duration - 0.1);
                        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                        osc.connect(gain);
                        gain.connect(masterGain);

                        osc.start(startTime);
                        osc.stop(startTime + duration);

                        activeNodes.push(osc, gain);
                    });
                }
                playAccordionNote(261.63, now, 1.8);
                playAccordionNote(329.63, now, 1.8);
                playAccordionNote(392.00, now, 1.8);
                break;
            }
            case 'campana': {
                function playBell(freq, startTime) {
                    const inharmonics = [1, 1.21, 1.47, 1.95, 2.54];
                    const gains = [0.2, 0.15, 0.1, 0.08, 0.05];
                    const decays = [3.0, 2.2, 1.6, 1.2, 0.8];

                    inharmonics.forEach((ratio, i) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();

                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq * ratio, startTime);

                        gain.gain.setValueAtTime(0, startTime);
                        gain.gain.linearRampToValueAtTime(gains[i], startTime + 0.005);
                        gain.gain.exponentialRampToValueAtTime(0.001, startTime + decays[i]);

                        osc.connect(gain);
                        gain.connect(masterGain);

                        osc.start(startTime);
                        osc.stop(startTime + decays[i]);

                        activeNodes.push(osc, gain);
                    });
                }
                playBell(261.63, now);
                break;
            }
            case 'sintetizzatore': {
                function playSynthNote(freq, startTime, duration) {
                    const osc1 = ctx.createOscillator();
                    const osc2 = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const gain = ctx.createGain();

                    osc1.type = 'sawtooth';
                    osc1.frequency.setValueAtTime(freq, startTime);
                    osc1.detune.setValueAtTime(-12, startTime);

                    osc2.type = 'sawtooth';
                    osc2.frequency.setValueAtTime(freq, startTime);
                    osc2.detune.setValueAtTime(12, startTime);

                    filter.type = 'lowpass';
                    filter.Q.setValueAtTime(6, startTime);
                    filter.frequency.setValueAtTime(100, startTime);
                    filter.frequency.exponentialRampToValueAtTime(2500, startTime + 0.15);
                    filter.frequency.exponentialRampToValueAtTime(400, startTime + duration);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
                    gain.gain.setValueAtTime(0.18, startTime + duration - 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc1.connect(filter);
                    osc2.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    osc1.start(startTime);
                    osc2.start(startTime);
                    osc1.stop(startTime + duration);
                    osc2.stop(startTime + duration);

                    activeNodes.push(osc1, osc2, filter, gain);
                }
                playSynthNote(130.81, now, 1.6);
                break;
            }
            case 'ukulele': {
                function playUkeNote(freq, startTime) {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.35, startTime + 0.002);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    osc.stop(startTime + 1.2);

                    activeNodes.push(osc, gain);
                }
                const ukeNotes = [392.00, 261.63, 329.63, 440.00];
                ukeNotes.forEach((f, idx) => {
                    playUkeNote(f, now + idx * 0.04);
                });
                break;
            }
            case 'mandolino': {
                function playMandolinPluck(freq, startTime) {
                    const osc = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const gain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, startTime);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(3000, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.002);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    osc.stop(startTime + 0.3);

                    activeNodes.push(osc, filter, gain);
                }
                const tremoloTimes = [0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.48, 0.56];
                tremoloTimes.forEach((t) => {
                    playMandolinPluck(440.00, now + t);
                });
                break;
            }
            case 'triangolo': {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(2800, now);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.2, now + 0.002);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

                const noise = ctx.createBufferSource();
                const noiseBuf = getNoiseBuffer();
                if (noiseBuf) {
                    noise.buffer = noiseBuf;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.setValueAtTime(9000, now);
                    const noiseGain = ctx.createGain();
                    noiseGain.gain.setValueAtTime(0, now);
                    noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.002);
                    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

                    noise.connect(filter);
                    filter.connect(noiseGain);
                    noiseGain.connect(masterGain);
                    
                    noise.start(now);
                    noise.stop(now + 0.1);
                    activeNodes.push(noise, filter, noiseGain);
                }

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(now);
                osc.stop(now + 1.2);

                activeNodes.push(osc, gain);
                break;
            }
            case 'maracas': {
                function playShake(startTime) {
                    const noiseBuf = getNoiseBuffer();
                    if (!noiseBuf) return;
                    const noise = ctx.createBufferSource();
                    noise.buffer = noiseBuf;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(3500, startTime);
                    filter.Q.setValueAtTime(3, startTime);

                    const gain = ctx.createGain();
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    noise.start(startTime);
                    noise.stop(startTime + 0.15);

                    activeNodes.push(noise, filter, gain);
                }
                playShake(now);
                playShake(now + 0.22);
                break;
            }
            case 'banjo': {
                function playBanjoNote(freq, startTime) {
                    const osc = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const gain = ctx.createGain();

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, startTime);

                    filter.type = 'highpass';
                    filter.frequency.setValueAtTime(400, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.35, startTime + 0.002);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    osc.stop(startTime + 0.9);

                    activeNodes.push(osc, filter, gain);
                }
                const banjoNotes = [196.00, 293.66, 392.00, 493.88];
                banjoNotes.forEach((f, idx) => {
                    playBanjoNote(f, now + idx * 0.05);
                });
                break;
            }
            case 'violoncello': {
                function playCelloNote(freq, startTime, duration) {
                    const osc = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const gain = ctx.createGain();
                    const lfo = ctx.createOscillator();
                    const lfoGain = ctx.createGain();

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, startTime);

                    lfo.frequency.setValueAtTime(4.5, startTime);
                    lfoGain.gain.setValueAtTime(4, startTime);
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(500, startTime);

                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.2);
                    gain.gain.setValueAtTime(0.3, startTime + duration - 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    osc.start(startTime);
                    lfo.start(startTime);
                    osc.stop(startTime + duration);
                    lfo.stop(startTime + duration);

                    activeNodes.push(osc, filter, gain, lfo, lfoGain);
                }
                playCelloNote(65.41, now, 2.0); // C2
                playCelloNote(98.00, now + 0.4, 1.6); // G2
                break;
            }
            default:
                break;
        }
    }

    play();

    if (loop) {
        loopInterval = setInterval(() => {
            play();
        }, 3000); // repeat every 3 seconds
    }

    return {
        stop: () => {
            if (loopInterval) {
                clearInterval(loopInterval);
                loopInterval = null;
            }
            try {
                masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
                masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            } catch (e) {}

            setTimeout(() => {
                activeNodes.forEach(node => {
                    try { node.stop(); } catch (e) {}
                    try { node.disconnect(); } catch (e) {}
                });
                try { masterGain.disconnect(); } catch (e) {}
            }, 180);
        },
        disconnect: () => {
            if (loopInterval) {
                clearInterval(loopInterval);
                loopInterval = null;
            }
            try { masterGain.disconnect(); } catch (e) {}
        }
    };
}
