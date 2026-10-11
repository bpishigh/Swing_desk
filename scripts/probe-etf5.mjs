// One-off: find parameters that make NSE's circulars API return a date range, then scan for ETF face-value/unit split notices.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9' };
const base = 'https://www.nseindia.com';
const w = await fetch(base, { headers: H }); let cookie = (w.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const w2 = await fetch(base + '/resources/exchange-communication-circulars', { headers: { ...H, cookie } }); cookie += '; ' + (w2.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const HA = { ...H, cookie, referer: base + '/resources/exchange-communication-circulars', accept: 'application/json, text/plain, */*' };
const variants = {
  fromDate: '/api/circulars?fromDate=01-02-2026&toDate=28-02-2026',
  fromDate_dept: '/api/circulars?fromDate=01-02-2026&toDate=28-02-2026&dept=CML',
  from_date_dept: '/api/circulars?from_date=01-02-2026&to_date=28-02-2026&dept=CML',
  dept_only: '/api/circulars?dept=CML',
  isin_style: '/api/circulars?fromDate=06-02-2026&toDate=06-02-2026',
  archive: '/api/circulars-archive?fromDate=01-02-2026&toDate=28-02-2026',
};
const res = []; const hits = new Map();
for (const [k, p] of Object.entries(variants)) {
  const r = await fetch(base + p, { headers: HA }); const t = await r.text(); let a = []; try { const j = JSON.parse(t); a = Array.isArray(j) ? j : j.data ?? []; } catch {}
  const ds = a.map((c) => c.cirDate).sort();
  res.push({ k, status: r.status, n: a.length, min: ds[0], max: ds[ds.length - 1], cats: [...new Set(a.map((c) => c.circDepartment))].slice(0, 6) });
  for (const c of a) if (/split|sub-?division|consolidat|face value|unit/i.test(c.sub)) hits.set(c.circDisplayNo, { date: c.cirDate, dept: c.circDepartment, no: c.circDisplayNo, sub: c.sub, link: c.circFilelink });
}
writeFileSync('data/source-test/etf-probe5.json', JSON.stringify({ ts: new Date().toISOString(), res, hits: [...hits.values()] }, null, 1) + '\n');
console.log(JSON.stringify(res), hits.size);
