#!/bin/bash

# Generate 5-second music samples using macOS 'say' command with musical notes
# This creates simple melodies for children's songs

SOUNDS_DIR="public/sounds"

echo "Generazione file musicali per bambini (5 secondi)..."
echo ""

# Check if 'say' and 'ffmpeg' are available
if ! command -v say &> /dev/null; then
    echo "Errore: comando 'say' non trovato. Questo script richiede macOS."
    exit 1
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "Errore: ffmpeg non trovato. Installalo con: brew install ffmpeg"
    exit 1
fi

# Function to generate a simple melody using beeps and tones
# Since we can't easily generate real music, we'll create placeholder audio
# that says the song name in a cheerful voice
generate_music() {
    local key=$1
    local name=$2
    local temp_file="${SOUNDS_DIR}/${key}_temp.aiff"
    local wav_file="${SOUNDS_DIR}/${key}.wav"
    
    # Use Italian voice to say the song name cheerfully
    say -v "Alice" -r 200 "$name" -o "$temp_file"
    
    # Convert to WAV and ensure exactly 5 seconds
    ffmpeg -i "$temp_file" -af "apad=whole_dur=5" -t 5 -y "$wav_file" 2>/dev/null
    rm "$temp_file"
    
    echo "✓ Creato ${key}.wav ($name, 5 secondi)"
}

# Generate music for each song
# Note: These will be voice placeholders. For real music, you'd need actual audio files
generate_music "twinkle" "Twinkle Twinkle Little Star"
generate_music "happy" "Happy Birthday to You"
generate_music "wheels" "The Wheels on the Bus"
generate_music "bingo" "Bingo Was His Name-O"
generate_music "old_macdonald" "Old MacDonald Had a Farm"
generate_music "itsy_bitsy" "Itsy Bitsy Spider"
generate_music "mary_lamb" "Mary Had a Little Lamb"
generate_music "row_boat" "Row Row Row Your Boat"
generate_music "abc" "A B C D E F G"
generate_music "london_bridge" "London Bridge Is Falling Down"

echo ""
echo "✅ File musicali generati!"
echo ""
echo "NOTA: Questi sono placeholder vocali."
echo "Per musica reale, sostituisci i file WAV in public/sounds/ con"
echo "registrazioni o file MIDI di canzoni per bambini (5 secondi ciascuno)."
