// Backfill of SEBI PIT insider disclosures (NSE corporates-pit), market-wide, by month window, for the promoter-and-insider history study (docs/replay/INSIDER-PREREG.md). Keeps only promoter/director/KMP rows, compact fields, one gzip per year in data/india/pit/<year>.json.gz. Public data only. Resumable: a month already stored is skipped.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', referer: 'https://www.nseindia.com/', accept: 'application/json,text/plain,*/*' };
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=')[1];
const from = arg('from', '2016-01'), to = arg('to', '2025-12'), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(90000) }); if (r.status === 200) return await r.text(); } catch {} await sleep(2000 * (i + 1)); } return null; };
await get('https://www.nseindia.com/'); await sleep(1000);
const dmy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
mkdirSync('data/india/pit', { recursive: true });
const keep = (r) => { const g = (k) => r[k] ?? r[k.toLowerCase()]; return { s: g('symbol'), d: String(g('date') ?? '').slice(0, 11), f: String(g('acqfromDt') ?? '').slice(0, 11), c: g('personCategory'), t: g('tdpTransactionType'), n: Number(g('secAcq')), v: Number(g('secVal')), m: g('acqMode'), ty: g('secType'), b: Number(g('befAcqSharesPer')), a: Number(g('afterAcqSharesPer')) }; };
let sample = null, bad = [];
for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
  const p = `data/india/pit/${y}.json.gz`; const st = existsSync(p) ? JSON.parse(gunzipSync(readFileSync(p))) : { year: y, months: {}, rows: [] };
  for (let m = 1; m <= 12; m++) { const key = `${y}-${String(m).padStart(2, '0')}`; if (key < from || key > to || st.months[key]) continue;
    const a = new Date(Date.UTC(y, m - 1, 1)), b = new Date(Date.UTC(y, m, 0));
    const t = await get(`https://www.nseindia.com/api/corporates-pit?index=equities&from_date=${dmy(a)}&to_date=${dmy(b)}`); await sleep(700);
    let j; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
    const arr = Array.isArray(j) ? j : j?.data; if (!Array.isArray(arr)) { bad.push(key); continue; }
    if (!sample && arr[0]) sample = arr[0];
    const rows = arr.filter((r) => /promoter|director|key managerial|kmp|immediate relative/i.test(String(r.personCategory ?? ''))).map(keep);
    st.rows.push(...rows); st.months[key] = { total: arr.length, kept: rows.length }; console.log(key, arr.length, rows.length);
    writeFileSync(p, gzipSync(JSON.stringify(st)));
  }
}
if (sample) writeFileSync('data/india/pit/_sample.json', JSON.stringify(sample, null, 1));
if (bad.length) { console.error('FAILED months: ' + bad.join(' ')); process.exit(1); }
