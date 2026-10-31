// One-off probe (backtester data): can Nifty 500 daily closes for 2010 to 2015 be read from a public source on GitHub's runner?
// Tries niftyindices.com (the index provider's own history) and NSE's indicesHistory API. Output only: data/probe-india-nifty500.json
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const out = { at: new Date().toISOString(), niftyindices: [], nse: [] };
const brief = (rows) => ({ n: rows.length, first: rows[0] ?? null, last: rows[rows.length - 1] ?? null });
// 1) niftyindices.com
for (const y of [2010, 2011, 2013, 2015]) {
  const body = JSON.stringify({ cinfo: JSON.stringify({ name: 'NIFTY 500', startDate: `01-Jan-${y}`, endDate: `31-Dec-${y}`, indexName: 'NIFTY 500' }) });
  try {
    const r = await fetch('https://www.niftyindices.com/Backpage.aspx/getHistoricaldatatabletoString', { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/json; charset=UTF-8', accept: 'application/json, text/javascript, */*; q=0.01', 'x-requested-with': 'XMLHttpRequest', origin: 'https://www.niftyindices.com', referer: 'https://www.niftyindices.com/reports/historical-data' }, body });
    const t = await r.text(); let rows = []; try { const d = JSON.parse(JSON.parse(t).d); rows = Array.isArray(d) ? d : []; } catch {}
    out.niftyindices.push({ year: y, status: r.status, bytes: t.length, ...brief(rows.map((x) => `${x.HistoricalDate ?? x.Date} close ${x.CLOSE ?? x.Close}`)), head: rows.length ? undefined : t.slice(0, 160).replace(/\s+/g, ' ') });
  } catch (e) { out.niftyindices.push({ year: y, error: String(e.message ?? e) }); }
  await new Promise((r) => setTimeout(r, 1500));
}
// 2) NSE indicesHistory (needs the session cookie)
try {
  let cookie = ''; for (const u of ['https://www.nseindia.com/', 'https://www.nseindia.com/reports-indices-historical-index-data']) { const r = await fetch(u, { headers: { 'user-agent': UA, accept: '*/*', cookie } }); const c = (r.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]); if (c.length) cookie = [cookie, ...c].filter(Boolean).join('; '); }
  for (const y of [2010, 2012, 2014]) {
    const r = await fetch(`https://www.nseindia.com/api/historical/indicesHistory?indexType=${encodeURIComponent('NIFTY 500')}&from=01-01-${y}&to=31-12-${y}`, { headers: { 'user-agent': UA, accept: '*/*', cookie, referer: 'https://www.nseindia.com/reports-indices-historical-index-data' } });
    const t = await r.text(); let rows = []; try { const d = JSON.parse(t); rows = d?.data?.indexCloseOnlineRecords ?? d?.data ?? []; } catch {}
    out.nse.push({ year: y, status: r.status, bytes: t.length, ...brief(rows.map((x) => `${x.EOD_TIMESTAMP ?? x.TIMESTAMP} close ${x.EOD_CLOSE_INDEX_VAL ?? x.CLOSE}`)), head: rows.length ? undefined : t.slice(0, 160).replace(/\s+/g, ' ') });
    await new Promise((r2) => setTimeout(r2, 2500));
  }
} catch (e) { out.nse.push({ error: String(e.message ?? e) }); }
writeFileSync('data/probe-india-nifty500.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out).slice(0, 1500));
