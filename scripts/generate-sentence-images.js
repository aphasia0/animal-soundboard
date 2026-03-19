import fs from 'fs';
import path from 'path';

const sentences = [
    { key: 'leone_ruggisce', name: 'Il leone ruggisce', emoji: '🦁' },
    { key: 'elefante_strombetta', name: 'L\'elefante strombetta', emoji: '🐘' },
    { key: 'cane_abbaia', name: 'Il cane abbaia', emoji: '🐕' },
    { key: 'gatto_miagola', name: 'Il gatto miagola', emoji: '🐱' },
    { key: 'mucca_muggisce', name: 'La mucca muggisce', emoji: '🐄' },
    { key: 'cavallo_nitrisce', name: 'Il cavallo nitrisce', emoji: '🐴' },
    { key: 'pecora_bela', name: 'La pecora bela', emoji: '🐑' },
    { key: 'maiale_grugnisce', name: 'Il maiale grugnisce', emoji: '🐷' },
    { key: 'gallina_cluck', name: 'La gallina fa cluck', emoji: '🐔' },
    { key: 'anatra_quack', name: 'L\'anatra fa quack', emoji: '🦆' },
    { key: 'tacchino_gobble', name: 'Il tacchino fa gobble', emoji: '🦃' },
    { key: 'gallo_chicchirichi', name: 'Il gallo fa chicchirichì', emoji: '🐓' },
    { key: 'rana_gracida', name: 'La rana gracida', emoji: '🐸' },
    { key: 'gufo_chiu', name: 'Il gufo fa chiu', emoji: '🦉' },
    { key: 'corvo_gracchia', name: 'Il corvo gracchia', emoji: '🐦‍⬛' },
    { key: 'pappagallo_parla', name: 'Il pappagallo parla', emoji: '🦜' },
    { key: 'pavone_urla', name: 'Il pavone urlò', emoji: '🦚' },
    { key: 'scimmia_urla', name: 'La scimmia urlò', emoji: '🐒' },
    { key: 'orso_ruggisce', name: 'L\'orso ruggisce', emoji: '🐻' },
    { key: 'lupo_ulula', name: 'Il lupo ulula', emoji: '🐺' },
    { key: 'volpe_stridisce', name: 'La volpe stridisce', emoji: '🦊' },
    { key: 'lupo_aam', name: 'Il lupo fa aam', emoji: '🐺' },
    { key: 'serpente_sibila', name: 'Il serpente sibila', emoji: '🐍' },
    { key: 'coccodrillo_ringhia', name: 'Il coccodrillo ringhia', emoji: '🐊' },
    { key: 'delfino_salta', name: 'Il delfino salta', emoji: '🐬' },
    { key: 'balena_canta', name: 'La balena canta', emoji: '🐋' },
    { key: 'ape_ronza', name: 'L\'ape ronza', emoji: '🐝' },
    { key: 'grillo_cricchiola', name: 'Il grillo cricchiola', emoji: '🦗' },
    { key: 'zanzara_ronza', name: 'La zanzara ronza', emoji: '🦟' },
    { key: 'gabbiano_grida', name: 'Il gabbiano grida', emoji: '🕊️' },
    { key: 'aquila_strida', name: 'L\'aquila strida', emoji: '🦅' },
    { key: 'falco_strida', name: 'Il falco strida', emoji: '🦅' },
    { key: 'tigre_ruggisce', name: 'La tigre ruggisce', emoji: '🐯' },
    { key: 'pinguino_strombazza', name: 'Il pinguino strombazza', emoji: '🐧' },
    { key: 'koala_urla', name: 'Il koala urla', emoji: '🐨' },
    { key: 'canguro_salta', name: 'Il canguro salta', emoji: '🦘' },
    { key: 'zebra_nitrisce', name: 'La zebra nitrisce', emoji: '🦓' },
    { key: 'giraffa_muggisce', name: 'La giraffa muggisce', emoji: '🦒' },
    { key: 'ippopotamo_ringhia', name: 'L\'ippopotamo ringhia', emoji: '🦛' },
    { key: 'tigre_ringhia', name: 'La tigre ringhia', emoji: '🐯' },
    { key: 'leopardo_ringhia', name: 'Il leopardo ringhia', emoji: '🐆' },
    { key: 'coyote_ulula', name: 'Il coyote ulula', emoji: '🐺' },
    { key: 'iena_risa', name: 'La iena ride', emoji: '� Hyena' },
    { key: 'gorilla_urla', name: 'Il gorilla urla', emoji: '🦍' },
    { key: 'asino_ia', name: 'L\'asino fa ia', emoji: '🫏' },
    { key: 'capra_bela', name: 'La capra bela', emoji: '🐐' },
    { key: 'foca_abbaia', name: 'La foca abbaia', emoji: '🦭' },
    { key: 'leopardo_ruggisce', name: 'Il leopardo ruggisce', emoji: '🐆' },
    { key: 'gepardo_urla', name: 'Il ghepardo urlò', emoji: '🐆' },
    { key: 'panda_grugnisce', name: 'Il panda grugnisce', emoji: '🐼' },
    { key: 'cervo_bramisce', name: 'Il cervo bramisce', emoji: '🦌' },
    { key: 'coccodrillo_sibila', name: 'Il coccodrillo sibila', emoji: '🐊' },
];

const colors = [
    ['#FF6B6B', '#EE5A5A'],
    ['#4ECDC4', '#3DB8B0'],
    ['#45B7D1', '#35A7C1'],
    ['#96CEB4', '#86BE9F'],
    ['#FFEAA7', '#EEDB97'],
    ['#DDA0DD', '#CD90CD'],
    ['#98D8C8', '#88C8B8'],
    ['#F7DC6F', '#E7CC5F'],
    ['#BB8FCE', '#AB7FBE'],
    ['#85C1E9', '#75B1D9'],
];

function generateSVG(sentence) {
    const idx = sentences.indexOf(sentence) % colors.length;
    const [color1, color2] = colors[idx];
    const emoji = sentence.emoji;
    const name = sentence.name;
    const lines = name.length > 20 ? 2 : 1;
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
        <linearGradient id="bg${sentence.key}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color1}"/>
            <stop offset="100%" style="stop-color:${color2}"/>
        </linearGradient>
    </defs>
    <rect width="200" height="200" rx="20" fill="url(#bg${sentence.key})"/>
    <text x="100" y="85" font-size="60" text-anchor="middle">${emoji}</text>
    <text x="100" y="${lines > 1 ? 140 : 150}" font-size="${lines > 1 ? 14 : 16}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold">${name}</text>
</svg>`;
}

const outputDir = 'public/sentences';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

sentences.forEach(sentence => {
    const svg = generateSVG(sentence);
    const filename = `${sentence.key}.svg`;
    fs.writeFileSync(path.join(outputDir, filename), svg);
    console.log(`Created ${filename}`);
});

console.log(`\nGenerated ${sentences.length} SVG files in ${outputDir}/`);
