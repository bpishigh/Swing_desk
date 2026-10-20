// One-off: S&P 500 share above its 50-day average from Nasdaq's public history, for the dates you typed (29 Sep, 1 Oct) and the latest.
import { readFileSync, writeFileSync } from 'node:fs';
import { nasdaqBars } from './nasdaq.mjs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const html = await (await fetch('https://stockanalysis.com/list/sp-500-stocks/', { headers: { 'user-agent': UA, accept: 'text/html' } })).text();
const syms = [...new Set([...html.matchAll(/href="\/stocks\/([a-z.\-]+)\/"/g)].map((m) => m[1].toUpperCase()))];
const DATES = ['2026-09-29', '2026-10-01', '2026-10-09'];
const res = Object.fromEntries(DATES.map((d) => [d, { up: 0, n: 0 }]));
const failed = []; const t0 = Date.now();
let next = 0;
async function worker() {
  while (next < syms.length) {
    const s = syms[next++];
    if (Date.now() - t0 > 17 * 60e3) { failed.push(`${s}: out of time`); continue; }
    try {
      const { bars } = await nasdaqBars(s.replace('-', '.'), 'stocks', '2026-06-01', '2026-10-10');
      const close = bars.map((b) => b[4]), dates = bars.map((b) => b[0]);
      for (const D of DATES) {
        const i = dates.indexOf(D); if (i < 49) continue;
        const m = close.slice(i - 49, i + 1).reduce((a, b) => a + b, 0) / 50;
        res[D].n++; if (close[i] > m) res[D].up++;
      }
    } catch (e) { failed.push(`${s}: ${String(e.message).slice(0, 40)}`); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const out = { ts: new Date().toISOString(), listed: syms.length, seconds: Math.round((Date.now() - t0) / 1000), results: Object.fromEntries(DATES.map((d) => [d, { ...res[d], pct: Math.round((1000 * res[d].up) / res[d].n) / 10 }])), failedCount: failed.length, failed: failed.slice(0, 40) };
writeFileSync('data/source-test/breadth-us-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.results), out.listed, out.failedCount);
