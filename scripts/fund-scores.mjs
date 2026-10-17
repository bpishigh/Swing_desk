// Weekly fund scoring (phase 1): fetch NAV history from mfapi.in for Direct-Growth equity/hybrid/index schemes, score them within their category,
// write data/funds/scores.json (public data) and the monthly band history for the Replace hysteresis. Usage: node scripts/fund-scores.mjs [--limit N]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normCategory, scorable, scoreAll, replaceCandidate } from '../src/pm/fundscore.ts';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const amfi = J('data/rules/amfi-schemes.json');
const asOf = new Date().toISOString().slice(0, 10);
const recent = (s) => { const [d, m, y] = s.split('-'); const t = Date.parse(`${d} ${m} ${y} UTC`); return Number.isFinite(t) && Date.now() - t < 12 * 86400000; };
let schemes = amfi.rows.filter((r) => /^Direct/i.test(r[5]) && /^Growth/i.test(r[6]) && recent(r[8]) && scorable(normCategory(r[4]))).map((r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] }));
const lim = process.argv.indexOf('--limit'); if (lim > 0) schemes = schemes.slice(0, Number(process.argv[lim + 1]));
console.log('schemes to fetch', schemes.length);
const series = new Map(); let failed = 0, next = 0;
async function worker() {
  while (next < schemes.length) {
    const s = schemes[next++];
    for (let a = 0; a < 3; a++) {
      try {
        const r = await fetch('https://api.mfapi.in/mf/' + s.code); if (!r.ok) throw new Error('status ' + r.status);
        const j = await r.json(); const m = {};
        for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; }
        if (Object.keys(m).length) series.set(s.code, m); break;
      } catch (e) { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log('fetched', series.size, 'failed', failed);
if (series.size < schemes.length * 0.8) { console.error('too many fetch failures; keeping the previous scores'); process.exit(1); }
const scored = scoreAll(schemes, series, asOf);
const hist = J('data/funds/history.json', {});
const month = asOf.slice(0, 7);
hist[month] = Object.fromEntries(scored.filter((x) => x.band).map((x) => [x.code, x.band]));
for (const x of scored) if (x.band === 'Weak' && replaceCandidate(hist, x.code)) x.replace = true;
mkdirSync('data/funds', { recursive: true });
const cats = {}; for (const x of scored) cats[x.cat] = (cats[x.cat] || 0) + 1;
writeFileSync('data/funds/scores.json', JSON.stringify({ asOf, version: 'FUND-1', source: 'AMFI scheme list; NAV history from mfapi.in', funds: scored.map((x) => ({ ...x })), categories: cats }) + '\n');
writeFileSync('data/funds/history.json', JSON.stringify(hist) + '\n');
console.log('categories', Object.keys(cats).length, 'scored', scored.filter((x) => x.score !== null).length);
