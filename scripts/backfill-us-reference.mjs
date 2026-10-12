// One-off with the back-fill: splits since the window start and the tickers reference list (type, active flag, composite FIGI),
// stored with an as-of date. Records the HTTP status of each call so we learn whether the reference endpoint is free on our plan.
import { writeFileSync, mkdirSync } from 'node:fs';
const key = process.env.POLYGON_KEY; if (!key) { console.error('POLYGON_KEY missing'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const asOf = new Date().toISOString().slice(0, 10);
async function get(url) {
  await sleep(13000);
  const u = url.includes('apiKey=') ? url : url + (url.includes('?') ? '&' : '?') + 'apiKey=' + key;
  const r = await fetch(u); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, msg: j ? (j.message || j.error || '') : t.slice(0, 120) };
}
mkdirSync('data/us', { recursive: true });
const log = { asOf, splits: { status: null, n: 0 }, tickers: { status: null, n: 0, pages: 0, msg: '' } };
const from = new Date(Date.now() - 740 * 86400000).toISOString().slice(0, 10);
let url = `https://api.polygon.io/v3/reference/splits?execution_date.gte=${from}&limit=1000&order=asc&sort=execution_date`;
const splits = [];
for (let p = 0; p < 10 && url; p++) {
  const r = await get(url); log.splits.status = r.status; if (r.status !== 200) { log.splits.msg = String(r.msg); break; }
  for (const x of r.j.results ?? []) splits.push([x.ticker, x.execution_date, x.split_from, x.split_to]);
  url = r.j.next_url ?? null;
}
log.splits.n = splits.length;
writeFileSync('data/us/splits.json', JSON.stringify({ asOf, from, rows: splits }));
const tick = [];
url = 'https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000';
for (let p = 0; p < 40 && url; p++) {
  const r = await get(url); log.tickers.status = r.status; log.tickers.pages = p + 1;
  if (r.status !== 200) { log.tickers.msg = String(r.msg); break; }
  for (const x of r.j.results ?? []) tick.push([x.ticker, x.type ?? '', x.primary_exchange ?? '', x.composite_figi ?? '', x.share_class_figi ?? '']);
  url = r.j.next_url ?? null;
}
log.tickers.n = tick.length;
if (tick.length) writeFileSync(`data/us/tickers-${asOf}.json`, JSON.stringify({ asOf, cols: ['ticker', 'type', 'exch', 'composite_figi', 'share_class_figi'], rows: tick }));
writeFileSync('data/us/reference-log.json', JSON.stringify(log, null, 1) + '\n');
console.log(JSON.stringify(log));
