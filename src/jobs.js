// 10 Italian jobs/professions for the soundboard
export const jobs = [
    { id: 1, key: 'doctor', name: 'Dottore', image: '/jobs/doctor.svg', sound: '/sounds/doctor.wav', emoji: '👨‍⚕️' },
    { id: 2, key: 'teacher', name: 'Insegnante', image: '/jobs/teacher.svg', sound: '/sounds/teacher.wav', emoji: '👨‍🏫' },
    { id: 3, key: 'firefighter', name: 'Pompiere', image: '/jobs/firefighter.svg', sound: '/sounds/firefighter.wav', emoji: '👨‍🚒' },
    { id: 4, key: 'police', name: 'Poliziotto', image: '/jobs/police.svg', sound: '/sounds/police.wav', emoji: '👮' },
    { id: 5, key: 'chef', name: 'Cuoco', image: '/jobs/chef.svg', sound: '/sounds/chef.wav', emoji: '👨‍🍳' },
    { id: 6, key: 'farmer', name: 'Contadino', image: '/jobs/farmer.svg', sound: '/sounds/farmer.wav', emoji: '👨‍🌾' },
    { id: 7, key: 'builder', name: 'Muratore', image: '/jobs/builder.svg', sound: '/sounds/builder.wav', emoji: '👷' },
    { id: 8, key: 'pilot', name: 'Pilota', image: '/jobs/pilot.svg', sound: '/sounds/pilot.wav', emoji: '👨‍✈️' },
    { id: 9, key: 'artist', name: 'Artista', image: '/jobs/artist.svg', sound: '/sounds/artist.wav', emoji: '👨‍🎨' },
    { id: 10, key: 'mechanic', name: 'Meccanico', image: '/jobs/mechanic.svg', sound: '/sounds/mechanic.wav', emoji: '👨‍🔧' }
];

export function getRandomJob(currentId) {
    const availableJobs = jobs.filter(job => job.id !== currentId);
    return availableJobs[Math.floor(Math.random() * availableJobs.length)];
}
