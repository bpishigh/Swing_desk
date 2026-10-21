// One-off probe: can the runner read NSE's corporate-actions list, and what does it look like?
// Writes data/source-test/corp-actions-probe.json (public data only).
import { mkdirSync, writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.nseindia.com/companies-listing/corporate-filings-actions' };
const out = { ts: new Date().toISOString(), tries: [] };
let cookie = '';
try {
  for (const u of ['https://www.nseindia.com/', 'https://www.nseindia.com/companies-listing/corporate-filings-actions']) {
    const r = await fetch(u, { headers: { ...H, cookie }, redirect: 'follow' });
    const c = (r.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]);
    if (c.length) cookie = [cookie, ...c].filter(Boolean).join('; ');
  }
} catch (e) { out.cookieError = String(e); }
out.cookie = cookie ? 'set' : 'none';
const urls = [
  'https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=01-10-2025&to_date=10-10-2026',
  'https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=01-10-2025&to_date=10-10-2026&subject=Bonus',
  'https://www.nseindia.com/api/corporates-corporateActions?index=equities',
];
let recs = null;
for (const url of urls) {
  const t = { url, status: null, bytes: 0, note: '' };
  try {
    const r = await fetch(url, { headers: { ...H, cookie }, redirect: 'follow' });
    t.status = r.status; const text = await r.text(); t.bytes = text.length;
    try { const j = JSON.parse(text); const arr = Array.isArray(j) ? j : (j.data || []); t.count = arr.length; if (!recs && arr.length) recs = arr; t.keys = arr[0] ? Object.keys(arr[0]) : []; }
    catch { t.note = text.slice(0, 160); }
  } catch (e) { t.note = String(e); }
  out.tries.push(t);
}
if (recs) {
  out.first = recs.slice(0, 3);
  const subj = (r) => String(r.subject || r.purpose || '');
  const shape = (s) => s.replace(/\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').trim();
  const pats = {}; for (const r of recs) { const k = shape(subj(r)); pats[k] = (pats[k] || 0) + 1; }
  out.patterns = Object.entries(pats).sort((a, b) => b[1] - a[1]).slice(0, 80);
  out.forSymbols = recs.filter((r) => ['RELIANCE', 'LT'].includes(r.symbol)).map((r) => ({ symbol: r.symbol, subject: subj(r), exDate: r.exDate, recDate: r.recDate, faceVal: r.faceVal, series: r.series }));
  out.splitOrBonus = recs.filter((r) => /bonus|split|sub-?division|consolidat|rights|demerger|capital reduction|amalgamation|spin/i.test(subj(r))).length;
  out.total = recs.length;
}
mkdirSync('data/source-test', { recursive: true });
if (recs) writeFileSync('data/source-test/corp-actions-year.json', JSON.stringify(recs.map((r) => ({ symbol: r.symbol, series: r.series, subject: r.subject, exDate: r.exDate, faceVal: r.faceVal }))) + '\n');
writeFileSync('data/source-test/corp-actions-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ tries: out.tries.map((t) => [t.status, t.bytes, t.count ?? t.note]), total: out.total }));
