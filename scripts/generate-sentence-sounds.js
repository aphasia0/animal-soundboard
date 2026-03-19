import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const sentences = [
    { key: 'leone_ruggisce', name: 'Il leone ruggisce' },
    { key: 'elefante_strombetta', name: 'L\'elefante strombetta' },
    { key: 'cane_abbaia', name: 'Il cane abbaia' },
    { key: 'gatto_miagola', name: 'Il gatto miagola' },
    { key: 'mucca_muggisce', name: 'La mucca muggisce' },
    { key: 'cavallo_nitrisce', name: 'Il cavallo nitrisce' },
    { key: 'pecora_bela', name: 'La pecora bela' },
    { key: 'maiale_grugnisce', name: 'Il maiale grugnisce' },
    { key: 'gallina_cluck', name: 'La gallina fa cluck' },
    { key: 'anatra_quack', name: 'L\'anatra fa quack' },
    { key: 'tacchino_gobble', name: 'Il tacchino fa gobble' },
    { key: 'gallo_chicchirichi', name: 'Il gallo fa chicchirichì' },
    { key: 'rana_gracida', name: 'La rana gracida' },
    { key: 'gufo_chiu', name: 'Il gufo fa chiu' },
    { key: 'corvo_gracchia', name: 'Il corvo gracchia' },
    { key: 'pappagallo_parla', name: 'Il pappagallo parla' },
    { key: 'pavone_urla', name: 'Il pavone urlò' },
    { key: 'scimmia_urla', name: 'La scimmia urlò' },
    { key: 'orso_ruggisce', name: 'L\'orso ruggisce' },
    { key: 'lupo_ulula', name: 'Il lupo ulula' },
    { key: 'volpe_stridisce', name: 'La volpe stridisce' },
    { key: 'lupo_aam', name: 'Il lupo fa aam' },
    { key: 'serpente_sibila', name: 'Il serpente sibila' },
    { key: 'coccodrillo_ringhia', name: 'Il coccodrillo ringhia' },
    { key: 'delfino_salta', name: 'Il delfino salta' },
    { key: 'balena_canta', name: 'La balena canta' },
    { key: 'ape_ronza', name: 'L\'ape ronza' },
    { key: 'grillo_cricchiola', name: 'Il grillo cricchiola' },
    { key: 'zanzara_ronza', name: 'La zanzara ronza' },
    { key: 'gabbiano_grida', name: 'Il gabbiano grida' },
    { key: 'aquila_strida', name: 'L\'aquila strida' },
    { key: 'falco_strida', name: 'Il falco strida' },
    { key: 'tigre_ruggisce', name: 'La tigre ruggisce' },
    { key: 'pinguino_strombazza', name: 'Il pinguino strombazza' },
    { key: 'koala_urla', name: 'Il koala urla' },
    { key: 'canguro_salta', name: 'Il canguro salta' },
    { key: 'zebra_nitrisce', name: 'La zebra nitrisce' },
    { key: 'giraffa_muggisce', name: 'La giraffa muggisce' },
    { key: 'ippopotamo_ringhia', name: 'L\'ippopotamo ringhia' },
    { key: 'tigre_ringhia', name: 'La tigre ringhia' },
    { key: 'leopardo_ringhia', name: 'Il leopardo ringhia' },
    { key: 'coyote_ulula', name: 'Il coyote ulula' },
    { key: 'iena_risa', name: 'La iena ride' },
    { key: 'gorilla_urla', name: 'Il gorilla urla' },
    { key: 'asino_ia', name: 'L\'asino fa ia' },
    { key: 'capra_bela', name: 'La capra bela' },
    { key: 'foca_abbaia', name: 'La foca abbaia' },
    { key: 'leopardo_ruggisce', name: 'Il leopardo ruggisce' },
    { key: 'gepardo_urla', name: 'Il ghepardo urlò' },
    { key: 'panda_grugnisce', name: 'Il panda grugnisce' },
    { key: 'cervo_bramisce', name: 'Il cervo bramisce' },
    { key: 'coccodrillo_sibila', name: 'Il coccodrillo sibila' },
];

const outputDir = 'public/sounds';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Generating TTS audio files using macOS Alice voice...\n');

for (const sentence of sentences) {
    const filename = `${sentence.key}.wav`;
    const filepath = path.join(outputDir, filename);
    
    try {
        const aiffPath = filepath.replace('.wav', '.aiff');
        execSync(
            `say -v Alice -o "${aiffPath}" "${sentence.name}" && afconvert -f WAVE -d LEI16@44100 "${aiffPath}" "${filepath}" && rm "${aiffPath}"`,
            { encoding: 'utf8' }
        );
        console.log(`Created ${filename}`);
    } catch (error) {
        console.error(`Error creating ${filename}: ${error.message}`);
    }
}

console.log(`\nGenerated ${sentences.length} WAV files in ${outputDir}/`);
console.log('Note: Requires macOS with Alice voice installed.');
