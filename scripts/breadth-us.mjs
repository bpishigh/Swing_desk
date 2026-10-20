// Repo Desk US breadth: share of the S&P 500 above its 50-day average (the S5FI definition), from Nasdaq's public history.
// Usage: node scripts/breadth-us.mjs [--date=YYYY-MM-DD]   Writes data/us/breadth.json {date: {pct, n, skipped, src}} for the target day and any of the last 30 sessions missing.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { makeCalendar } from '../src/engine/calendar.ts';
import { etParts, usTarget } from '../src/ingest/us-plan.ts';
import { pctAbove50 } from '../src/ingest/breadth.ts';
import { nasdaqBars } from './nasdaq.mjs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const cal = makeCalendar(loadCalendarFiles().us.holidays);
const D = (process.argv.find((a) => a.startsWith('--date=')) || '').slice(7) || usTarget(Date.now(), cal).target;
const LIST = 'https://stockanalysis.com/list/sp-500-stocks/';
let symbols;
try {
  const r = await fetch(LIST, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const html = await r.text();
  const rows = html.split('<tr').slice(1).filter((t) => /href="\/stocks\/[a-z.\-]+\/"/.test(t));   // table rows only: page navigation also links to /stocks/ pages
  symbols = [...new Set(rows.map((t) => t.match(/href="\/stocks\/([a-z.\-]+)\/"/)[1].toUpperCase()))];
  if (symbols.length < 480) throw new Error(`only ${symbols.length} symbols`);
  writeFileSync('data/us/sp500.json', JSON.stringify({ fetchedAt: new Date().toISOString(), src: LIST, count: symbols.length, symbols }, null, 1) + '\n');
} catch (e) {
  const c = read('data/us/sp500.json', null);
  if (!c) { console.error(`S&P 500 list unavailable (${e.message}) and none cached`); process.exit(1); }
  symbols = c.symbols; console.log(`list fetch failed (${e.message}); using the copy from ${c.fetchedAt}`);
}
const from = new Date(Date.parse(D) - 110 * 864e5).toISOString().slice(0, 10);
const all = {}; const failed = []; let next = 0;
async function worker() {
  while (next < symbols.length) {
    const s = symbols[next++];
    try {
      let g; try { g = await nasdaqBars(s.replace('-', '.'), 'stocks', from, D); } catch { await new Promise((r) => setTimeout(r, 1500)); g = await nasdaqBars(s.replace('-', '.'), 'stocks', from, D); }
      all[s] = { dates: g.bars.map((b) => b[0]), closes: g.bars.map((b) => b[4]) };
    } catch (e) { failed.push(s); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const out = read('data/us/breadth.json', {});
const have = Object.values(all).filter((s) => s.dates.includes(D)).length;
console.log(`${Object.keys(all).length} stocks fetched, ${have} have ${D}, ${failed.length} failed`);
if (have < 400) { console.error(`only ${have} stocks have ${D} yet; not writing`); process.exit(1); }
let added = 0, d = D;
for (let k = 0; k < 30; k++, d = cal.prevSession(d)) {
  if (out[d] && d !== D) continue;
  const b = pctAbove50(all, d);
  if (b && b.n >= 400) { out[d] = { pct: b.pct, n: b.n, skipped: b.skipped, src: 'S&P 500 list (StockAnalysis) and Nasdaq public daily closes' }; added++; }
}
mkdirSync('data/us', { recursive: true });
writeFileSync('data/us/breadth.json', JSON.stringify(Object.fromEntries(Object.entries(out).sort()), null, 1) + '\n');
console.log(`breadth: ${added} day(s) written; ${D} = ${out[D]?.pct}% of ${out[D]?.n}`);
