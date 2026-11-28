// Motore della modalità "Calma": pad lenti, campanelli radi e riverbero
// generato al volo. Nessun file audio e nessun AudioContext proprio: usa
// quello condiviso di audioUtils, come musicEngine.

import {
    ensureSharedAudioContext,
    getSharedAudioContext,
} from './audioUtils.js';

// Progressione maggiore C - Am - F - G: dolce, senza tensioni.
const CHORDS = [
    [130.81, 196.0, 261.63, 329.63], // C
    [110.0, 164.81, 220.0, 261.63], // Am
    [174.61, 261.63, 349.23, 440.0], // F
    [196.0, 293.66, 392.0, 493.88], // G
];

// Pentatonica di Do acuta per i campanelli.
const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

const CHORD_SECONDS = 12;
const CHORD_ATTACK = 2.6;
const CHORD_HOLD = 9;
const CHORD_RELEASE = 15.5;
const MASTER_LEVEL = 0.5;
const LOOKAHEAD_MS = 250;
const SCHEDULE_AHEAD = 0.6;

export function createCalmEngine() {
    let ctx = null;
    let graph = null;
    let playing = false;
    let timer = null;
    let chordIndex = 0;
    let nextChordTime = 0;
    let nextBellTime = 0;

    function makeImpulse(context) {
        const seconds = 2.6;
        const length = Math.floor(context.sampleRate * seconds);
        const impulse = context.createBuffer(2, length, context.sampleRate);
        for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2.6);
                data[i] = (Math.random() * 2 - 1) * decay;
            }
        }
        return impulse;
    }

    function buildGraph(context) {
        const master = context.createGain();
        master.gain.value = 0.0001;

        const tone = context.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 2400;

        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.01;
        compressor.release.value = 0.4;

        const dry = context.createGain();
        dry.gain.value = 0.75;

        const reverb = context.createConvolver();
        reverb.buffer = makeImpulse(context);
        const wet = context.createGain();
        wet.gain.value = 0.55;

        dry.connect(master);
        reverb.connect(wet);
        wet.connect(master);
        master.connect(tone);
        tone.connect(compressor);
        compressor.connect(context.destination);

        graph = { context, master, tone, compressor, dry, reverb, wet };
    }

    function disconnectGraph() {
        if (!graph) return;
        try {
            graph.dry.disconnect();
            graph.reverb.disconnect();
            graph.wet.disconnect();
            graph.master.disconnect();
            graph.tone.disconnect();
            graph.compressor.disconnect();
        } catch (error) {
            /* contesto già chiuso */
        }
        graph = null;
    }

    function rampMaster(target, seconds) {
        if (!graph || !ctx) return;
        const now = ctx.currentTime;
        const gain = graph.master.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
        gain.linearRampToValueAtTime(Math.max(target, 0.0001), now + seconds);
    }

    async function ensureAudio() {
        const context = await ensureSharedAudioContext();
        if (!context) return null;
        if (graph && graph.context !== context) {
            disconnectGraph();
        }
        ctx = context;
        if (!graph) buildGraph(context);
        return context;
    }

    function playChord(when) {
        const chord = CHORDS[chordIndex % CHORDS.length];
        chordIndex += 1;

        for (const frequency of chord) {
            for (const voice of [
                { type: 'sine', level: 0.1, detune: 0 },
                { type: 'triangle', level: 0.045, detune: 7 },
            ]) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = voice.type;
                osc.frequency.setValueAtTime(frequency, when);
                osc.detune.setValueAtTime(voice.detune, when);

                gain.gain.setValueAtTime(0.0001, when);
                gain.gain.linearRampToValueAtTime(voice.level, when + CHORD_ATTACK);
                gain.gain.setValueAtTime(voice.level, when + CHORD_HOLD);
                gain.gain.linearRampToValueAtTime(0.0001, when + CHORD_RELEASE);

                osc.connect(gain);
                gain.connect(graph.dry);
                gain.connect(graph.reverb);

                osc.start(when);
                osc.stop(when + CHORD_RELEASE + 0.1);
            }
        }
    }

    function playBell(when) {
        const frequency = BELLS[Math.floor(Math.random() * BELLS.length)];
        const pan = ctx.createStereoPanner();
        pan.pan.value = (Math.random() * 2 - 1) * 0.6;

        for (const partial of [
            { ratio: 1, level: 0.13, decay: 2.8 },
            { ratio: 2.01, level: 0.05, decay: 1.7 },
            { ratio: 3.0, level: 0.02, decay: 1.1 },
        ]) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency * partial.ratio, when);
            gain.gain.setValueAtTime(0.0001, when);
            gain.gain.linearRampToValueAtTime(partial.level, when + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, when + partial.decay);

            osc.connect(gain);
            gain.connect(pan);
            osc.start(when);
            osc.stop(when + partial.decay + 0.1);
        }

        pan.connect(graph.dry);
        pan.connect(graph.reverb);
    }

    function tick() {
        if (!playing || !ctx) return;
        const context = getSharedAudioContext();
        if (!context) return;

        // iOS può sostituire il contesto: ricostruisci il grafo e riparti.
        if (context !== ctx) {
            ctx = context;
            disconnectGraph();
            buildGraph(context);
            nextChordTime = ctx.currentTime + 0.15;
            nextBellTime = ctx.currentTime + 4;
            rampMaster(MASTER_LEVEL, 2.5);
        }

        if (context.state !== 'running') return;

        const horizon = context.currentTime + SCHEDULE_AHEAD;
        while (nextChordTime < horizon) {
            playChord(nextChordTime);
            nextChordTime += CHORD_SECONDS;
        }
        while (nextBellTime < horizon) {
            playBell(nextBellTime);
            nextBellTime += 3.5 + Math.random() * 5;
        }
    }

    function startScheduler() {
        if (timer) clearInterval(timer);
        timer = setInterval(tick, LOOKAHEAD_MS);
    }

    async function start() {
        if (playing) return true;
        const context = await ensureAudio();
        if (!context || context.state !== 'running') return false;

        playing = true;
        chordIndex = 0;
        nextChordTime = context.currentTime + 0.2;
        nextBellTime = context.currentTime + 4;
        rampMaster(MASTER_LEVEL, 3);
        startScheduler();
        return true;
    }

    function pause() {
        if (!playing) return;
        playing = false;
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        rampMaster(0.0001, 1.2);
    }

    async function resume() {
        if (playing) return true;
        const context = await ensureAudio();
        if (!context || context.state !== 'running') return false;

        playing = true;
        nextChordTime = context.currentTime + 0.3;
        nextBellTime = context.currentTime + 4;
        rampMaster(MASTER_LEVEL, 2.5);
        startScheduler();
        return true;
    }

    function stop() {
        playing = false;
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        rampMaster(0.0001, 3.5);
    }

    // Un tocco aggiunge un campanello e, se il prossimo accordo è lontano, lo
    // anticipa: il gesto ha un effetto immediato senza rompere il ritmo lento.
    function tap() {
        if (!playing || !ctx || ctx.state !== 'running') return false;
        playBell(ctx.currentTime + 0.01);
        if (nextChordTime - ctx.currentTime > 3) {
            nextChordTime = ctx.currentTime + 0.8;
        }
        return true;
    }

    function dispose() {
        stop();
        disconnectGraph();
        ctx = null;
    }

    return {
        start,
        pause,
        resume,
        stop,
        tap,
        dispose,
        isPlaying: () => playing,
    };
}
