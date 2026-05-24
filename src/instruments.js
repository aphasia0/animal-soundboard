// Metadata for 20 musical instruments
function makeSvg(emoji, bg) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="${bg}"/><text x="50" y="65" font-size="50" dominant-baseline="middle" text-anchor="middle">${emoji}</text></svg>`;
}

export const instruments = [
    { id: 1, key: 'pianoforte', name: 'Pianoforte', image: makeSvg('🎹', '%23FFF5F5'), sound: 'synth:pianoforte' },
    { id: 2, key: 'chitarra', name: 'Chitarra', image: makeSvg('🎸', '%23FFFAF0'), sound: 'synth:chitarra' },
    { id: 3, key: 'flauto', name: 'Flauto', image: makeSvg('🪈', '%23F0FFF4'), sound: 'synth:flauto' },
    { id: 4, key: 'tamburo', name: 'Tamburo', image: makeSvg('🥁', '%23EDF2F7'), sound: 'synth:tamburo' },
    { id: 5, key: 'tromba', name: 'Tromba', image: makeSvg('🎺', '%23FEFCBF'), sound: 'synth:tromba' },
    { id: 6, key: 'violino', name: 'Violino', image: makeSvg('🎻', '%23FAF5FF'), sound: 'synth:violino' },
    { id: 7, key: 'xilofono', name: 'Xilofono', image: makeSvg('🪵', '%23E6FFFA'), sound: 'synth:xilofono' },
    { id: 8, key: 'sassofono', name: 'Sassofono', image: makeSvg('🎷', '%23FEF3C7'), sound: 'synth:sassofono' },
    { id: 9, key: 'arpa', name: 'Arpa', image: makeSvg('🪕', '%23EEF2F6'), sound: 'synth:arpa' },
    { id: 10, key: 'organo', name: 'Organo', image: makeSvg('🏛️', '%23FCE8E6'), sound: 'synth:organo' },
    { id: 11, key: 'clarinetto', name: 'Clarinetto', image: makeSvg('🎵', '%23ECFDF5'), sound: 'synth:clarinetto' },
    { id: 12, key: 'fisarmonica', name: 'Fisarmonica', image: makeSvg('🪗', '%23FFF7ED'), sound: 'synth:fisarmonica' },
    { id: 13, key: 'campana', name: 'Campana', image: makeSvg('🔔', '%23FEFCE8'), sound: 'synth:campana' },
    { id: 14, key: 'sintetizzatore', name: 'Sintetizzatore', image: makeSvg('🎹', '%23F5F3FF'), sound: 'synth:sintetizzatore' },
    { id: 15, key: 'ukulele', name: 'Ukulele', image: makeSvg('🪕', '%23F0FDFA'), sound: 'synth:ukulele' },
    { id: 16, key: 'mandolino', name: 'Mandolino', image: makeSvg('🎸', '%23FFF1F2'), sound: 'synth:mandolino' },
    { id: 17, key: 'triangolo', name: 'Triangolo', image: makeSvg('🔺', '%23F1F5F9'), sound: 'synth:triangolo' },
    { id: 18, key: 'maracas', name: 'Maracas', image: makeSvg('🪇', '%23ECFDF5'), sound: 'synth:maracas' },
    { id: 19, key: 'banjo', name: 'Banjo', image: makeSvg('🪕', '%23FFFBEB'), sound: 'synth:banjo' },
    { id: 20, key: 'violoncello', name: 'Violoncello', image: makeSvg('🎻', '%23FDF2F8'), sound: 'synth:violoncello' }
];

export function getRandomInstrument(excludeId = null) {
    let available = instruments;
    if (excludeId !== null) {
        available = instruments.filter(i => i.id !== excludeId);
    }
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
}
