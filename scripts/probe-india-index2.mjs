// One-off probe (backtester data): where do index closes for 2010 to mid-2012 exist? (1) when do NSE's ind_close_all files start (one try per week, Jan 2010 to Jun 2012),
// (2) does BSE's archive API return BSE 500 / Sensex daily closes for 2010 to 2012 to the runner. Output only: data/probe-india-index2.json
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', referer: 'https://www.nseindia.com/' };
const out = { at: new Date().toISOString(), nseStart: [], nseFirstOk: null, bse: [] };
const pad = (n) => String(n).padStart(2, '0');
for (let d = Date.parse('2010-01-04'); d <= Date.parse('2012-06-15'); d += 7 * 864e5) {
  const dt = new Date(d); if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue;
  const iso = dt.toISOString().slice(0, 10), name = `ind_close_all_${pad(dt.getUTCDate())}${pad(dt.getUTCMonth() + 1)}${dt.getUTCFullYear()}.csv`;
  try { const r = await fetch(`https://archives.nseindia.com/content/indices/${name}`, { headers: H }); out.nseStart.push(`${iso}:${r.status}`); if (r.status === 200 && !out.nseFirstOk) out.nseFirstOk = iso; } catch (e) { out.nseStart.push(`${iso}:err`); }
  await new Promise((r) => setTimeout(r, 400));
}
const B = { 'user-agent': UA, accept: 'application/json, text/plain, */*', origin: 'https://www.bseindia.com', referer: 'https://www.bseindia.com/' };
for (const [idx, y] of [['BSE500', 2010], ['BSE500', 2011], ['SENSEX', 2010], ['BSE500', 2013]]) {
  try {
    const r = await fetch(`https://api.bseindia.com/BseIndiaAPI/api/IndexArchDaily/w?fmdt=01/01/${y}&index=${idx}&period=D&todt=31/12/${y}`, { headers: B }), t = await r.text();
    let rows = []; try { const j = JSON.parse(t); rows = j.Table ?? j.table ?? (Array.isArray(j) ? j : []); } catch {}
    out.bse.push({ index: idx, year: y, status: r.status, bytes: t.length, n: rows.length, first: rows[0] ? JSON.stringify(rows[0]).replace(/,/g, ' ').slice(0, 160) : null, head: rows.length ? undefined : t.slice(0, 140).replace(/[\s,]+/g, ' ') });
  } catch (e) { out.bse.push({ index: idx, year: y, error: String(e.message ?? e) }); }
  await new Promise((r) => setTimeout(r, 1500));
}
writeFileSync('data/probe-india-index2.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ nseFirstOk: out.nseFirstOk, bse: out.bse }).slice(0, 1500));
