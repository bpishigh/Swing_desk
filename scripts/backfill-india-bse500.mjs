// India index history, BSE 500 (backtester data, regime stand-in for Jan 2010 to Feb 2012, before NSE's index files start on 27 Feb 2012, and a cross-check afterwards).
// BSE's archive API returns at most 26 rows per request, so one request per calendar month is made. Stored in data/india/idx-hist/idx-YYYY.json under the name "BSE 500"
// in the same shape as the NSE series: { "BSE 500": { "YYYY-MM-DD": [open, high, low, close, volume] } }. Resumable: a month already complete in the file is skipped.
// Usage: node scripts/backfill-india-bse500.mjs [--from=2010-01] [--to=2019-12]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const FROM = arg('from', '2010-01'), TO = arg('to', '2019-12');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: 'application/json, text/plain, */*', origin: 'https://www.bseindia.com', referer: 'https://www.bseindia.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAME = 'BSE 500', files = new Map();
mkdirSync('data/india/idx-hist', { recursive: true });
const load = (y) => { if (!files.has(y)) { const p = `data/india/idx-hist/idx-${y}.json`; files.set(y, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}); } return files.get(y); };
const pad = (n) => String(n).padStart(2, '0');
let months = 0, days = 0, bad = [];
for (let y = +FROM.slice(0, 4), m = +FROM.slice(5, 7); `${y}-${pad(m)}` <= TO; m === 12 ? (y++, (m = 1)) : m++) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let rows = null;
  for (let a = 0; a < 4 && rows === null; a++) {
    try {
      const r = await fetch(`https://api.bseindia.com/BseIndiaAPI/api/IndexArchDaily/w?fmdt=01/${pad(m)}/${y}&index=BSE500&period=D&todt=${last}/${pad(m)}/${y}`, { headers: H });
      const j = JSON.parse(await r.text()); const t = j.Table ?? j.table; if (Array.isArray(t)) rows = t; else throw new Error('no table');
    } catch (e) { await sleep(2000 * (a + 1)); }
  }
  if (rows === null) { bad.push(`${y}-${pad(m)}`); continue; }
  if (rows.length >= 26) bad.push(`${y}-${pad(m)} returned ${rows.length} rows (the cap): month may be cut`);
  const o = (load(y)[NAME] ??= {});
  for (const x of rows) {
    const d = String(x.tdate).slice(0, 10), c = Number(x.I_close);
    if (!/^\d{4}-\d\d-\d\d$/.test(d) || !(c > 0) || d.slice(0, 7) !== `${y}-${pad(m)}`) continue;
    o[d] = [Number(x.I_open), Number(x.I_high), Number(x.I_low), c, Number(x.TOTAL_SHARES_TRADED) || 0]; days++;
  }
  months++; await sleep(900);
}
for (const [y, o] of files) writeFileSync(`data/india/idx-hist/idx-${y}.json`, JSON.stringify(o) + '\n');
console.log(JSON.stringify({ months, days, problems: bad }));
process.exit(bad.some((b) => !b.includes('returned')) ? 1 : 0);
