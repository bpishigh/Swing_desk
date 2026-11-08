// One-off (filings loader, build step 1): saves one real XBRL results file per format family, plus a tag census over a wider sample, so the parser and tag maps are built on real files.
// Public exchange filings only. Writes fixtures/filings/<family>-<basis>.xml (up to 2 per family) and data/filings-tag-census.json.
import { mkdirSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { ...UA, referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u, h = UA) => { try { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(90000) }); return { status: r.status, t: await r.text() }; } catch { return { status: 0, t: '' }; } };
const arr = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : j.data || []; } catch { return []; } };
const TYPE = encodeURIComponent('Integrated Filing- Financials');
mkdirSync('fixtures/filings', { recursive: true });
let all = []; for (let p = 1; p <= 12; p++) { const a = arr((await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&period_ended=31-Mar-2026&page=${p}&size=500`, NSEH)).t); if (!a.length) break; all = all.concat(a); await sleep(300); }
const fam = (x) => (x.match(/<!--\s*(\w+)/) || [])[1] || 'unknown';
const census = {}, saved = {}, ex = {};
const pool = all.filter((_, i) => i % Math.ceil(all.length / 400) === 0).slice(0, 400);
// make sure rarer families are sampled: add every 5th record again from a different offset
for (const rec of [...pool, ...all.filter((_, i) => i % 7 === 3).slice(0, 250)]) {
  const r = await get(rec.xbrl); if (r.status !== 200) { await sleep(120); continue; }
  const f = fam(r.t), basis = /^Consolidated/i.test(rec.consolidated) ? 'consolidated' : 'standalone', key = `${f}-${basis}`;
  const c = (census[f] = census[f] || { n: 0, tags: {} }); c.n++;
  for (const m of new Set([...r.t.matchAll(/<(in-[\w-]+):(\w+)\b[^>]*contextRef="OneD"/g)].map((x) => x[2]))) c.tags[m] = (c.tags[m] || 0) + 1;
  if ((saved[key] || 0) < 1) { writeFileSync(`fixtures/filings/${key}.xml`, r.t); saved[key] = 1; ex[key] = rec.smName || rec.symbol; }
  await sleep(120);
}
const out = { at: new Date().toISOString(), period: '31-Mar-2026', total: all.length, families: Object.fromEntries(Object.entries(census).map(([f, c]) => [f, { n: c.n, tags: Object.fromEntries(Object.entries(c.tags).sort((a, b) => b[1] - a[1]).slice(0, 80)) }])), fixtures: ex };
writeFileSync('data/filings-tag-census.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ families: Object.fromEntries(Object.entries(census).map(([f, c]) => [f, c.n])), fixtures: ex }));
