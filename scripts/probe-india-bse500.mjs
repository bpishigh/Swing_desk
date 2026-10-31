// One-off probe (backtester data): does BSE's archive API give EVERY session for BSE 500 in 2010 to 2012? The first probe returned 26 rows for a year.
// Tries a full year, then single months; records row counts and the dates returned. Output only: data/probe-india-bse500.json
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const B = { 'user-agent': UA, accept: 'application/json, text/plain, */*', origin: 'https://www.bseindia.com', referer: 'https://www.bseindia.com/' };
const out = { at: new Date().toISOString(), calls: [] };
const get = async (label, from, to, period = 'D') => {
  try {
    const r = await fetch(`https://api.bseindia.com/BseIndiaAPI/api/IndexArchDaily/w?fmdt=${from}&index=BSE500&period=${period}&todt=${to}`, { headers: B }), t = await r.text();
    let rows = []; try { const j = JSON.parse(t); rows = j.Table ?? j.table ?? (Array.isArray(j) ? j : []); } catch {}
    const dates = rows.map((x) => String(x.tdate).slice(0, 10));
    out.calls.push({ label, status: r.status, n: rows.length, firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null, sample: dates.slice(0, 12).join(' '), closeField: rows[0] ? Object.keys(rows[0]).join(' ') : null });
  } catch (e) { out.calls.push({ label, error: String(e.message ?? e) }); }
  await new Promise((r) => setTimeout(r, 1200));
};
await get('year 2010', '01/01/2010', '31/12/2010');
await get('month Jan 2010', '01/01/2010', '31/01/2010');
await get('month Feb 2010', '01/02/2010', '28/02/2010');
await get('half Jan 2010', '01/01/2010', '15/01/2010');
await get('year 2012 period D', '01/01/2012', '31/12/2012');
await get('year 2012 period M', '01/01/2012', '31/12/2012', 'M');
writeFileSync('data/probe-india-bse500.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.calls).slice(0, 1800));
