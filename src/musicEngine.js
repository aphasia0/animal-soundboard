// Motore musicale della modalità "La Banda".
// Riusa l'AudioContext condiviso di audioUtils: non ne crea mai un secondo.
// Ogni cella della griglia è una nota: la colonna decide l'altezza, la riga
// decide il timbro. La griglia garantisce il tempo, il bambino non deve farlo.

import {
    ensureSharedAudioContext,
    getSharedAudioContext,
} from './audioUtils.js';

export const STEPS = 6;

export const TRACKS = [
    { id: 'drums', name: 'Batteria', emoji: '🥁', color: '#f59e0b' },
    { id: 'bass', name: 'Basso', emoji: '🎸', color: '#3b82f6' },
    { id: 'melody', name: 'Melodia', emoji: '🎹', color: '#a855f7' },
    { id: 'bells', name: 'Campanelli', emoji: '✨', color: '#14b8a6' },
];

export const TEMPOS = [
    { id: 'lento', label: 'Lento', bpm: 80 },
    { id: 'normale', label: 'Normale', bpm: 100 },
    { id: 'veloce', label: 'Veloce', bpm: 130 },
];

const BPM = Object.fromEntries(TEMPOS.map((tempo) => [tempo.id, tempo.bpm]));

// Do maggiore pentatonico: qualunque combinazione di colonne resta consonante.
// Il basso sta un'ottava sopra il registro reale: sugli altoparlanti di tablet
// e telefoni le frequenze sotto i 100 Hz sarebbero quasi inudibili.
const BASS_NOTES = [130.81, 146.83, 164.81, 196.0, 220.0, 261.63];
const MELODY_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const BELL_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

// Una colonna, un colpo di batteria: accendendole tutte nasce un ritmo completo.
const DRUM_VOICES = ['kick', 'hihat', 'snare', 'kick', 'hihat', 'snare'];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

export function emptyGrid() {
    return Object.fromEntries(TRACKS.map((track) => [track.id, Array(STEPS).fill(false)]));
}

export function createBandEngine({ grid, tempo = 'normale', muted } = {}) {
    let currentGrid = grid || emptyGrid();
    let currentTempo = BPM[tempo] ? tempo : 'normale';
    let currentMuted = muted || Object.fromEntries(TRACKS.map((track) => [track.id, false]));

    let ctx = null;
    let graph = null;
    let playing = false;
    let timer = null;
    let nextStepIndex = 0;
    let nextStepTime = 0;
    let onChange = null;

    function stepDuration() {
        // Un passo = un battito: 6 passi a 100 BPM sono un loop di 3,6 secondi.
        return 60 / BPM[currentTempo];
    }

    function notify() {
        if (typeof onChange === 'function') onChange(playing);
    }

    function makeNoise(context) {
        const buffer = context.createBuffer(
            1,
            Math.floor(context.sampleRate * 0.5),
            context.sampleRate,
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
    }

    function buildGraph(context) {
        const master = context.createGain();
        master.gain.value = 0.9;

        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 12;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;

        master.connect(compressor);
        compressor.connect(context.destination);

        const tracks = {};
        for (const track of TRACKS) {
            const gain = context.createGain();
            gain.gain.value = currentMuted[track.id] ? 0 : 1;
            gain.connect(master);
            tracks[track.id] = gain;
        }

        graph = { context, master, compressor, tracks, noise: makeNoise(context) };
    }

    // Riusa il contesto già attivo; lo ricrea solo se iOS lo ha sostituito.
    async function ensureAudio() {
        const context = await ensureSharedAudioContext();
        if (!context) return null;
        if (graph && graph.context !== context) {
            disconnectGraph();
            ctx = null;
        }
        ctx = context;
        if (!graph) buildGraph(context);
        return context;
    }

    function disconnectGraph() {
        if (!graph) return;
        try {
            graph.master.disconnect();
            graph.compressor.disconnect();
            for (const track of Object.values(graph.tracks)) track.disconnect();
        } catch (error) {
            /* il contesto è già chiuso */
        }
        graph = null;
    }

    function kick(when, level = 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, when);
        osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.linearRampToValueAtTime(0.9 * level, when + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.26);
        osc.connect(gain);
        gain.connect(graph.tracks.drums);
        osc.start(when);
        osc.stop(when + 0.28);
    }

    function snare(when) {
        const noise = ctx.createBufferSource();
        noise.buffer = graph.noise;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 0.8;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.linearRampToValueAtTime(0.42, when + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.19);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(graph.tracks.drums);
        noise.start(when);
        noise.stop(when + 0.2);

        const body = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        body.type = 'triangle';
        body.frequency.setValueAtTime(180, when);
        bodyGain.gain.setValueAtTime(0.0001, when);
        bodyGain.gain.linearRampToValueAtTime(0.15, when + 0.002);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
        body.connect(bodyGain);
        bodyGain.connect(graph.tracks.drums);
        body.start(when);
        body.stop(when + 0.13);
    }

    function hihat(when, level = 1) {
        const noise = ctx.createBufferSource();
        noise.buffer = graph.noise;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.linearRampToValueAtTime(0.16 * level, when + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(graph.tracks.drums);
        noise.start(when);
        noise.stop(when + 0.07);
    }

    function playDrum(voice, when) {
        if (voice === 'kick') kick(when);
        else if (voice === 'snare') snare(when);
        else hihat(when);
    }

    function playBass(when, frequency) {
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        const subGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, when);

        sub.type = 'sine';
        sub.frequency.setValueAtTime(frequency, when);
        subGain.gain.setValueAtTime(0.35, when);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, when);
        filter.frequency.exponentialRampToValueAtTime(280, when + 0.32);

        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.linearRampToValueAtTime(0.42, when + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.42);

        osc.connect(filter);
        sub.connect(subGain);
        subGain.connect(filter);
        filter.connect(gain);
        gain.connect(graph.tracks.bass);

        osc.start(when);
        sub.start(when);
        osc.stop(when + 0.44);
        sub.stop(when + 0.44);
    }

    function playMelody(when, frequency) {
        const noteGain = ctx.createGain();
        const voices = [
            { type: 'sine', ratio: 1, level: 0.65 },
            { type: 'triangle', ratio: 1, level: 0.5 },
            { type: 'sine', ratio: 2, level: 0.18 },
        ];

        for (const voice of voices) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = voice.type;
            osc.frequency.setValueAtTime(frequency * voice.ratio, when);
            gain.gain.setValueAtTime(voice.level, when);
            osc.connect(gain);
            gain.connect(noteGain);
            osc.start(when);
            osc.stop(when + 0.95);
        }

        noteGain.gain.setValueAtTime(0.0001, when);
        noteGain.gain.linearRampToValueAtTime(0.3, when + 0.006);
        noteGain.gain.exponentialRampToValueAtTime(0.001, when + 0.95);
        noteGain.connect(graph.tracks.melody);
    }

    function playBell(when, frequency) {
        const partials = [
            { ratio: 1, level: 0.2, decay: 1.3 },
            { ratio: 2.01, level: 0.08, decay: 0.85 },
            { ratio: 3.0, level: 0.035, decay: 0.55 },
        ];

        for (const partial of partials) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency * partial.ratio, when);
            gain.gain.setValueAtTime(0.0001, when);
            gain.gain.linearRampToValueAtTime(partial.level, when + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.001, when + partial.decay);
            osc.connect(gain);
            gain.connect(graph.tracks.bells);
            osc.start(when);
            osc.stop(when + partial.decay + 0.05);
        }
    }

    function isEmpty() {
        return TRACKS.every((track) => currentGrid[track.id].every((cell) => !cell));
    }

    function scheduleStep(index, when) {
        if (!graph) return;
        for (const track of TRACKS) {
            if (!currentGrid[track.id][index]) continue;
            if (track.id === 'drums') playDrum(DRUM_VOICES[index], when);
            else if (track.id === 'bass') playBass(when, BASS_NOTES[index]);
            else if (track.id === 'melody') playMelody(when, MELODY_NOTES[index]);
            else playBell(when, BELL_NOTES[index]);
        }
        // Con la griglia vuota il pulsante Suona resta muto: un tick leggero
        // fa capire che il loop sta girando.
        if (isEmpty()) hihat(when, 0.22);
    }

    function tick() {
        if (!playing) return;
        const context = getSharedAudioContext();
        if (!context) return;

        if (context !== ctx) {
            ctx = context;
            disconnectGraph();
            buildGraph(context);
            nextStepTime = context.currentTime + 0.05;
        }
        if (context.state !== 'running') return;

        const horizon = context.currentTime + SCHEDULE_AHEAD;
        let guard = 0;
        while (nextStepTime < horizon && guard < 64) {
            scheduleStep(nextStepIndex, nextStepTime);
            nextStepTime += stepDuration();
            nextStepIndex = (nextStepIndex + 1) % STEPS;
            guard++;
        }
    }

    async function start() {
        if (playing) return true;
        const context = await ensureAudio();
        if (!context) return false;
        // Se iOS non ha ancora sbloccato l'audio, non fingiamo che stia suonando.
        if (context.state !== 'running') return false;

        playing = true;
        nextStepIndex = 0;
        nextStepTime = context.currentTime + 0.1;
        timer = setInterval(tick, LOOKAHEAD_MS);
        notify();
        return true;
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        playing = false;
        nextStepIndex = 0;
        notify();
    }

    async function toggle() {
        if (playing) {
            stop();
            return false;
        }
        return start();
    }

    // Anteprima immediata: suona anche a loop fermo, così il tocco ha senso.
    async function playCell(trackId, step) {
        const context = await ensureAudio();
        if (!context || context.state !== 'running') return;
        const when = context.currentTime + 0.005;
        if (trackId === 'drums') playDrum(DRUM_VOICES[step], when);
        else if (trackId === 'bass') playBass(when, BASS_NOTES[step]);
        else if (trackId === 'melody') playMelody(when, MELODY_NOTES[step]);
        else playBell(when, BELL_NOTES[step]);
    }

    function setGrid(next) {
        if (next) currentGrid = next;
    }

    function setTempo(next) {
        if (BPM[next]) currentTempo = next;
    }

    function setMuted(trackId, value) {
        if (!(trackId in currentMuted)) return;
        currentMuted = { ...currentMuted, [trackId]: Boolean(value) };
        if (!graph || !ctx) return;
        const gain = graph.tracks[trackId]?.gain;
        if (!gain) return;
        const now = ctx.currentTime;
        gain.cancelScheduledValues(now);
        gain.setTargetAtTime(currentMuted[trackId] ? 0 : 1, now, 0.03);
    }

    // Playhead calcolato sui tempi reali di scheduling, non con un timer:
    // resta allineato all'audio anche dopo un cambio di velocità.
    function getPosition() {
        if (!playing || !ctx || !playingContextValid()) return null;
        const duration = stepDuration();
        const currentStepStart = nextStepTime - duration;
        const fraction = Math.min(1, Math.max(0, (ctx.currentTime - currentStepStart) / duration));
        const step = (nextStepIndex - 1 + STEPS) % STEPS;
        return { step, fraction };
    }

    function playingContextValid() {
        const context = getSharedAudioContext();
        return Boolean(context) && context === ctx;
    }

    function dispose() {
        stop();
        onChange = null;
        disconnectGraph();
        ctx = null;
    }

    return {
        start,
        stop,
        toggle,
        playCell,
        setGrid,
        setTempo,
        setMuted,
        getPosition,
        isPlaying: () => playing,
        get onStateChange() {
            return onChange;
        },
        set onStateChange(callback) {
            onChange = callback;
        },
        dispose,
    };
}
