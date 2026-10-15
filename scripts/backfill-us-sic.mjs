// SIC back-fill for the US scan's group step. Writes data/us/sic.json {asOf, rows:[[ticker, sic, description, source]]}. Resumable: tickers already stored are skipped;
// refresh quarterly with --refresh. Wanted tickers: common stocks and ADRs that clear the scan's price and dollar-volume floors on the latest stored day.
// Needs network access to sec.gov (User-Agent required, at most 10 requests a second; we use about 6) and, for the fallback, POLYGON_KEY.
// Usage: node scripts/backfill-us-sic.mjs [--refresh] [--massive=N]   (N = fallback calls to Massive this run, default 40; 13 s apart)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSecTickers, secSubmissionsUrl, parseSecSic, parseMassiveSic } from '../src/ingest/sic.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com';
const MASSIVE_CALLS = Number(arg('massive') ?? 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const file = 'data/us/sic.json';
const old = existsSync(file) && !process.argv.includes('--refresh') ? JSON.parse(readFileSync(file, 'utf8')).rows : [];
const have = new Map(old.map((r) => [r[0], r]));

const tk = JSON.parse(readFileSync('data/us/' + readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop(), 'utf8'));
const okType = new Set(tk.rows.filter((r) => SCAN.types.includes(r[1])).map((r) => r[0]));
const last = readdirSync('data/us/grouped').filter((f) => /\.csv\.gz$/.test(f)).sort().pop();
const wanted = [];
for (const line of gunzipSync(readFileSync('data/us/grouped/' + last)).toString('utf8').split('\n').slice(1)) {
  const p = line.split(','); if (!okType.has(p[0])) continue;
  if (+p[1] >= SCAN.minPrice && +p[1] * +p[4] >= SCAN.minDollarVol) wanted.push(p[0]);
}
const todo = wanted.filter((t) => !have.has(t));
console.log(JSON.stringify({ last, wanted: wanted.length, stored: have.size, todo: todo.length }));
if (!todo.length) process.exit(0);

async function sec(url) { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } }); return r.ok ? r.json() : { __status: r.status }; }
const map = parseSecTickers(await sec('https://www.sec.gov/files/company_tickers.json'));
if (!map.size) { console.error('SEC ticker map not read; stopping (no file written)'); process.exit(1); }
const rows = [...have.values()]; const missing = [];
let fetched = 0, blocked = false;
for (const t of todo) {
  const cik = map.get(t) ?? map.get(t.replace('.', '-'));
  if (!cik) { missing.push(t); continue; }
  const j = await sec(secSubmissionsUrl(cik)); fetched++;
  if (j?.__status === 429 || j?.__status === 403) { console.log('SEC returned ' + j.__status + '; stopping SEC calls'); blocked = true; missing.push(t); break; }
  const s = parseSecSic(j);
  if (s) rows.push([t, s.sic, s.desc, 'sec']); else missing.push(t);
  await sleep(160);
}
if (blocked) for (const t of todo.slice(fetched)) if (!missing.includes(t)) missing.push(t);
let mCalls = 0;
if (process.env.POLYGON_KEY) for (const t of missing) {
  if (mCalls >= MASSIVE_CALLS) break;
  mCalls++; await sleep(13000);
  const r = await fetch(`https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(t)}?apiKey=${process.env.POLYGON_KEY}`);
  if (r.status === 429) { await sleep(65000); continue; }
  if (r.ok) { const s = parseMassiveSic(await r.json()); if (s) { rows.push([t, s.sic, s.desc, 'massive']); } }
}
const done = new Set(rows.map((r) => r[0]));
rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
writeFileSync(file, JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), rows, noSic: todo.filter((t) => !done.has(t)) }) + '\n');
console.log(JSON.stringify({ stored: rows.length, secCalls: fetched, massiveCalls: mCalls, stillWithoutSic: todo.filter((t) => !done.has(t)).length }));
