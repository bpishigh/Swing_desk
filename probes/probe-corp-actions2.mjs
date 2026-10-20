// Debug: which date windows does NSE's corporate-actions API accept from the runner?
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.nseindia.com/companies-listing/corporate-filings-actions' };
let cookie = '';
for (const u of ['https://www.nseindia.com/', 'https://www.nseindia.com/companies-listing/corporate-filings-actions']) {
  const r = await fetch(u, { headers: { ...H, cookie }, redirect: 'follow' });
  const c = (r.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]);
  if (c.length) cookie = [cookie, ...c].filter(Boolean).join('; ');
}
const combos = [['01-10-2025', '10-10-2026'], ['04-10-2025', '09-10-2026'], ['04-10-2025', '10-10-2026'], ['01-10-2025', '09-10-2026'], ['10-10-2025', '09-10-2026'], ['01-01-2026', '09-10-2026'], ['01-10-2025', '31-12-2025']];
const out = [];
for (const [f, t] of combos) {
  const r = await fetch(`https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=${f}&to_date=${t}`, { headers: { ...H, cookie } });
  const txt = await r.text(); let n = null; try { const j = JSON.parse(txt); n = Array.isArray(j) ? j.length : (j.data || []).length; } catch {}
  out.push({ from: f, to: t, status: r.status, n, head: n ? '' : txt.slice(0, 80) });
}
writeFileSync('data/source-test/corp-actions-windows.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
