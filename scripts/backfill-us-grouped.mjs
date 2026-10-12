// Back-fill (and nightly extend) of Massive (Polygon) US grouped daily bars on the free plan.
// Stores UNADJUSTED bars for every US stock per day (T,c,h,l,v) as gzipped CSV in data/us/grouped/YYYY-MM-DD.csv.gz,
// because adjusted values change after any later split; splits are stored separately and applied at read time.
// Free plan: 5 calls a minute (13 s spacing), about 2 years of history. Resumable: existing days are skipped.
// Walks oldest first, since the oldest days leave the free window first. Days the plan refuses (403) are recorded and not retried.
// Usage: node scripts/backfill-us-grouped.mjs [maxCalls]   (key from POLYGON_KEY, never printed)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const key = process.env.POLYGON_KEY;
if (!key) { console.error('POLYGON_KEY missing'); process.exit(1); }
const maxCalls = Number(process.argv[2] || 110);
const dir = 'data/us/grouped';
mkdirSync(dir, { recursive: true });
const metaPath = 'data/us/grouped-meta.json';
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : { noData: [], refused: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => d.toISOString().slice(0, 10);
let calls = 0, lastCall = 0;
async function get(path) {
  const wait = 13000 - (Date.now() - lastCall); if (wait > 0) await sleep(wait);
  lastCall = Date.now(); calls++;
  const sep = path.includes('?') ? '&' : '?';
  for (let a = 0; a < 3; a++) {
    const r = await fetch(`https://api.polygon.io${path}${sep}apiKey=${key}`);
    if (r.status === 429) { await sleep(65000); lastCall = Date.now(); continue; }
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
    return { status: r.status, j };
  }
  return { status: 429, j: null };
}
const start = new Date(Date.now() - 735 * 86400000), end = new Date(Date.now() - 86400000);
let done = 0, fetched = 0, size = 0;
for (let d = new Date(start); d <= end && calls < maxCalls; d.setUTCDate(d.getUTCDate() + 1)) {
  if ([0, 6].includes(d.getUTCDay())) continue;
  const day = iso(d), f = `${dir}/${day}.csv.gz`;
  if (existsSync(f) || meta.noData.includes(day) || meta.refused.includes(day)) continue;
  const g = await get(`/v2/aggs/grouped/locale/us/market/stocks/${day}?adjusted=false`);
  if (g.status === 403) { meta.refused.push(day); continue; }
  if (g.status !== 200) { console.log(`${day}: status ${g.status}, stopping`); break; }
  const rows = g.j?.results ?? [];
  if (!rows.length) { meta.noData.push(day); continue; } // holiday or no trading
  const csv = 'T,c,h,l,v\n' + rows.map((x) => `${x.T},${x.c},${x.h},${x.l},${x.v}`).join('\n') + '\n';
  const gz = gzipSync(csv, { level: 9 }); writeFileSync(f, gz); size += gz.length; fetched++;
}
meta.noData.sort(); meta.refused.sort();
writeFileSync(metaPath, JSON.stringify(meta));
console.log(JSON.stringify({ calls, fetched, avgKB: fetched ? Math.round(size / fetched / 1024) : 0, refused: meta.refused.length, noData: meta.noData.length }));
// exit code 0 always; a later run resumes
