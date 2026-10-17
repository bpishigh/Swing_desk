// Probe 3: find how AMFI's site calls its TER API by reading its own page scripts. Writes data/source-test/ter-probe.json.
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const get = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); return { status: r.status, text: await r.text() }; };
const out = { links: [], pages: [], contexts: [] };
const home = await get('https://www.amfiindia.com/'); 
const hrefs = [...new Set([...home.text.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))];
out.links = hrefs.filter((h) => /ter|expense|other-?data/i.test(h)).slice(0, 40);
const cands = new Set(out.links.filter((h) => !/^https?:/.test(h) || /amfiindia/.test(h)).map((h) => (h.startsWith('http') ? h : 'https://www.amfiindia.com' + h)));
['https://www.amfiindia.com/otherdata', 'https://www.amfiindia.com/otherdata/ter-of-mf-schemes', 'https://www.amfiindia.com/ter-of-mf-schemes'].forEach((u) => cands.add(u));
const scripts = new Set();
for (const u of [...cands].slice(0, 12)) { try { const p = await get(u); out.pages.push({ u, status: p.status, bytes: p.text.length }); for (const m of p.text.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)) scripts.add('https://www.amfiindia.com' + m[1]); } catch (e) { out.pages.push({ u, error: String(e.message) }); } }
for (const m of home.text.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)) scripts.add('https://www.amfiindia.com' + m[1]);
let n = 0;
for (const u of scripts) { if (n++ > 60) break; try { const j = await get(u); for (const m of j.text.matchAll(/te-rdata|populate-ter|TER|expense-ratio/gi)) { out.contexts.push({ u: u.split('/').pop(), ctx: j.text.slice(Math.max(0, m.index - 300), m.index + 500) }); if (out.contexts.length > 12) break; } } catch {} if (out.contexts.length > 12) break; }
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/ter-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.links.length, out.pages.length, out.contexts.length);
