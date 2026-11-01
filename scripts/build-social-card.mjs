import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
// Use the image renderer already installed with this workspace.
const sharp=require('../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');
const logo=readFileSync(new URL('../public/icons/icon-512.png',import.meta.url)).toString('base64');
const svg=readFileSync(new URL('../public/social-card.svg',import.meta.url),'utf8').replace('href="icons/icon-512.png"','href="data:image/png;base64,'+logo+'"');
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL('../public/social-card-v2.png',import.meta.url)));
console.log('Built social-card-v2.png with the current PWA logo.');
