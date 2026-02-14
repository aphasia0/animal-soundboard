// 10 music pieces for children
export const music = [
    { id: 1, key: 'twinkle', name: 'Twinkle Twinkle', image: '/music/twinkle.svg', sound: '/sounds/twinkle.wav', emoji: '⭐' },
    { id: 2, key: 'happy', name: 'Happy Birthday', image: '/music/happy.svg', sound: '/sounds/happy.wav', emoji: '🎂' },
    { id: 3, key: 'wheels', name: 'Wheels on the Bus', image: '/music/wheels.svg', sound: '/sounds/wheels.wav', emoji: '🚌' },
    { id: 4, key: 'bingo', name: 'Bingo', image: '/music/bingo.svg', sound: '/sounds/bingo.wav', emoji: '🐕' },
    { id: 5, key: 'old_macdonald', name: 'Old MacDonald', image: '/music/old_macdonald.svg', sound: '/sounds/old_macdonald.wav', emoji: '🚜' },
    { id: 6, key: 'itsy_bitsy', name: 'Itsy Bitsy Spider', image: '/music/itsy_bitsy.svg', sound: '/sounds/itsy_bitsy.wav', emoji: '🕷️' },
    { id: 7, key: 'mary_lamb', name: 'Mary Had a Little Lamb', image: '/music/mary_lamb.svg', sound: '/sounds/mary_lamb.wav', emoji: '🐑' },
    { id: 8, key: 'row_boat', name: 'Row Your Boat', image: '/music/row_boat.svg', sound: '/sounds/row_boat.wav', emoji: '🚣' },
    { id: 9, key: 'abc', name: 'ABC Song', image: '/music/abc.svg', sound: '/sounds/abc.wav', emoji: '🔤' },
    { id: 10, key: 'london_bridge', name: 'London Bridge', image: '/music/london_bridge.svg', sound: '/sounds/london_bridge.wav', emoji: '🌉' }
];

export function getRandomMusic(currentId) {
    const availableMusic = music.filter(m => m.id !== currentId);
    return availableMusic[Math.floor(Math.random() * availableMusic.length)];
}
