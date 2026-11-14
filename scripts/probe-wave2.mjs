// One-off probe (15 Nov 2026), Wave 2 data feasibility: surveillance lists, bulk and block deals, delivery file, index review notices, FINRA short interest. Reachable only from the GitHub runner. Writes data/probe-wave2.json. Public data only; read-only; changes no rule.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json,text/csv,*/*' };
const get = async (url, h = {}) => { try { const r = await fetch(url, { headers: { ...UA, ...NSEH, ...h }, signal: AbortSignal.timeout(60000), redirect: 'follow' }); const t = await r.text(); return { status: r.status, type: r.headers.get('content-type') || '', len: t.length, t }; } catch (e) { return { status: 0, type: '', len: 0, t: '', err: String(e).slice(0, 80) }; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
const ddmmyyyy = (d) => fmt(d).replaceAll('-', '');
const shape = (t) => { try { const j = JSON.parse(t); const a = Array.isArray(j) ? j : j.data ?? j.Data ?? j.rows ?? null; return { json: true, topKeys: Array.isArray(j) ? null : Object.keys(j).slice(0, 8), n: Array.isArray(a) ? a.length : null, first: Array.isArray(a) && a[0] ? a[0] : null }; } catch { return { json: false, head: t.slice(0, 220).replace(/\s+/g, ' ') }; } };
const out = { at: new Date().toISOString(), probes: {} };
const P = async (name, url, h) => { const r = await get(url, h); out.probes[name] = { url, status: r.status, type: r.type, len: r.len, err: r.err, ...(r.status === 200 ? shape(r.t) : { head: r.t.slice(0, 160).replace(/\s+/g, ' ') }) }; await sleep(800); return r; };
await get('https://www.nseindia.com/');   // cookie warm-up, not kept
const today = new Date(), back = (n) => new Date(today.getTime() - n * 864e5);
// Surveillance (ASM, GSM, ESM)
for (const [k, u] of [['asm', 'https://www.nseindia.com/api/reportASM'], ['gsm', 'https://www.nseindia.com/api/reportGSM'], ['esm', 'https://www.nseindia.com/api/reportESM'], ['asm_archive', 'https://nsearchives.nseindia.com/content/equities/ASM_Report.csv'], ['surv_page', 'https://www.nseindia.com/api/surveillance-measures']]) await P(k, u);
// Bulk and block deals: latest-day files and history by date window
for (const [k, u] of [['bulk_latest', 'https://nsearchives.nseindia.com/content/equities/bulk.csv'], ['block_latest', 'https://nsearchives.nseindia.com/content/equities/block.csv'], ['bulk_hist_2025', `https://www.nseindia.com/api/historical/bulk-deals?from=01-10-2025&to=31-10-2025`], ['block_hist_2025', `https://www.nseindia.com/api/historical/block-deals?from=01-10-2025&to=31-10-2025`], ['bulk_hist_2021', `https://www.nseindia.com/api/historical/bulk-deals?from=01-03-2021&to=31-03-2021`], ['bulk_hist_2018', `https://www.nseindia.com/api/historical/bulk-deals?from=01-03-2018&to=31-03-2018`], ['bulk_hist_2016', `https://www.nseindia.com/api/historical/bulk-deals?from=01-03-2016&to=31-03-2016`], ['bulk_snapshot', 'https://www.nseindia.com/api/snapshot-capital-market-largedeal']]) await P(k, u);
// Delivery file (security-wise bhavcopy with delivery quantity), several vintages
const dl = {};
for (const [k, d] of [['recent', back(3)], ['1m', back(35)], ['2025', new Date('2025-06-12T00:00:00Z')], ['2023', new Date('2023-06-14T00:00:00Z')], ['2021', new Date('2021-06-15T00:00:00Z')], ['2019', new Date('2019-06-12T00:00:00Z')], ['2016', new Date('2016-06-15T00:00:00Z')]]) {
  for (let off = 0; off < 5; off++) { const dd = new Date(d.getTime() - off * 864e5); if ([0, 6].includes(dd.getUTCDay())) continue; const r = await get(`https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${ddmmyyyy(dd)}.csv`); if (r.status === 200 && r.len > 1000) { const lines = r.t.split(/\r?\n/); dl[k] = { date: fmt(dd), status: 200, rows: lines.length - 1, header: lines[0].slice(0, 200), sample: lines[1]?.slice(0, 200) }; break; } dl[k] = { date: fmt(dd), status: r.status }; await sleep(500); }
}
out.probes.delivery = dl;
// Index review notices: what the desk's circular store holds, and NSE Indices pages
await P('niftyindices_press', 'https://www.niftyindices.com/press-release', { referer: 'https://www.niftyindices.com/' });
await P('niftyindices_reports', 'https://www.niftyindices.com/reports/index-launch-and-rebalancing', { referer: 'https://www.niftyindices.com/' });
await P('nse_circulars_index', 'https://www.nseindia.com/api/circulars?from_date=01-10-2025&to_date=31-10-2025&subject=index');
// FINRA short interest (US)
for (const d of ['20261030', '20261015', '20250930']) await P('finra_' + d, `https://cdn.finra.org/equity/otcmarket/biweekly/shrt${d}.csv`, { referer: 'https://www.finra.org/' });
writeFileSync('data/probe-wave2.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.probes).map(([k, v]) => [k, v.status ?? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, b.status]))]))));
