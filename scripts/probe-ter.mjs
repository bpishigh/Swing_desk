// Probe 5: the TER page's data call. Writes data/source-test/ter-probe.json.
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const get = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); return { status: r.status, text: await r.text() }; };
const out = {};
const page = await get('https://www.amfiindia.com/ter-of-mf-schemes');
const chunk = [...page.text.matchAll(/(\/_next\/static\/[^"'\\]*ter-of-mf-schemes\/page-[a-z0-9]+\.js)/g)].map((m) => m[1])[0];
const js = (await get('https://www.amfiindia.com' + chunk)).text;
const i = js.indexOf('let eg=()=>');
out.code = js.slice(i, i + 3500);
out.months = (await get('https://www.amfiindia.com/api/populate-ter-month?year=2026')).text.slice(0, 600);
out.years = (await get('https://www.amfiindia.com/api/populate-ter-year')).text.slice(0, 300);
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/ter-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(chunk, i);
