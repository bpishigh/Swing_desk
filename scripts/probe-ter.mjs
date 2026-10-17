// Probe 4: read the TER page's own scripts for the API call. Writes data/source-test/ter-probe.json.
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const get = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); return { status: r.status, text: await r.text() }; };
const out = { scripts: 0, contexts: [], htmlHints: [] };
const page = await get('https://www.amfiindia.com/ter-of-mf-schemes');
out.htmlHints = [...page.text.matchAll(/populate-te-rdata[^"'\\<]{0,200}|ter-of-mf[^"'\\<]{0,120}/g)].map((m) => m[0]).slice(0, 10);
const scripts = [...new Set([...page.text.matchAll(/(\/_next\/static\/[^"'\\]+\.js)/g)].map((m) => 'https://www.amfiindia.com' + m[1]))];
out.scripts = scripts.length;
for (const u of scripts) { try { const j = await get(u); for (const m of j.text.matchAll(/te-rdata|populate-te|strType|MF_ID/g)) { out.contexts.push({ u: u.split('/').pop(), ctx: j.text.slice(Math.max(0, m.index - 500), m.index + 900) }); break; } } catch {} if (out.contexts.length > 4) break; }
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/ter-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.scripts, out.contexts.length, out.htmlHints.length);
