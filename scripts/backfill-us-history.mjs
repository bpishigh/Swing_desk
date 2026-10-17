// US price history from Nasdaq's public quote API: about 10 years of daily bars for today's liquid common stocks and ADRs. Listed names only: delisted tickers are
// not served (survivorship bias, accepted by the owner 17 Oct 2026; every test using this store must say so). Prices and highs/lows are split-adjusted by Nasdaq.
// Resumable: a symbol whose file already runs to the target date is skipped. Usage: node scripts/backfill-us-history.mjs [--new-only] [--from=YYYY-MM-DD] [--limit=N] [--workers=5] [--sym=A,B]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { nasdaqBars } from './nasdaq.mjs';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const FROM = arg('from', new Date(Date.now() - 3653 * 864e5).toISOString().slice(0, 10)), LIMIT = Number(arg('limit', 1e9)), WORKERS = Number(arg('workers', 5));
const files = readdirSync('data/us/grouped').filter((f) => /\.csv\.gz$/.test(f)).sort(), last = files[files.length - 1].slice(0, 10);
const tk = readdirSync('data/us').filter((f) => /^tickers-.*\.json$/.test(f)).sort().pop();
const okType = new Set(['CS', 'ADRC']), types = new Set(JSON.parse(readFileSync('data/us/' + tk, 'utf8')).rows.filter((r) => okType.has(r[1])).map((r) => r[0]));
// liquidity today: 20-day mean dollar volume of at least $10M and price of at least $10 (the scan's own floors)
const dv = new Map(), px = new Map();
for (const f of files.slice(-20)) { const L = gunzipSync(readFileSync('data/us/grouped/' + f)).toString().split('\n'); for (let i = 1; i < L.length; i++) { const p = L[i].split(','); if (p.length < 5) continue; dv.set(p[0], (dv.get(p[0]) ?? 0) + +p[1] * +p[4] / 20); px.set(p[0], +p[1]); } }
let syms = arg('sym', '') ? arg('sym').split(',') : [...dv].filter(([s, v]) => v >= 10e6 && px.get(s) >= 10 && types.has(s)).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
syms = syms.slice(0, LIMIT);
mkdirSync('data/us/hist', { recursive: true });
const path = (s) => `data/us/hist/${s.replace(/[^A-Z0-9.\-]/g, '_')}.json.gz`;
const NEW_ONLY = process.argv.includes('--new-only');   // monthly: only symbols with no file yet (the nightly tails keep existing ones current)
const todo = syms.filter((s) => { if (!existsSync(path(s))) return true; if (NEW_ONLY) return false; try { return JSON.parse(gunzipSync(readFileSync(path(s)))).to < last; } catch { return true; } });
console.log(`target ${last}; ${syms.length} liquid symbols, ${todo.length} to fetch from ${FROM}`);
let next = 0, done = 0; const failed = [], empty = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function worker() {
  while (next < todo.length) {
    const s = todo[next++]; let g = null;
    for (let a = 0; a < 4 && !g; a++) { try { g = await nasdaqBars(s.replace('-', '.'), 'stocks', FROM); } catch { await sleep(1500 * (a + 1)); } }
    if (!g) { failed.push(s); continue; }
    if (!g.bars.length) { empty.push(s); continue; }
    const bars = g.bars.map((b) => [b[0], b[4], b[2], b[3], b[5]]);   // date, close, high, low, volume
    writeFileSync(path(s), gzipSync(JSON.stringify({ sym: s, from: bars[0][0], to: bars[bars.length - 1][0], src: 'nasdaq', bars })));
    if (++done % 200 === 0) console.log(`${done}/${todo.length}`);
    await sleep(150);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log(JSON.stringify({ fetched: done, failed: failed.length, empty: empty.length, failedList: failed.slice(0, 40), emptyList: empty.slice(0, 40) }));
if (!existsSync('data/us/hist-through.json') && done) writeFileSync('data/us/hist-through.json', JSON.stringify({ through: JSON.parse(gunzipSync(readFileSync(path(syms[0])))).to }) + '\n');
writeFileSync('data/us/hist-meta.json', JSON.stringify({ at: new Date().toISOString(), target: last, from: FROM, symbols: syms.length, failed, empty }) + '\n');
