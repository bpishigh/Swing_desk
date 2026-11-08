// One-off probe (strategy build programme, package I-2): which free filing endpoints answer from the runner and how far back each goes. Writes data/probe-filings.json. Public data only; no rule change.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
let cookie = '';
const get = async (url, h = {}) => { try { const r = await fetch(url, { headers: { ...UA, ...(cookie ? { cookie } : {}), ...h }, signal: AbortSignal.timeout(40000) }); return { status: r.status, t: await r.text() }; } catch (e) { return { status: 0, t: '', err: String(e.message || e).slice(0, 80) }; } };
// Warm-up for NSE session cookies (the earlier pledge probe worked without it; used only if a call is refused).
try { const r = await fetch('https://www.nseindia.com/', { headers: UA, signal: AbortSignal.timeout(30000) }); cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; '); } catch {}
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const toDate = (v) => {
  if (typeof v !== 'string') return null;
  let m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/); if (m && MON[m[2].toUpperCase()] != null) return new Date(Date.UTC(+m[3], MON[m[2].toUpperCase()], +m[1]));
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = v.match(/^(\d{2})-(\d{2})-(\d{4})/); if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
};
const summarise = (res) => {
  const o = { status: res.status, bytes: res.t.length };
  if (res.err) o.err = res.err;
  if (res.status !== 200) { o.head = res.t.slice(0, 120); return o; }
  let j; try { j = JSON.parse(res.t); } catch { o.head = res.t.slice(0, 160); o.json = false; return o; }
  const arr = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : null;
  o.shape = Array.isArray(j) ? 'array' : 'object:' + Object.keys(j || {}).slice(0, 6).join(',');
  if (!arr) return o;
  o.n = arr.length;
  if (arr[0] && typeof arr[0] === 'object') {
    o.keys = Object.keys(arr[0]).slice(0, 40);
    const dk = o.keys.filter((k) => arr.some((r) => toDate(r[k])));
    o.dates = {};
    for (const k of dk) { const ds = arr.map((r) => toDate(r[k])).filter(Boolean).sort((a, b) => a - b); o.dates[k] = [ds[0].toISOString().slice(0, 10), ds[ds.length - 1].toISOString().slice(0, 10)]; }
    o.sample = JSON.stringify(arr[0]).slice(0, 400);
  }
  return o;
};
const ddmmyyyy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
const now = new Date(); const from5 = new Date(Date.UTC(now.getUTCFullYear() - 5, now.getUTCMonth(), now.getUTCDate()));
const SYMS = ['RELIANCE', 'ADANIENT', 'KPITTECH', 'JPPOWER', 'DHFL'];
const eps = (s) => [
  ['shareholding', `https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${s}`],
  ['results_quarterly', `https://www.nseindia.com/api/corporates-financial-results?index=equities&symbol=${s}&period=Quarterly`],
  ['results_comparison', `https://www.nseindia.com/api/results-comparision?symbol=${s}`],
  ['pit_symbol_5y', `https://www.nseindia.com/api/corporates-pit?index=equities&symbol=${s}&from_date=${ddmmyyyy(from5)}&to_date=${ddmmyyyy(now)}`],
  ['sast_pledge_a', `https://www.nseindia.com/api/corporate-sast-reg29?index=equities&symbol=${s}&from_date=${ddmmyyyy(from5)}&to_date=${ddmmyyyy(now)}`],
  ['sast_pledge_b', `https://www.nseindia.com/api/corporates-sast?index=equities&symbol=${s}&from_date=${ddmmyyyy(from5)}&to_date=${ddmmyyyy(now)}`],
  ['pledged_data', `https://www.nseindia.com/api/corporate-pledgedata?index=equities&symbol=${s}`],
  ['board_meetings', `https://www.nseindia.com/api/corporate-board-meetings?index=equities&symbol=${s}`],
  ['announcements', `https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${s}`],
  ['corp_actions', `https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol=${s}`],
];
const out = { at: now.toISOString(), cookieWarm: !!cookie, nse: {}, other: {} };
for (const s of SYMS) {
  out.nse[s] = {};
  for (const [k, u] of eps(s)) {
    let r = await get(u, NSEH);
    if ([401, 403].includes(r.status) && !cookie) { try { const w = await fetch('https://www.nseindia.com/', { headers: UA }); cookie = (w.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; '); r = await get(u, NSEH); } catch {} }
    out.nse[s][k] = summarise(r);
    await new Promise((r2) => setTimeout(r2, 400));
  }
}
// Market-wide, date-range calls (no symbol): how far back can PIT and results go in one query?
const wide = {
  pit_all_30d: `https://www.nseindia.com/api/corporates-pit?index=equities&from_date=${ddmmyyyy(new Date(now - 30 * 864e5))}&to_date=${ddmmyyyy(now)}`,
  pit_all_2019: `https://www.nseindia.com/api/corporates-pit?index=equities&from_date=01-01-2019&to_date=31-03-2019`,
  results_all_quarterly: `https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly`,
  results_all_2021q: `https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly&from_date=01-01-2021&to_date=31-03-2021`,
  event_calendar: `https://www.nseindia.com/api/event-calendar`,
};
out.nse.wide = {};
for (const [k, u] of Object.entries(wide)) { out.nse.wide[k] = summarise(await get(u, NSEH)); await new Promise((r2) => setTimeout(r2, 400)); }
// Other free routes.
const BSEH = { referer: 'https://www.bseindia.com/', origin: 'https://www.bseindia.com', accept: 'application/json' };
out.other.bse_corpactions = summarise(await get('https://api.bseindia.com/BseIndiaAPI/api/CorporateAction/w?scripcode=500325', BSEH));
out.other.bse_shp = summarise(await get('https://api.bseindia.com/BseIndiaAPI/api/shpSecurities/w?scripcode=500325&qtrid=', BSEH));
out.other.bse_pledge_page = { status: (await get('https://www.bseindia.com/corporates/Pledge_new.aspx')).status };
out.other.sebi_pit_page = { status: (await get('https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=15&smid=0')).status };
out.other.yahoo_chart = summarise(await get('https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?range=5d&interval=1d'));
out.other.yahoo_quote_summary = summarise(await get('https://query2.finance.yahoo.com/v10/finance/quoteSummary/RELIANCE.NS?modules=earnings'));
writeFileSync('data/probe-filings.json', JSON.stringify(out, null, 1) + '\n');
for (const s of SYMS) console.log(s, Object.entries(out.nse[s]).map(([k, v]) => `${k}:${v.status}/${v.n ?? '-'}`).join(' '));
console.log('wide', Object.entries(out.nse.wide).map(([k, v]) => `${k}:${v.status}/${v.n ?? '-'}`).join(' '));
console.log('other', Object.entries(out.other).map(([k, v]) => `${k}:${v.status}`).join(' '));
