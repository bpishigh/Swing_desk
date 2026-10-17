// Nightly: add the sessions after the stored base from Nasdaq's public history to data/us/hist-tail/<date>.json.gz (one small file a day), for the symbols in the base store.
// A symbol whose overlap bars disagree with the base (a split Nasdaq has since applied) has its base file re-fetched in full. Writes nothing for a date until AAPL has it and 90% of symbols returned it.
// Usage: node scripts/us-hist-update.mjs [--workers=5]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { nasdaqBars } from './nasdaq.mjs';
import { histSymbols, readBase, tailDates } from './us-hist-lib.mjs';
const WORKERS = Number((process.argv.find((a) => a.startsWith('--workers=')) || '--workers=5').slice(10));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const syms = histSymbols();
const through = existsSync('data/us/hist-through.json') ? JSON.parse(readFileSync('data/us/hist-through.json', 'utf8')).through : readBase('AAPL').to;   // the last date of the one-run base; fixed, so a re-fetched symbol never moves it
const FROM_FULL = readBase('AAPL').from, from = new Date(Date.parse(through) - 10 * 864e5).toISOString().slice(0, 10);
const have = new Set(tailDates());
const probe = await nasdaqBars('AAPL', 'stocks', from);
const newDates = probe.bars.map((b) => b[0]).filter((d) => d > through && !have.has(d));
console.log(`base through ${through}; tails ${[...have].join(',') || 'none'}; new sessions available ${newDates.join(',') || 'none'}`);
if (!newDates.length) process.exit(0);
const rows = new Map(newDates.map((d) => [d, []])), flagged = []; let next = 0, failed = 0;
async function worker() {
  while (next < syms.length) {
    const s = syms[next++]; let g = null;
    for (let a = 0; a < 3 && !g; a++) { try { g = await nasdaqBars(s.replace('-', '.'), 'stocks', from); } catch { await sleep(1200 * (a + 1)); } }
    if (!g) { failed++; continue; }
    const base = new Map(readBase(s).bars.map((b) => [b[0], b[1]]));
    let bad = false;
    for (const b of g.bars) {
      const [d, , h, l, c, v] = [b[0], b[1], b[2], b[3], b[4], b[5]];
      if (base.has(d)) { if (Math.abs(c / base.get(d) - 1) > 0.003) bad = true; }
      else if (rows.has(d)) rows.get(d).push([s, c, h, l, v]);
    }
    if (bad) flagged.push(s);
    await sleep(120);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
for (const s of flagged) {    // split or restatement: replace the base file with a fresh full history
  let g = null; for (let a = 0; a < 3 && !g; a++) { try { g = await nasdaqBars(s.replace('-', '.'), 'stocks', FROM_FULL); } catch { await sleep(1500); } }
  if (g?.bars.length) { const bars = g.bars.map((b) => [b[0], b[4], b[2], b[3], b[5]]); writeFileSync(`data/us/hist/${s}.json.gz`, gzipSync(JSON.stringify({ sym: s, from: bars[0][0], to: bars[bars.length - 1][0], src: 'nasdaq', bars }))); }
}
mkdirSync('data/us/hist-tail', { recursive: true });
let wrote = 0;
for (const [d, r] of rows) {
  if (r.length >= 0.9 * syms.length) { writeFileSync(`data/us/hist-tail/${d}.json.gz`, gzipSync(JSON.stringify({ date: d, rows: r }))); wrote++; console.log(`${d}: ${r.length}/${syms.length}`); }
  else console.log(`${d}: only ${r.length}/${syms.length}, not written (retry next run)`);
}
console.log(JSON.stringify({ wrote, failed, flaggedForRefetch: flagged.length, flagged: flagged.slice(0, 20) }));
