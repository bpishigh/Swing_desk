// One-off: look for a second source for ETF unit splits. Reads the unresolved ETF breaks from stocks/latest.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9' };
const lat = JSON.parse(readFileSync('data/india/stocks/latest.json', 'utf8'));
const etfs = lat.corporateActions.unresolved.filter((u) => /ETF unit split/.test(u.reason));
const out = { ts: new Date().toISOString(), n: etfs.length, yahoo: [], nse: {} };
const get = async (u, h = H) => { try { const r = await fetch(u, { headers: h, redirect: 'follow' }); return { status: r.status, text: await r.text() }; } catch (e) { return { status: 0, text: '', error: String(e) }; } };
// 1. Yahoo split events
for (const e of etfs) {
  const r = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(e.symbol)}.NS?range=2y&interval=1d&events=div%2Csplits`);
  let splits = null, err = null;
  try { const j = JSON.parse(r.text); splits = j.chart?.result?.[0]?.events?.splits ?? null; err = j.chart?.error?.description ?? null; } catch { err = r.text.slice(0, 80); }
  out.yahoo.push({ symbol: e.symbol, breakDate: e.date, ratio: e.ratio, status: r.status, splits, err });
  await new Promise((s) => setTimeout(s, 400));
}
// 2. NSE: ETF list, per-symbol corporate actions / announcements
const base = 'https://www.nseindia.com';
const w = await fetch(base, { headers: H }); const cookie = (w.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
await fetch(base + '/companies-listing/corporate-filings-actions', { headers: { ...H, cookie } });
const HA = { ...H, cookie, referer: base + '/companies-listing/corporate-filings-actions', accept: 'application/json' };
const probe = async (k, u, hdr = HA) => { const r = await get(u, hdr); out.nse[k] = { status: r.status, bytes: r.text.length, head: r.text.slice(0, 300) }; return r; };
await probe('etfList', 'https://nsearchives.nseindia.com/content/equities/eq_etfseclist.csv', H);
await probe('etfApi', base + '/api/etf');
const s = etfs[0]?.symbol ?? 'GROWWGOLD';
await probe('ca_symbol', `${base}/api/corporates-corporateActions?index=equities&symbol=${s}`);
await probe('ca_symbol_dates', `${base}/api/corporates-corporateActions?index=equities&symbol=${s}&from_date=01-01-2026&to_date=31-10-2026`);
await probe('ca_mf', `${base}/api/corporates-corporateActions?index=mf`);
await probe('ca_etf', `${base}/api/corporates-corporateActions?index=etf`);
await probe('announce', `${base}/api/corporate-announcements?index=equities&symbol=${s}`);
await probe('announce_sme', `${base}/api/corporate-announcements?index=equities&symbol=${s}&from_date=01-01-2026&to_date=31-10-2026`);
mkdirSync('data/source-test', { recursive: true });
writeFileSync('data/source-test/etf-probe.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ yahoo: out.yahoo.map((y) => [y.symbol, y.status, y.splits ? Object.values(y.splits).map((x) => x.splitRatio + '@' + new Date(x.date * 1000).toISOString().slice(0, 10)).join(',') : y.err]), nse: Object.fromEntries(Object.entries(out.nse).map(([k, v]) => [k, [v.status, v.bytes]])) }, null, 1));
