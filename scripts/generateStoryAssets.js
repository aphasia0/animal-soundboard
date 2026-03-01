import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import textToSpeech from '@google-cloud/text-to-speech';
import fetch from 'node-fetch';
import { stories } from '../src/stories.js';

dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assicurati che google credentials siano impostate
const ttsClient = new textToSpeech.TextToSpeechClient();

import { GoogleGenAI } from '@google/genai';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI(GEMINI_API_KEY ? { apiKey: GEMINI_API_KEY } : {});

async function generateAudio(text, outputPath) {
    if (fs.existsSync(outputPath)) {
        console.log(`Audio already exists: ${outputPath}`);
        return;
    }

    console.log(`Generating audio: ${outputPath}`);
    try {
        const request = {
            input: { text: text },
            // Simuliamo una voce da cantastorie in italiano
            voice: { languageCode: 'it-IT', name: 'it-IT-Neural2-A', ssmlGender: 'FEMALE' },
            // Tono leggermente più acuto e allegro per bambini
            audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85, pitch: 2.0 },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        fs.writeFileSync(outputPath, response.audioContent, 'binary');
        console.log(`Saved audio to ${outputPath}`);
    } catch (e) {
        console.error(`Failed to generate audio for ${outputPath}:`, e.message);
    }
}

async function generateImage(prompt, outputPath, storylineContext = '', aspectRatio = '1:1') {
    if (fs.existsSync(outputPath)) {
        console.log(`Image already exists: ${outputPath}`);
        return;
    }

    if (!GEMINI_API_KEY) {
        console.warn(`Skipping image ${outputPath} (No GEMINI_API_KEY)`);
        return;
    }

    console.log(`Generating image for: ${prompt.substring(0, 30)}... (Aspect Ratio: ${aspectRatio})`);
    try {
        const stylePrefix = "A colorful, cute illustration for a children's storybook, in a vibrant, slightly silly and fun style. Do not add any text.";
        const storylinePrefix = storylineContext ? `Story context: ${storylineContext}. ` : '';

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: stylePrefix + ' ' + storylinePrefix + prompt,
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: "0.5K",
                }
            }
        });
        let imageSaved = false;
        for (const part of response.candidates[0].content.parts) {
            if (part.text) {
                console.log(part.text);
            } else if (part.inlineData) {
                const imageData = part.inlineData.data;
                const buffer = Buffer.from(imageData, "base64");
                fs.writeFileSync(outputPath, buffer);
                imageSaved = true;
            }
        }

        if (imageSaved) {
            console.log(`Saved image to ${outputPath}`);
        } else {
            console.warn(`No image data returned for ${outputPath}`);
        }
    } catch (e) {
        console.error(`Failed to generate image for ${outputPath}:`, e.message);
    }
}

async function main() {
    const outputDir = path.join(__dirname, '..', 'public', 'assets', 'stories');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('Starting Asset Generation...');

    for (const story of stories) {
        console.log(`\nProcessing story: ${story.name}`);
        let i = 1;
        for (const chunk of story.chunks) {
            console.log(`  Chunk ${i}/${story.chunks.length}`);

            const audioPath = path.join(__dirname, '..', 'public', chunk.sound);
            await generateAudio(chunk.text, audioPath);

            const imagePathL = path.join(__dirname, '..', 'public', chunk.imageLandscape);
            const imagePathP = path.join(__dirname, '..', 'public', chunk.imagePortrait);

            await generateImage(chunk.text, imagePathL, story.storyline, '16:9');
            await generateImage(chunk.text, imagePathP, story.storyline, '9:16');

            i++;
        }
    }

    console.log('\nDone!');
}

main().catch(console.error);
