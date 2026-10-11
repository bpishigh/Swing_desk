// Repo Desk India breadth: share of the Nifty 500 above its 50-day average, from the stored NSE daily files (data/india/bhav).
// Writes data/india/breadth.json {date: {pct, n, skipped, src}} for every stored session in the last 45 that is missing. Idempotent.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { pctAbove50 } from '../src/ingest/breadth.ts';
const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const LIST = 'https://archives.nseindia.com/content/indices/ind_nifty500list.csv';
let symbols;
try {
  const r = await fetch(LIST, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' } });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const lines = (await r.text()).trim().split('\n');
  if (!/^Company Name,Industry,Symbol/.test(lines[0])) throw new Error('unexpected header');
  symbols = lines.slice(1).map((l) => l.split(',')[2]?.trim()).filter(Boolean);
  if (symbols.length < 450) throw new Error(`only ${symbols.length} symbols`);
  writeFileSync('data/india/nifty500.json', JSON.stringify({ fetchedAt: new Date().toISOString(), src: LIST, count: symbols.length, symbols }, null, 1) + '\n');
} catch (e) {
  const c = read('data/india/nifty500.json', null);
  if (!c) { console.error(`Nifty 500 list unavailable (${e.message}) and none cached`); process.exit(1); }
  symbols = c.symbols; console.log(`list fetch failed (${e.message}); using the copy from ${c.fetchedAt}`);
}
const files = readdirSync('data/india/bhav').filter((f) => f.endsWith('.json')).sort();
const days = files.map((f) => JSON.parse(readFileSync(`data/india/bhav/${f}`, 'utf8')));
const want = new Set(symbols);
const all = {};
for (const d of days) for (const [s, r] of Object.entries(d.rows)) { if (!want.has(s)) continue; (all[s] ||= { dates: [], closes: [] }); all[s].dates.push(d.date); all[s].closes.push(r[5]); }
const out = read('data/india/breadth.json', {});
let added = 0;
for (const d of days.slice(-45)) {
  if (out[d.date]) continue;
  const b = pctAbove50(all, d.date);
  if (b && b.n >= 400) { out[d.date] = { pct: b.pct, n: b.n, skipped: b.skipped, src: 'Nifty 500 list (NSE) and stored NSE daily closes' }; added++; }
}
mkdirSync('data/india', { recursive: true });
writeFileSync('data/india/breadth.json', JSON.stringify(Object.fromEntries(Object.entries(out).sort()), null, 1) + '\n');
const last = Object.keys(out).sort().pop();
console.log(`breadth: ${added} day(s) added; latest ${last} = ${out[last]?.pct}% of ${out[last]?.n}`);
