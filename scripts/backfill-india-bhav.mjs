// India price history back-fill (backtester data, step 1). Downloads NSE's daily all-stock file for every day in a range and keeps it as
// data/india/bhav-hist/YYYY-MM-DD.json.gz (same shape as data/india/bhav/*.json: { date, rows }). Resumable: stored days are skipped.
// Every weekday and weekend is tried; a 404 means no session (holiday or weekend). A file whose own date differs from the file name is not stored.
// --format=old reads NSE's old file (cmDDMONYYYYbhav.csv.zip, used to 2019) for 2010 to 2019; the stored shape is the same (the delivery share is null).
// Usage: node scripts/backfill-india-bhav.mjs --from=2020-01-01 --to=2025-10-16 [--max=N] [--out=data/india/bhav-hist] [--format=new|old]
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { inflateRawSync } from 'node:zlib';
import { parseBhavcopy, parseOldBhavcopy } from '../src/ingest/india-stocks.ts';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const FROM = arg('from', '2020-01-01'), TO = arg('to', '2025-10-16'), MAX = Number(arg('max', 100000)), OUT = arg('out', 'data/india/bhav-hist'), OLD = arg('format', 'new') === 'old';
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const unzipFirst = (b) => { if (b.readUInt32LE(0) !== 0x04034b50) throw new Error('not a zip'); const n = b.readUInt16LE(26), e = b.readUInt16LE(28), cs = b.readUInt32LE(18), m = b.readUInt16LE(8), d = b.subarray(30 + n + e, cs ? 30 + n + e + cs : undefined); return (m === 8 ? inflateRawSync(d) : d).toString('utf8'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ddmmyyyy = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: '*/*', referer: 'https://www.nseindia.com/' };
mkdirSync(OUT, { recursive: true });
const have = new Set(readdirSync(OUT).filter((f) => f.endsWith('.json.gz')).map((f) => f.slice(0, 10)));
const missPath = `${OUT}/no-file.json`;
const none = new Set(existsSync(missPath) ? JSON.parse(readFileSync(missPath, 'utf8')) : []);

async function getFile(iso) {
  const name = OLD ? `cm${iso.slice(8, 10)}${MON[+iso.slice(5, 7) - 1]}${iso.slice(0, 4)}bhav.csv.zip` : `sec_bhavdata_full_${ddmmyyyy(iso)}.csv`;
  const path = OLD ? `content/historical/EQUITIES/${iso.slice(0, 4)}/${MON[+iso.slice(5, 7) - 1]}/${name}` : `products/content/${name}`;
  let lastErr, sawMissing = false;
  for (const host of ['archives.nseindia.com', 'nsearchives.nseindia.com']) {
    for (let a = 0; a < 3; a++) {
      try {
        const res = await fetch(`https://${host}/${path}`, { headers: H, redirect: 'follow' });
        if (res.status === 404) { sawMissing = true; break; }
        if (!res.ok) { lastErr = new Error(`${host} ${res.status}`); await sleep(2000 * (a + 1)); continue; }
        const text = OLD ? unzipFirst(Buffer.from(await res.arrayBuffer())) : await res.text();
        if (/^\s*<(!doctype|html)/i.test(text)) { if (sawMissing) break; lastErr = new Error(`${host} HTML`); await sleep(2000 * (a + 1)); continue; }
        return text;
      } catch (e) { lastErr = e; await sleep(2000 * (a + 1)); }
    }
  }
  if (sawMissing) return null;
  throw lastErr;
}

let stored = 0, nofile = 0, wrong = 0, errors = 0, small = 0;
for (let d = Date.parse(FROM); d <= Date.parse(TO) && stored < MAX; d += 864e5) {
  const iso = new Date(d).toISOString().slice(0, 10);
  if (have.has(iso) || none.has(iso)) continue;
  let text;
  try { text = await getFile(iso); } catch (e) { errors++; console.log(`${iso}: ${e.message}`); continue; }
  if (text === null) { none.add(iso); nofile++; continue; }
  let day; try { day = OLD ? parseOldBhavcopy(text) : parseBhavcopy(text); } catch (e) { errors++; console.log(`${iso}: ${e.message}`); continue; }
  if (day.date !== iso) { none.add(iso); wrong++; continue; }
  if (Object.keys(day.rows).length < 500) { small++; console.log(`${iso}: only ${Object.keys(day.rows).length} stocks, not stored`); continue; }
  writeFileSync(`${OUT}/${iso}.json.gz`, gzipSync(JSON.stringify(day), { level: 9 }));
  stored++; if (stored % 100 === 0) { writeFileSync(missPath, JSON.stringify([...none].sort())); console.log(`stored ${stored}, last ${iso}`); }
  await sleep(250);
}
writeFileSync(missPath, JSON.stringify([...none].sort()));
console.log(JSON.stringify({ from: FROM, to: TO, stored, noFile: nofile, wrongDate: wrong, small, errors, totalOnDisk: have.size + stored }));
process.exit(errors > 20 ? 1 : 0);
