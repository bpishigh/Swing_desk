// One-off: print the text of one NSE circular (number from CIRC env, e.g. CML75192).
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const pdfParse = createRequire(import.meta.url)('pdf-parse/lib/pdf-parse.js');
const f = process.env.CIRC;
const r = await fetch(`https://archives.nseindia.com/content/circulars/${f}.pdf`, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36' } });
const text = (await pdfParse(Buffer.from(await r.arrayBuffer()))).text;
writeFileSync('data/source-test/circ-text.json', JSON.stringify({ f, text }, null, 1) + '\n');
console.log(text.slice(0, 1500));
