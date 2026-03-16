#!/bin/bash

SOUNDS_DIR="public/sounds"

echo "Generazione audio nomi mezzi di trasporto in italiano..."
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

generate_sound "automobile" "Automobile"
generate_sound "motocicletta" "Motocicletta"
generate_sound "bicicletta" "Bicicletta"
generate_sound "autobus" "Autobus"
generate_sound "tram" "Tram"
generate_sound "metropolitana" "Metropolitana"
generate_sound "treno" "Treno"
generate_sound "aereo" "Aereo"
generate_sound "elicottero" "Elicottero"
generate_sound "nave" "Nave"
generate_sound "barca" "Barca"
generate_sound "yacht" "Yacht"
generate_sound "camper" "Camper"
generate_sound "pullman" "Pullman"
generate_sound "taxi" "Taxi"
generate_sound "ambulanza" "Ambulanza"
generate_sound "pompieri" "Pompieri"
generate_sound "polizia" "Polizia"
generate_sound "camion" "Camion"
generate_sound "trattore" "Trattore"
generate_sound "funivia" "Funivia"
generate_sound "seggiovia" "Seggiovia"
generate_sound "mongolfiera" "Mongolfiera"
generate_sound "dirigibile" "Dirigibile"
generate_sound "vaporetto" "Vaporetto"
generate_sound "traghetto" "Traghetto"
generate_sound "scooter" "Scooter"
generate_sound "kayak" "Kayak"
generate_sound "catamarano" "Catamarano"
generate_sound "ruspa" "Ruspa"

echo ""
echo "✅ Tutti i file audio dei mezzi di trasporto sono stati generati!"
