// One-off: can NSE's free sources serve 2020-2025 history from Actions? (1) corporate-actions API over past ranges,
// (2) the daily security-wise bhavcopy archive on past dates (and its header, to see the 2024 format change). Writes data/source-test/nse-history-probe.json.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.nseindia.com/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { ts: new Date().toISOString(), actions: [], samples: {}, bhav: [] };
let cookie = '';
for (const u of ['https://www.nseindia.com/', 'https://www.nseindia.com/companies-listing/corporate-filings-actions']) {
  const r = await fetch(u, { headers: { ...H, cookie } }); const c = (r.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]); if (c.length) cookie = [cookie, ...c].filter(Boolean).join('; ');
}
const dmy = (iso) => iso.split('-').reverse().join('-');
async function actions(from, to) {
  await sleep(2500);
  const r = await fetch(`https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=${dmy(from)}&to_date=${dmy(to)}`, { headers: { ...H, cookie, referer: 'https://www.nseindia.com/companies-listing/corporate-filings-actions' } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  const arr = Array.isArray(j) ? j : j?.data ?? [];
  return { status: r.status, n: arr.length, arr, note: j ? '' : t.slice(0, 100) };
}
for (const [from, to] of [['2020-04-01', '2020-04-30'], ['2021-04-01', '2021-04-30'], ['2022-08-01', '2022-08-31'], ['2023-05-01', '2023-05-31'], ['2024-10-01', '2024-10-31'], ['2025-01-15', '2025-02-15'], ['2022-01-01', '2022-12-31'], ['2020-04-01', '2025-10-10']]) {
  const a = await actions(from, to);
  out.actions.push({ from, to, status: a.status, n: a.n, note: a.note });
  if (from === '2025-01-15') out.samples.itc = a.arr.filter((x) => /^ITC/.test(x.symbol)).map((x) => ({ symbol: x.symbol, subject: x.subject, exDate: x.exDate, recDate: x.recDate })).slice(0, 6);
  if (from === '2022-08-01') out.samples.tatasteel = a.arr.filter((x) => x.symbol === 'TATASTEEL').map((x) => ({ subject: x.subject, exDate: x.exDate })).slice(0, 4);
  if (from === '2024-10-01') out.samples.bonus = a.arr.filter((x) => /bonus/i.test(x.subject)).map((x) => ({ symbol: x.symbol, subject: x.subject, exDate: x.exDate })).slice(0, 6);
}
const dd = (iso) => iso.split('-').reverse().join('');
for (const d of ['2020-04-15', '2021-04-15', '2022-08-16', '2023-05-16', '2024-07-15', '2024-10-15', '2025-01-15']) {
  const row = { date: d };
  for (const host of ['archives.nseindia.com', 'nsearchives.nseindia.com']) {
    await sleep(1500);
    try { const r = await fetch(`https://${host}/products/content/sec_bhavdata_full_${dd(d)}.csv`, { headers: H }); const t = await r.text(); row[host] = { status: r.status, bytes: t.length, header: r.ok && !t.startsWith('<') ? t.split('\n')[0].slice(0, 220) : t.slice(0, 60), lines: t.split('\n').length }; } catch (e) { row[host] = { error: String(e).slice(0, 80) }; }
  }
  out.bhav.push(row);
}
writeFileSync('data/source-test/nse-history-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ actions: out.actions, bhav: out.bhav.map((b) => ({ d: b.date, a: b['archives.nseindia.com']?.status, n: b['nsearchives.nseindia.com']?.status })) }));
