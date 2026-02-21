// 8 sentences for the soundboard
export const sentences = [
    { id: 1, key: 'voglio_cioccolato', name: 'Io voglio il cioccolato', image: '/sentences/voglio_cioccolato.svg', sound: '/sounds/voglio_cioccolato.wav' },
    { id: 2, key: 'ho_fame', name: 'Ho fame', image: '/sentences/ho_fame.svg', sound: '/sounds/ho_fame.wav' },
    { id: 3, key: 'andiamo_casa', name: 'Andiamo a casa', image: '/sentences/andiamo_casa.svg', sound: '/sounds/andiamo_casa.wav' },
    { id: 4, key: 'andiamo_scuola', name: 'Andiamo a scuola', image: '/sentences/andiamo_scuola.svg', sound: '/sounds/andiamo_scuola.wav' },
    { id: 5, key: 'ho_sete', name: 'Ho sete', image: '/sentences/ho_sete.svg', sound: '/sounds/ho_sete.wav' },
    { id: 6, key: 'buona_pappa', name: 'Che buona questa pappa', image: '/sentences/buona_pappa.svg', sound: '/sounds/buona_pappa.wav' },
    { id: 7, key: 'andiamo_tata', name: 'Andiamo dalla tata', image: '/sentences/andiamo_tata.svg', sound: '/sounds/andiamo_tata.wav' },
    { id: 8, key: 'voglio_passeggiata', name: 'Voglio fare una passeggiata', image: '/sentences/voglio_passeggiata.svg', sound: '/sounds/voglio_passeggiata.wav' }
];

export function getRandomSentence(currentId) {
    const availableSentences = sentences.filter(s => s.id !== currentId);
    return availableSentences[Math.floor(Math.random() * availableSentences.length)];
}
