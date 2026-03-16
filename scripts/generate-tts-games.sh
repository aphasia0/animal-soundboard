#!/bin/bash

SOUNDS_DIR="public/sounds"

echo "Generazione audio nomi giochi in italiano..."
echo ""

if ! command -v say &> /dev/null; then
    echo "Errore: comando 'say' non trovato. Questo script richiede macOS."
    exit 1
fi

if say -v "?" | grep -q "Alice"; then
    VOICE="Alice"
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
    
    say -v "$VOICE" "$italian_name" -o "$output_file"
    
    if command -v ffmpeg &> /dev/null && command -v ffprobe &> /dev/null; then
        local duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$output_file" 2>/dev/null)
        local dur_int=${duration%.*}
        if [ -z "$dur_int" ] || [ "$dur_int" -lt 1 ]; then
            dur_int=1
        fi
        ffmpeg -i "$output_file" -af "apad=whole_dur=${dur_int}" -t "$dur_int" -y "$wav_file" 2>/dev/null
        rm "$output_file"
        echo "✓ Creato ${key}.wav (${italian_name}, ${dur_int}s)"
    else
        afconvert -f WAVE -d LEI16 "$output_file" "$wav_file"
        rm "$output_file"
        echo "✓ Creato ${key}.wav (${italian_name})"
    fi
}

generate_sound "ruota" "Ruota"
generate_sound "trottola" "Trottola"
generate_sound "tamburello" "Tamburello"
generate_sound "macchina" "Macchina"
generate_sound "pianoforte" "Pianoforte"
generate_sound "uccellino" "Uccellino"

echo ""
echo "✅ Tutti i file audio dei giochi sono stati generati!"
