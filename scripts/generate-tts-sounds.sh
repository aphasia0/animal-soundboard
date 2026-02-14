#!/bin/bash

# Generate animal name audio using macOS text-to-speech
# This creates clear, spoken animal names instead of trying to mimic sounds

SOUNDS_DIR="public/sounds"

# Animal names
animals=(
  "lion" "elephant" "dog" "cat" "cow" "horse" "sheep" "pig" "chicken" "duck"
  "goose" "turkey" "rooster" "frog" "owl" "crow" "parrot" "peacock" "monkey" "bear"
  "wolf" "fox" "deer" "goat" "donkey" "zebra" "giraffe" "hippo" "rhino" "tiger"
  "leopard" "cheetah" "panda" "koala" "kangaroo" "penguin" "seal" "dolphin" "whale" "snake"
  "crocodile" "bee" "cricket" "mosquito" "seagull" "eagle" "hawk" "coyote" "hyena" "gorilla"
)

echo "Generating animal name audio files using text-to-speech..."
echo ""

# Check if 'say' command is available (macOS)
if ! command -v say &> /dev/null; then
    echo "Error: 'say' command not found. This script requires macOS."
    echo "For Linux, you can use 'espeak' or 'festival'"
    echo "For Windows, you can use PowerShell's speech synthesis"
    exit 1
fi

# Generate audio for each animal
for animal in "${animals[@]}"; do
    output_file="${SOUNDS_DIR}/${animal}.aiff"
    wav_file="${SOUNDS_DIR}/${animal}.wav"
    
    # Use 'say' to generate audio (AIFF format)
    # -v Samantha uses a friendly female voice
    # -o outputs to file
    say -v Samantha "$animal" -o "$output_file"
    
    # Convert AIFF to WAV and pad/trim to exactly 5 seconds using ffmpeg
    if command -v ffmpeg &> /dev/null; then
        # Add silence to make it 5 seconds, or trim if longer
        ffmpeg -i "$output_file" -af "apad=whole_dur=5" -t 5 -y "$wav_file" 2>/dev/null
        rm "$output_file"
        echo "✓ Created ${animal}.wav (spoken name, 5 seconds)"
    else
        # If ffmpeg not available, just convert to WAV
        afconvert -f WAVE -d LEI16 "$output_file" "$wav_file"
        rm "$output_file"
        echo "✓ Created ${animal}.wav (spoken name, ~1-2 seconds - install ffmpeg to pad to 5s)"
    fi
done

echo ""
echo "✅ All animal name audio files generated!"
echo ""
echo "Note: These are spoken animal NAMES, not animal sounds."
echo "This is more educational for children learning animal names."
echo ""
echo "If you want real animal sounds instead, run:"
echo "  ./scripts/download-real-sounds.sh"
