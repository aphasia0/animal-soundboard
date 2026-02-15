// 5 people for the soundboard
export const people = [
    { id: 1, key: 'papa', name: 'Papà', image: '/people/papa.jpg', sound: '/sounds/papa.wav', emoji: '👨' },
    { id: 2, key: 'mamma', name: 'Mamma', image: '/people/mamma.jpg', sound: '/sounds/mamma.wav', emoji: '👩' },
    { id: 3, key: 'nonna', name: 'Nonna', image: '/people/nonna.jpg', sound: '/sounds/nonna.wav', emoji: '👵' },
    { id: 4, key: 'nonno', name: 'Nonno', image: '/people/nonno.jpg', sound: '/sounds/nonno.wav', emoji: '👴' },
    { id: 5, key: 'michele', name: 'Michele', image: '/people/michele.jpg', sound: '/sounds/michele.wav', emoji: '👦' }
];

export function getRandomPerson(currentId) {
    const availablePeople = people.filter(p => p.id !== currentId);
    return availablePeople[Math.floor(Math.random() * availablePeople.length)];
}
