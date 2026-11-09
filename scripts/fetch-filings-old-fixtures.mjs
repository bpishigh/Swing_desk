// One-off (filings loader, older quarters): saves real in-bse-fin XBRL files from the older market-wide results list (by listing flags and basis) and a census of tags and context names, so the second parser is built on real files. Public exchange filings only. Writes fixtures/filings-old/<window>-<flags>.xml and data/filings-old-census.json.
import { mkdirSync, writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.status === 200) return { status: 200, t: await r.text() }; if (r.status === 404) return { status: 404, t: '' }; } catch {} await sleep(1500 * (k + 1)); } return { status: 0, t: '' }; };
await get('https://www.nseindia.com/'); mkdirSync('fixtures/filings-old', { recursive: true });
const windows = { dec2024: ['01-01-2025', '28-02-2025'], mar2022: ['01-04-2022', '30-06-2022'], mar2020: ['01-04-2020', '31-07-2020'] };
const census = {}, listing = {}, saved = {};
for (const [w, [a, b]] of Object.entries(windows)) {
  const R = await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly&from_date=${a}&to_date=${b}`); let rows = []; try { const j = JSON.parse(R.t); rows = Array.isArray(j) ? j : j.data || []; } catch {}
  rows = rows.filter((r) => /^https?:/.test(r.xbrl || '')); const flagsOf = (r) => ['bank', 'indAs', 'reInd', 'format', 'consolidated', 'audited', 'oldNewFlag'].map((k) => `${k}=${r[k]}`).join('|');
  const lc = {}; for (const r of rows) { const k = flagsOf(r); lc[k] = (lc[k] || 0) + 1; } listing[w] = { n: rows.length, flags: Object.fromEntries(Object.entries(lc).sort((x, y) => y[1] - x[1]).slice(0, 30)), periods: [...new Set(rows.map((r) => r.period))].slice(0, 10), dates: rows.slice(0, 3).map((r) => ({ broadCastDate: r.broadCastDate, filingDate: r.filingDate, fromDate: r.fromDate, toDate: r.toDate, cumulative: r.cumulative, difference: r.difference })) };
  const step = Math.max(1, Math.floor(rows.length / 220)); const c = (census[w] = { n: 0, tags: {}, contexts: {}, nsPrefixes: {} });
  for (const r of rows.filter((_, i) => i % step === 0).slice(0, 220)) {
    const x = await get(r.xbrl); await sleep(150); if (x.status !== 200) continue; c.n++;
    for (const m of new Set([...x.t.matchAll(/<(in-[\w-]+):(\w+)\b[^>]*contextRef="([^"]+)"/g)].map((m) => m[2]))) c.tags[m] = (c.tags[m] || 0) + 1;
    for (const m of new Set([...x.t.matchAll(/<xbrli:context id="([^"]+)"/g)].map((m) => m[1].replace(/\d{4,}/g, 'N')))) c.contexts[m] = (c.contexts[m] || 0) + 1;
    const key = `${w}-${flagsOf(r).replace(/[^\w=|]/g, '').slice(0, 60).replace(/\|/g, '_')}`; if ((saved[key] || 0) < 1 && Object.keys(saved).length < 24) { writeFileSync(`fixtures/filings-old/${key}.xml`, x.t); saved[key] = 1; }
  }
  c.tags = Object.fromEntries(Object.entries(c.tags).sort((x, y) => y[1] - x[1]).slice(0, 120)); c.contexts = Object.fromEntries(Object.entries(c.contexts).sort((x, y) => y[1] - x[1]).slice(0, 30));
}
writeFileSync('data/filings-old-census.json', JSON.stringify({ at: new Date().toISOString(), listing, census, fixtures: Object.keys(saved) }, null, 1) + '\n'); console.log(JSON.stringify({ fixtures: Object.keys(saved), n: Object.fromEntries(Object.entries(census).map(([k, v]) => [k, v.n])) }));
