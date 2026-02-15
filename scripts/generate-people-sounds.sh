#!/bin/bash

# Generate Italian people names TTS audio
# Uses Italian voice for proper pronunciation

SOUNDS_DIR="public/sounds"

echo "Generazione audio nomi persone in italiano..."
echo ""

# Check if 'say' command is available (macOS)
if ! command -v say &> /dev/null; then
    echo "Errore: comando 'say' non trovato. Questo script richiede macOS."
    exit 1
fi

# Check for Italian voice
if say -v "?" | grep -q "Alice"; then
    VOICE="Alice"  # Italian voice
else
    echo "Avviso: voce italiana 'Alice' non trovata. Uso voce predefinita."
    VOICE="Samantha"
fi

echo "Usando voce: $VOICE"
echo ""

generate_sound() {
    local key=$1
    local italian_name=$2
    local output_file="${SOUNDS_DIR}/${key}.aiff"
    local wav_file="${SOUNDS_DIR}/${key}.wav"
    
    # Use 'say' to generate audio (AIFF format)
    say -v "$VOICE" "$italian_name" -o "$output_file"
    
    # Convert AIFF to WAV and pad/trim to exactly 5 seconds using ffmpeg
    if command -v ffmpeg &> /dev/null; then
        ffmpeg -i "$output_file" -af "apad=whole_dur=5" -t 5 -y "$wav_file" 2>/dev/null
        rm "$output_file"
        echo "✓ Creato ${key}.wav (${italian_name}, 5 secondi)"
    else
        afconvert -f WAVE -d LEI16 "$output_file" "$wav_file"
        rm "$output_file"
        echo "✓ Creato ${key}.wav (${italian_name})"
    fi
}

# Generate people sounds
generate_sound "papa" "Papà"
generate_sound "mamma" "Mamma"
generate_sound "nonna" "Nonna"
generate_sound "nonno" "Nonno"
generate_sound "michele" "Michele"

echo ""
echo "✅ Tutti i file audio persone sono stati generati!"
