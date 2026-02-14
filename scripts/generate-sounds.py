#!/usr/bin/env python3
"""
Generate 5-second audio files for each animal sound using synthesized tones.
This creates simple placeholder sounds that can be replaced with real animal sounds later.
"""

import os
import numpy as np
from scipy.io import wavfile
import subprocess

# Animal list
animals = [
    'lion', 'elephant', 'dog', 'cat', 'cow', 'horse', 'sheep', 'pig', 'chicken', 'duck',
    'goose', 'turkey', 'rooster', 'frog', 'owl', 'crow', 'parrot', 'peacock', 'monkey', 'bear',
    'wolf', 'fox', 'deer', 'goat', 'donkey', 'zebra', 'giraffe', 'hippo', 'rhino', 'tiger',
    'leopard', 'cheetah', 'panda', 'koala', 'kangaroo', 'penguin', 'seal', 'dolphin', 'whale', 'snake',
    'crocodile', 'bee', 'cricket', 'mosquito', 'seagull', 'eagle', 'hawk', 'coyote', 'hyena', 'gorilla'
]

# Sound characteristics for different animals (frequency, pattern)
sound_profiles = {
    'lion': (150, 'roar'),
    'elephant': (100, 'trumpet'),
    'dog': (400, 'bark'),
    'cat': (500, 'meow'),
    'cow': (200, 'moo'),
    'horse': (300, 'neigh'),
    'sheep': (350, 'baa'),
    'pig': (250, 'oink'),
    'chicken': (600, 'cluck'),
    'duck': (450, 'quack'),
    'goose': (400, 'honk'),
    'turkey': (300, 'gobble'),
    'rooster': (700, 'crow'),
    'frog': (500, 'ribbit'),
    'owl': (350, 'hoot'),
    'crow': (550, 'caw'),
    'parrot': (800, 'squawk'),
    'peacock': (600, 'call'),
    'monkey': (700, 'chatter'),
    'bear': (120, 'growl'),
    'wolf': (200, 'howl'),
    'fox': (450, 'yip'),
    'deer': (300, 'bleat'),
    'goat': (400, 'bleat'),
    'donkey': (250, 'bray'),
    'zebra': (350, 'whinny'),
    'giraffe': (200, 'hum'),
    'hippo': (150, 'grunt'),
    'rhino': (130, 'snort'),
    'tiger': (140, 'roar'),
    'leopard': (160, 'growl'),
    'cheetah': (180, 'chirp'),
    'panda': (250, 'bleat'),
    'koala': (300, 'grunt'),
    'kangaroo': (350, 'cluck'),
    'penguin': (500, 'trumpet'),
    'seal': (400, 'bark'),
    'dolphin': (1000, 'click'),
    'whale': (80, 'song'),
    'snake': (600, 'hiss'),
    'crocodile': (150, 'growl'),
    'bee': (1200, 'buzz'),
    'cricket': (2000, 'chirp'),
    'mosquito': (1500, 'buzz'),
    'seagull': (800, 'cry'),
    'eagle': (700, 'screech'),
    'hawk': (750, 'screech'),
    'coyote': (250, 'howl'),
    'hyena': (400, 'laugh'),
    'gorilla': (180, 'grunt')
}

def generate_tone(frequency, duration, sample_rate=44100, pattern='simple'):
    """Generate a tone with the specified characteristics."""
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    if pattern == 'roar':
        # Low rumbling with variation
        signal = np.sin(2 * np.pi * frequency * t)
        signal += 0.5 * np.sin(2 * np.pi * (frequency * 1.5) * t)
        signal *= np.exp(-t * 0.3)  # Decay
    elif pattern == 'bark':
        # Short bursts
        signal = np.zeros_like(t)
        for i in range(3):
            start = int(i * sample_rate * 1.5)
            end = start + int(sample_rate * 0.3)
            if end < len(t):
                signal[start:end] = np.sin(2 * np.pi * frequency * t[start:end])
    elif pattern == 'meow':
        # Rising then falling
        freq_mod = frequency * (1 + 0.3 * np.sin(2 * np.pi * 2 * t))
        signal = np.sin(2 * np.pi * freq_mod * t)
        signal *= np.exp(-t * 0.5)
    elif pattern == 'buzz':
        # Continuous high frequency
        signal = np.sin(2 * np.pi * frequency * t)
        signal += 0.3 * np.random.randn(len(t))  # Add noise
    elif pattern == 'chirp':
        # Frequency sweep
        freq_sweep = frequency + (frequency * 0.5) * t / duration
        signal = np.sin(2 * np.pi * freq_sweep * t)
    elif pattern == 'howl':
        # Long sustained with vibrato
        vibrato = frequency * (1 + 0.05 * np.sin(2 * np.pi * 5 * t))
        signal = np.sin(2 * np.pi * vibrato * t)
    else:
        # Default simple tone with envelope
        signal = np.sin(2 * np.pi * frequency * t)
        signal += 0.3 * np.sin(2 * np.pi * (frequency * 2) * t)
    
    # Apply envelope
    envelope = np.ones_like(t)
    fade_samples = int(sample_rate * 0.1)
    envelope[:fade_samples] = np.linspace(0, 1, fade_samples)
    envelope[-fade_samples:] = np.linspace(1, 0, fade_samples)
    signal *= envelope
    
    # Normalize
    signal = signal / np.max(np.abs(signal))
    signal = (signal * 32767).astype(np.int16)
    
    return signal

def main():
    sounds_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'sounds')
    os.makedirs(sounds_dir, exist_ok=True)
    
    print("Generating animal sounds...")
    
    for animal in animals:
        frequency, pattern = sound_profiles.get(animal, (440, 'simple'))
        
        # Generate 5-second audio
        audio_data = generate_tone(frequency, 5.0, pattern=pattern)
        
        # Save as WAV first
        wav_path = os.path.join(sounds_dir, f'{animal}.wav')
        wavfile.write(wav_path, 44100, audio_data)
        
        # Convert to MP3 using ffmpeg
        mp3_path = os.path.join(sounds_dir, f'{animal}.mp3')
        try:
            subprocess.run([
                'ffmpeg', '-i', wav_path, '-codec:a', 'libmp3lame',
                '-qscale:a', '2', '-y', mp3_path
            ], check=True, capture_output=True)
            os.remove(wav_path)  # Remove WAV file
            print(f"Created {animal}.mp3")
        except (subprocess.CalledProcessError, FileNotFoundError):
            # If ffmpeg is not available, keep WAV file
            print(f"Created {animal}.wav (ffmpeg not available for MP3 conversion)")
    
    print("\nAll animal sounds generated successfully!")

if __name__ == '__main__':
    main()
