// One-off: full NSE corporate-actions history (all equities) from 2019-04-01 to today, in one call per year, stored compactly.
// Output: data/india/corp-actions-history.json  [{symbol, subject, exDate (ISO), recDate (ISO|null), faceVal, series, isin}]
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.nseindia.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cookie = '';
for (const u of ['https://www.nseindia.com/', 'https://www.nseindia.com/companies-listing/corporate-filings-actions']) {
  const r = await fetch(u, { headers: { ...H, cookie } }); const c = (r.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]); if (c.length) cookie = [cookie, ...c].filter(Boolean).join('; ');
}
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const iso = (s) => { const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s ?? ''); return m ? `${m[3]}-${String(MON[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const dmy = (d) => d.toISOString().slice(0, 10).split('-').reverse().join('-');
const rows = new Map(); const log = [];
const today = new Date();
for (let y = 2019; y <= today.getUTCFullYear(); y++) {
  const from = new Date(Date.UTC(y, 0, 1)), to = y === today.getUTCFullYear() ? today : new Date(Date.UTC(y, 11, 31));
  let ok = false;
  for (let a = 0; a < 4 && !ok; a++) {
    await sleep(3000 * (a + 1));
    const r = await fetch(`https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=${dmy(from)}&to_date=${dmy(to)}`, { headers: { ...H, cookie, referer: 'https://www.nseindia.com/companies-listing/corporate-filings-actions' } });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    const arr = Array.isArray(j) ? j : j?.data ?? [];
    log.push({ y, status: r.status, n: arr.length, attempt: a + 1 });
    if (arr.length) { ok = true; for (const x of arr) { const ex = iso(x.exDate); if (!ex || !x.symbol) continue; const k = `${x.symbol}|${ex}|${x.subject}`; if (!rows.has(k)) rows.set(k, { symbol: x.symbol, subject: x.subject, exDate: ex, recDate: iso(x.recDate), faceVal: x.faceVal, series: x.series, isin: x.isin }); } }
  }
}
const out = [...rows.values()].sort((a, b) => (a.exDate + a.symbol).localeCompare(b.exDate + b.symbol));
mkdirSync('data/india', { recursive: true });
writeFileSync('data/india/corp-actions-history.json', JSON.stringify(out));
writeFileSync('data/india/corp-actions-history-log.json', JSON.stringify({ ts: new Date().toISOString(), rows: out.length, calls: log }, null, 1) + '\n');
console.log(JSON.stringify({ rows: out.length, calls: log }));
