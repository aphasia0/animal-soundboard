
let currentAudio = null;

/**
 * Plays an audio file with looping enabled.
 * 
 * @param {string} src - Path to the audio file
 * @returns {HTMLAudioElement} The audio element being played
 */
export async function playAudio(src) {
    // If there is currently playing audio, pause it
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    const audio = new Audio(src);
    audio.loop = true;
    currentAudio = audio;

    try {
        await audio.play();
    } catch (err) {
        // AbortError is expected if we pause/stop quickly (which happens on transitions or quick taps)
        if (err.name !== 'AbortError') {
            console.warn('Audio play failed:', err);
        }
    }

    return audio;
}

/**
 * Stops the currently playing audio.
 */
export function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}
