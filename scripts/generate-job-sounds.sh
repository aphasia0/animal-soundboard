#!/bin/bash

# Generate Italian job/profession TTS audio using macOS text-to-speech
# Uses Italian voice for proper pronunciation

SOUNDS_DIR="public/sounds"

echo "Generazione audio nomi lavori in italiano..."
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

# Generate audio for each job (key:italian_name format)
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

# Generate all job sounds
generate_sound "doctor" "Dottore"
generate_sound "teacher" "Insegnante"
generate_sound "firefighter" "Pompiere"
generate_sound "police" "Poliziotto"
generate_sound "chef" "Cuoco"
generate_sound "farmer" "Contadino"
generate_sound "builder" "Muratore"
generate_sound "pilot" "Pilota"
generate_sound "artist" "Artista"
generate_sound "mechanic" "Meccanico"

echo ""
echo "✅ Tutti i file audio lavori in italiano sono stati generati!"
echo ""
echo "I file contengono i nomi dei lavori pronunciati in italiano."
