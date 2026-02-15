#!/usr/bin/env python3
"""
Generate recognizable children's song melodies as WAV files.
Uses pure sine waves with envelope shaping for a clean, musical sound.
No external dependencies - uses only Python builtins.
"""

import wave
import struct
import math
import os

SAMPLE_RATE = 44100
SOUNDS_DIR = "public/sounds"

# Note frequencies (Hz)
NOTES = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00,
    'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
    'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00,
    'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99,
    'R': 0,  # Rest
}


def generate_tone(freq, duration, volume=0.6):
    """Generate a sine wave tone with smooth attack/release envelope."""
    n_samples = int(SAMPLE_RATE * duration)
    samples = []
    
    # Attack and release times (in samples)
    attack = int(SAMPLE_RATE * 0.02)   # 20ms attack
    release = int(SAMPLE_RATE * 0.04)  # 40ms release
    
    for i in range(n_samples):
        # Envelope
        if i < attack:
            env = i / attack
        elif i > n_samples - release:
            env = (n_samples - i) / release
        else:
            env = 1.0
        
        if freq == 0:  # Rest
            samples.append(0)
        else:
            # Mix fundamental with a softer octave for a richer sound
            val = math.sin(2 * math.pi * freq * i / SAMPLE_RATE) * 0.7
            val += math.sin(2 * math.pi * freq * 2 * i / SAMPLE_RATE) * 0.2
            val += math.sin(2 * math.pi * freq * 3 * i / SAMPLE_RATE) * 0.1
            samples.append(val * env * volume)
    
    return samples


def generate_melody(notes_sequence, filename):
    """
    Generate a WAV file from a sequence of (note, duration) tuples.
    """
    all_samples = []
    for note, duration in notes_sequence:
        freq = NOTES[note]
        all_samples.extend(generate_tone(freq, duration))
    
    # Add 0.3s silence at end
    all_samples.extend([0] * int(SAMPLE_RATE * 0.3))
    
    # Normalize
    max_val = max(abs(s) for s in all_samples) if all_samples else 1
    if max_val > 0:
        all_samples = [s / max_val * 0.9 for s in all_samples]
    
    # Write WAV
    filepath = os.path.join(SOUNDS_DIR, filename)
    with wave.open(filepath, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in all_samples:
            wf.writeframes(struct.pack('<h', int(s * 32767)))
    
    duration_s = len(all_samples) / SAMPLE_RATE
    print(f"✓ {filename} ({duration_s:.1f}s)")


# ==================== MELODIES ====================
# Each melody is a list of (note_name, duration_in_seconds)

D = 0.35   # Default note duration
H = 0.70   # Half note (long)
Q = 0.25   # Quick note
E = 0.18   # Eighth note

# 1. Twinkle Twinkle Little Star
twinkle = [
    ('C4', D), ('C4', D), ('G4', D), ('G4', D), ('A4', D), ('A4', D), ('G4', H),
    ('F4', D), ('F4', D), ('E4', D), ('E4', D), ('D4', D), ('D4', D), ('C4', H),
    ('G4', D), ('G4', D), ('F4', D), ('F4', D), ('E4', D), ('E4', D), ('D4', H),
    ('G4', D), ('G4', D), ('F4', D), ('F4', D), ('E4', D), ('E4', D), ('D4', H),
]

# 2. Happy Birthday
happy = [
    ('C4', Q), ('C4', E), ('D4', D), ('C4', D), ('F4', D), ('E4', H),
    ('C4', Q), ('C4', E), ('D4', D), ('C4', D), ('G4', D), ('F4', H),
    ('C4', Q), ('C4', E), ('C5', D), ('A4', D), ('F4', D), ('E4', D), ('D4', H),
    ('A#4', Q), ('A#4', E), ('A4', D), ('F4', D), ('G4', D), ('F4', H),
]

# 3. Wheels on the Bus
wheels = [
    ('C4', D), ('E4', D), ('G4', D), ('G4', D), ('G4', H),
    ('A4', D), ('G4', H), ('R', Q),
    ('F4', D), ('E4', D), ('D4', D), ('D4', D), ('D4', H),
    ('E4', D), ('D4', H), ('R', Q),
    ('C4', D), ('E4', D), ('G4', D), ('G4', D), ('G4', D),
    ('A4', D), ('G4', D), ('F4', D), ('E4', D), ('D4', D), ('C4', H),
]

# 4. B-I-N-G-O
bingo = [
    ('G4', D), ('G4', D), ('E4', D), ('G4', D), ('A4', D), ('A4', H),
    ('G4', D), ('G4', D), ('E4', D), ('G4', D), ('F#4', H),
    ('E4', D), ('E4', D), ('D4', D), ('E4', D), ('F#4', D), ('F#4', D),
    ('E4', D), ('E4', D), ('D4', D), ('E4', D), ('D4', H),
]

# 5. Old MacDonald Had a Farm
old_macdonald = [
    ('G4', D), ('G4', D), ('G4', D), ('D4', D), ('E4', D), ('E4', D), ('D4', H),
    ('B4', D), ('B4', D), ('A4', D), ('A4', D), ('G4', H), ('R', Q),
    ('D4', D), ('G4', D), ('G4', D), ('G4', D), ('D4', D), ('E4', D), ('E4', D), ('D4', H),
    ('B4', D), ('B4', D), ('A4', D), ('A4', D), ('G4', H),
]

# 6. Itsy Bitsy Spider
itsy_bitsy = [
    ('G4', Q), ('C4', D), ('C4', E), ('C4', D), ('D4', D), ('E4', D), ('E4', H),
    ('E4', D), ('D4', D), ('C4', D), ('D4', D), ('E4', D), ('C4', H),
    ('E4', D), ('E4', D), ('F4', D), ('G4', H),
    ('G4', D), ('F4', D), ('E4', D), ('F4', D), ('G4', D), ('E4', H),
    ('C4', D), ('C4', D), ('D4', D), ('E4', H),
    ('E4', D), ('D4', D), ('C4', D), ('D4', D), ('E4', D), ('C4', H),
]

# 7. Mary Had a Little Lamb
mary_lamb = [
    ('E4', D), ('D4', D), ('C4', D), ('D4', D), ('E4', D), ('E4', D), ('E4', H),
    ('D4', D), ('D4', D), ('D4', H), ('E4', D), ('G4', D), ('G4', H),
    ('E4', D), ('D4', D), ('C4', D), ('D4', D), ('E4', D), ('E4', D), ('E4', D), ('E4', D),
    ('D4', D), ('D4', D), ('E4', D), ('D4', D), ('C4', H),
]

# 8. Row Row Row Your Boat
row_boat = [
    ('C4', D), ('C4', D), ('C4', Q), ('D4', E), ('E4', D),
    ('E4', Q), ('D4', E), ('E4', Q), ('F4', E), ('G4', H),
    ('C5', E), ('C5', E), ('C5', E), ('G4', E), ('G4', E), ('G4', E),
    ('E4', E), ('E4', E), ('E4', E), ('C4', E), ('C4', E), ('C4', E),
    ('G4', Q), ('F4', E), ('E4', Q), ('D4', E), ('C4', H),
]

# 9. ABC Song (same melody as Twinkle)
abc = [
    ('C4', D), ('C4', D), ('G4', D), ('G4', D), ('A4', D), ('A4', D), ('G4', H),
    ('F4', D), ('F4', D), ('E4', D), ('E4', Q), ('D4', Q), ('D4', Q), ('D4', Q), ('C4', H),
    ('G4', D), ('G4', Q), ('F4', H), ('E4', D), ('E4', D), ('D4', H),
    ('G4', Q), ('G4', Q), ('G4', Q), ('F4', H), ('E4', D), ('E4', D), ('D4', H),
    ('C4', D), ('C4', D), ('G4', D), ('G4', D), ('A4', D), ('A4', D), ('G4', H),
    ('F4', D), ('F4', D), ('E4', D), ('E4', D), ('D4', D), ('D4', D), ('C4', H),
]

# 10. London Bridge Is Falling Down
london_bridge = [
    ('G4', D), ('A4', Q), ('G4', E), ('F4', D), ('E4', D), ('F4', D), ('G4', H),
    ('D4', D), ('E4', D), ('F4', H), ('E4', D), ('F4', D), ('G4', H),
    ('G4', D), ('A4', Q), ('G4', E), ('F4', D), ('E4', D), ('F4', D), ('G4', H),
    ('D4', H), ('G4', D), ('E4', D), ('C4', H),
]

# ==================== GENERATE ====================
print("=== Generating Music Melodies ===")
print("")

generate_melody(twinkle, "twinkle.wav")
generate_melody(happy, "happy.wav")
generate_melody(wheels, "wheels.wav")
generate_melody(bingo, "bingo.wav")
generate_melody(old_macdonald, "old_macdonald.wav")
generate_melody(itsy_bitsy, "itsy_bitsy.wav")
generate_melody(mary_lamb, "mary_lamb.wav")
generate_melody(row_boat, "row_boat.wav")
generate_melody(abc, "abc.wav")
generate_melody(london_bridge, "london_bridge.wav")

print("")
print("✅ All music melodies generated!")
