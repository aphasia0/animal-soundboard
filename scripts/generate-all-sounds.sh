#!/bin/bash

# Generate ALL TTS sounds at natural duration (no padding)
# Audio looping in the app handles repetition during 5-second hold

SOUNDS_DIR="public/sounds"

# Check if 'say' command is available (macOS)
if ! command -v say &> /dev/null; then
    echo "Error: 'say' command not found. This script requires macOS."
    exit 1
fi

# Check for Italian voice
if say -v "?" | grep -q "Alice"; then
    VOICE="Alice"  # Italian voice
else
    echo "Warning: Italian voice 'Alice' not found. Using default."
    VOICE="Samantha"
fi

echo "Using voice: $VOICE"
echo ""

generate_sound() {
    local key=$1
    local italian_name=$2
    local output_file="${SOUNDS_DIR}/${key}.aiff"
    local wav_file="${SOUNDS_DIR}/${key}.wav"
    
    # Use 'say' to generate audio (AIFF format)
    say -v "$VOICE" "$italian_name" -o "$output_file"
    
    # Convert AIFF to WAV with 0.5s padding after the spoken text
    if command -v ffmpeg &> /dev/null; then
        ffmpeg -i "$output_file" -af "apad=pad_dur=0.5" -y "$wav_file" 2>/dev/null
        rm "$output_file"
    else
        afconvert -f WAVE -d LEI16 "$output_file" "$wav_file"
        rm "$output_file"
    fi
    
    echo "✓ ${key}.wav (${italian_name})"
}

echo "=== Animali (50) ==="
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
echo "=== Lavori (10) ==="
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
echo "=== Persone (5) ==="
generate_sound "papa" "Papà"
generate_sound "mamma" "Mamma"
generate_sound "nonna" "Nonna"
generate_sound "nonno" "Nonno"
generate_sound "michele" "Michele"

echo ""
echo "=== Musica (10) ==="
generate_sound "twinkle" "Twinkle Twinkle Little Star"
generate_sound "happy" "Happy Birthday to You"
generate_sound "wheels" "The Wheels on the Bus"
generate_sound "bingo" "Bingo Was His Name-O"
generate_sound "old_macdonald" "Old MacDonald Had a Farm"
generate_sound "itsy_bitsy" "Itsy Bitsy Spider"
generate_sound "mary_lamb" "Mary Had a Little Lamb"
generate_sound "row_boat" "Row Row Row Your Boat"
generate_sound "abc" "A B C D E F G"
generate_sound "london_bridge" "London Bridge Is Falling Down"

echo ""
echo "✅ All sounds regenerated at natural TTS duration!"
echo "Audio looping in the app handles repetition during hold."
