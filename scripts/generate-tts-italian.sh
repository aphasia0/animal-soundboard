#!/bin/bash

# Generate Italian animal name audio using macOS text-to-speech
# Uses Italian voice for proper pronunciation

SOUNDS_DIR="public/sounds"

echo "Generazione audio nomi animali in italiano..."
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

# Generate audio for each animal (key:italian_name format)
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

# Generate all animal sounds
generate_sound "lion" "Leone"
generate_sound "elephant" "Elefante"
generate_sound "dog" "Cane"
generate_sound "cat" "Gatto"
generate_sound "cow" "Mucca"
generate_sound "horse" "Cavallo"
generate_sound "sheep" "Pecora"
generate_sound "pig" "Maiale"
generate_sound "chicken" "Gallina"
generate_sound "duck" "Anatra"
generate_sound "goose" "Oca"
generate_sound "turkey" "Tacchino"
generate_sound "rooster" "Gallo"
generate_sound "frog" "Rana"
generate_sound "owl" "Gufo"
generate_sound "crow" "Corvo"
generate_sound "parrot" "Pappagallo"
generate_sound "peacock" "Pavone"
generate_sound "monkey" "Scimmia"
generate_sound "bear" "Orso"
generate_sound "wolf" "Lupo"
generate_sound "fox" "Volpe"
generate_sound "deer" "Cervo"
generate_sound "goat" "Capra"
generate_sound "donkey" "Asino"
generate_sound "zebra" "Zebra"
generate_sound "giraffe" "Giraffa"
generate_sound "hippo" "Ippopotamo"
generate_sound "rhino" "Rinoceronte"
generate_sound "tiger" "Tigre"
generate_sound "leopard" "Leopardo"
generate_sound "cheetah" "Ghepardo"
generate_sound "panda" "Panda"
generate_sound "koala" "Koala"
generate_sound "kangaroo" "Canguro"
generate_sound "penguin" "Pinguino"
generate_sound "seal" "Foca"
generate_sound "dolphin" "Delfino"
generate_sound "whale" "Balena"
generate_sound "snake" "Serpente"
generate_sound "crocodile" "Coccodrillo"
generate_sound "bee" "Ape"
generate_sound "cricket" "Grillo"
generate_sound "mosquito" "Zanzara"
generate_sound "seagull" "Gabbiano"
generate_sound "eagle" "Aquila"
generate_sound "hawk" "Falco"
generate_sound "coyote" "Coyote"
generate_sound "hyena" "Iena"
generate_sound "gorilla" "Gorilla"

echo ""
echo "✅ Tutti i file audio in italiano sono stati generati!"
echo ""
echo "I file contengono i nomi degli animali pronunciati in italiano."
