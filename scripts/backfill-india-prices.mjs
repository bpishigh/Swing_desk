// Back-fills daily CLOSES for every NSE stock (no other columns) from NSE's daily all-stock file, month by month, oldest first, resumable.
// Output: data/india/prices-hist/YYYY-MM.json = { dates: [...], px: { SYMBOL: [close|null per date] }, done: true } (public data; used by the Portfolio value history).
// The raw daily files are not kept (the main store keeps those only from Oct 2025), so this adds about 4 to 5 MB a year, not 37.
// Usage: node scripts/backfill-india-prices.mjs [--from=2021-04-01] [--to=YYYY-MM-DD] [--months=N] [--offline=<folder of sec_bhavdata_full_DDMMYYYY.csv>]
// --to defaults to the day before the first stored daily file. Prints one JSON line: { months, fetched, skippedHolidays }.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBhavcopy } from '../src/ingest/india-stocks.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const OUT = 'data/india/prices-hist', OFFLINE = arg('offline');
const first = readdirSync('data/india/bhav').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort()[0]?.slice(0, 10) ?? '2999-01-01';
const FROM = arg('from') || '2021-04-01';
const TO = arg('to') || new Date(Date.parse(first) - 86400000).toISOString().slice(0, 10);
const MAXM = Number(arg('months') || 100);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.nseindia.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ddmmyyyy = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;

/** csv text, or null when the file does not exist (a holiday). Throws on anything else after retries. */
async function getFile(iso) {
  const name = `sec_bhavdata_full_${ddmmyyyy(iso)}.csv`;
  if (OFFLINE) { const p = join(OFFLINE, name); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
  let lastErr, sawMissing = false;
  for (const host of ['archives.nseindia.com', 'nsearchives.nseindia.com']) {
    for (let a = 0; a < 3; a++) {
      try {
        const res = await fetch(`https://${host}/products/content/${name}`, { headers: H, redirect: 'follow' });
        if (res.status === 404) { sawMissing = true; break; }
        if (!res.ok) { lastErr = new Error(`${host} ${res.status}`); await sleep(2000 * (a + 1)); continue; }
        const text = await res.text();
        if (/^\s*<(!doctype|html)/i.test(text)) { if (sawMissing) break; lastErr = new Error(`${host} returned HTML instead of CSV`); await sleep(2000 * (a + 1)); continue; }
        return text;
      } catch (e) { lastErr = e; await sleep(2000 * (a + 1)); }
    }
  }
  if (sawMissing) return null;
  throw lastErr;
}

const monthsList = []; for (let d = new Date(FROM.slice(0, 7) + '-01T00:00:00Z'); d.toISOString().slice(0, 10) <= TO; d.setUTCMonth(d.getUTCMonth() + 1)) monthsList.push(d.toISOString().slice(0, 7));
mkdirSync(OUT, { recursive: true });
let doneMonths = 0, fetched = 0, holidays = 0;
for (const m of monthsList) {
  const path = join(OUT, m + '.json');
  if (existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).done) continue;
  if (doneMonths >= MAXM) break;
  const dates = [], rows = [];
  const start = m + '-01', end = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
  for (let d = new Date(start + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso < FROM || iso > TO || [0, 6].includes(d.getUTCDay())) continue;
    const text = await getFile(iso);
    if (text === null) { holidays++; continue; }
    let day; try { day = parseBhavcopy(text); } catch (e) { console.error(iso, e.message); continue; }
    if (day.date !== iso) { holidays++; continue; }            // NSE has served the previous session under a holiday's file name
    dates.push(iso); rows.push(day.rows); fetched++;
    if (!OFFLINE) await sleep(250);
  }
  const px = {};
  rows.forEach((r, i) => { for (const [sym, row] of Object.entries(r)) (px[sym] ??= new Array(dates.length).fill(null))[i] = row[5]; });
  writeFileSync(path, JSON.stringify({ dates, px, done: true }) + '\n');
  doneMonths++;
}
console.log(JSON.stringify({ months: doneMonths, fetched, skippedHolidays: holidays, from: FROM, to: TO }));
