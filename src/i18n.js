// Italian translations for animal names
const animalTranslations = {
    'lion': 'Leone',
    'elephant': 'Elefante',
    'dog': 'Cane',
    'cat': 'Gatto',
    'cow': 'Mucca',
    'horse': 'Cavallo',
    'sheep': 'Pecora',
    'pig': 'Maiale',
    'chicken': 'Gallina',
    'duck': 'Anatra',
    'goose': 'Oca',
    'turkey': 'Tacchino',
    'rooster': 'Gallo',
    'frog': 'Rana',
    'owl': 'Gufo',
    'crow': 'Corvo',
    'parrot': 'Pappagallo',
    'peacock': 'Pavone',
    'monkey': 'Scimmia',
    'bear': 'Orso',
    'wolf': 'Lupo',
    'fox': 'Volpe',
    'deer': 'Cervo',
    'goat': 'Capra',
    'donkey': 'Asino',
    'zebra': 'Zebra',
    'giraffe': 'Giraffa',
    'hippo': 'Ippopotamo',
    'rhino': 'Rinoceronte',
    'tiger': 'Tigre',
    'leopard': 'Leopardo',
    'cheetah': 'Ghepardo',
    'panda': 'Panda',
    'koala': 'Koala',
    'kangaroo': 'Canguro',
    'penguin': 'Pinguino',
    'seal': 'Foca',
    'dolphin': 'Delfino',
    'whale': 'Balena',
    'snake': 'Serpente',
    'crocodile': 'Coccodrillo',
    'bee': 'Ape',
    'cricket': 'Grillo',
    'mosquito': 'Zanzara',
    'seagull': 'Gabbiano',
    'eagle': 'Aquila',
    'hawk': 'Falco',
    'coyote': 'Coyote',
    'hyena': 'Iena',
    'gorilla': 'Gorilla'
};

// Job translations
const jobTranslations = {
    'doctor': 'Dottore',
    'teacher': 'Insegnante',
    'firefighter': 'Pompiere',
    'police': 'Poliziotto',
    'chef': 'Cuoco',
    'farmer': 'Contadino',
    'builder': 'Muratore',
    'pilot': 'Pilota',
    'artist': 'Artista',
    'mechanic': 'Meccanico'
};

export function getAnimalName(key, locale = 'it') {
    if (locale === 'it') {
        return animalTranslations[key] || key;
    }
    return key;
}

// Music translations
const musicTranslations = {
    'twinkle': 'Twinkle Twinkle',
    'happy': 'Happy Birthday',
    'wheels': 'Ruote del Bus',
    'bingo': 'Bingo',
    'old_macdonald': 'Old MacDonald',
    'itsy_bitsy': 'Piccolo Ragno',
    'mary_lamb': 'Mary e l\'Agnellino',
    'row_boat': 'Rema la Barca',
    'abc': 'Canzone ABC',
    'london_bridge': 'London Bridge'
};

// People translations
const peopleTranslations = {
    'papa': 'Papà',
    'mamma': 'Mamma',
    'nonna': 'Nonna',
    'nonno': 'Nonno',
    'michele': 'Michele'
};

export function getJobName(key, locale = 'it') {
    if (locale === 'it') {
        return jobTranslations[key] || key;
    }
    return key;
}

export function getMusicName(key, locale = 'it') {
    if (locale === 'it') {
        return musicTranslations[key] || key;
    }
    return key;
}

export function getPersonName(key, locale = 'it') {
    if (locale === 'it') {
        return peopleTranslations[key] || key;
    }
    return key;
}

// Sentence translations
const sentenceTranslations = {
    'voglio_cioccolato': 'Io voglio il cioccolato',
    'ho_fame': 'Ho fame',
    'andiamo_casa': 'Andiamo a casa',
    'andiamo_scuola': 'Andiamo a scuola',
    'ho_sete': 'Ho sete',
    'buona_pappa': 'Che buona questa pappa',
    'andiamo_tata': 'Andiamo dalla tata',
    'voglio_passeggiata': 'Voglio fare una passeggiata'
};

export function getSentenceName(key, locale = 'it') {
    if (locale === 'it') {
        return sentenceTranslations[key] || key;
    }
    return key;
}
