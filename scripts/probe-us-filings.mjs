// One-off probe (strategy build programme, US side of package I-2): which free US filing sources answer from the runner and how far back each goes. Writes data/probe-us-filings.json. Public data only; no rule change.
import { writeFileSync } from 'node:fs';
const SEC_UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com';
const get = async (url, h = {}, ua = SEC_UA) => { try { const r = await fetch(url, { headers: { 'user-agent': ua, 'accept-encoding': 'gzip, deflate', ...h }, signal: AbortSignal.timeout(45000) }); const buf = Buffer.from(await r.arrayBuffer()); return { status: r.status, t: buf.toString('utf8'), bytes: buf.length, ct: r.headers.get('content-type') }; } catch (e) { return { status: 0, t: '', bytes: 0, err: String(e.message || e).slice(0, 80) }; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { at: new Date().toISOString(), secUaIsCustom: !!process.env.SEC_UA, sec: {}, bulk: {}, other: {} };
const tick = await get('https://www.sec.gov/files/company_tickers.json'); out.sec.company_tickers = { status: tick.status, bytes: tick.bytes, head: tick.status !== 200 ? tick.t.slice(0, 120) : undefined };
let map = {}; try { for (const v of Object.values(JSON.parse(tick.t))) map[v.ticker] = String(v.cik_str).padStart(10, '0'); } catch {}
const NAMES = { AAPL: 'large', NVDA: 'large', CELH: 'small', PLUG: 'small, volatile' };
const ymd = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const range = (a) => { const d = a.filter(Boolean).sort(); return d.length ? [d[0], d[d.length - 1]] : null; };
for (const tk of Object.keys(NAMES)) {
  const cik = map[tk]; const o = { cik };
  if (!cik) { out.sec[tk] = { err: 'no cik' }; continue; }
  const sub = await get(`https://data.sec.gov/submissions/CIK${cik}.json`); o.submissions_status = sub.status; await sleep(250);
  if (sub.status === 200) {
    const j = JSON.parse(sub.t); const r = j.filings.recent; o.recent_n = r.form.length; o.older_files = (j.filings.files || []).map((f) => f.name);
    const by = {}; r.form.forEach((f, i) => { (by[f] ||= []).push(r.filingDate[i]); });
    o.forms = Object.fromEntries(['10-K', '10-Q', '8-K', '4', 'SC 13G', 'SC 13D', 'SC 13G/A', 'SCHEDULE 13G', 'SCHEDULE 13D', '13F-HR'].filter((f) => by[f]).map((f) => [f, { n: by[f].length, range: range(by[f]) }]));
    o.has_acceptance_time = !!r.acceptanceDateTime?.[0]; o.sample_acceptance = r.acceptanceDateTime?.[0];
    const i4 = r.form.indexOf('4'); if (i4 >= 0) { const acc = r.accessionNumber[i4].replace(/-/g, ''); const doc = r.primaryDocument[i4].replace(/^xsl[^/]*\//, ''); const x = await get(`https://www.sec.gov/Archives/edgar/data/${+cik}/${acc}/${doc}`); o.form4_xml = { status: x.status, hasTransactions: /nonDerivativeTransaction/.test(x.t), hasCode: /<transactionCode>/.test(x.t), sample: x.t.slice(0, 0) }; await sleep(250); }
  }
  const cf = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`); o.companyfacts_status = cf.status; o.companyfacts_bytes = cf.bytes; await sleep(250);
  if (cf.status === 200) {
    const j = JSON.parse(cf.t); const g = j.facts['us-gaap'] || {}; o.n_concepts = Object.keys(g).length;
    for (const c of ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'NetIncomeLoss', 'EarningsPerShareDiluted', 'Assets']) {
      const u = g[c]?.units; if (!u) continue; const rows = Object.values(u)[0];
      o[c] = { n: rows.length, end: range(rows.map((r) => r.end)), filed: range(rows.map((r) => r.filed)), keys: Object.keys(rows[0]), forms: [...new Set(rows.map((r) => r.form))].slice(0, 8) };
    }
  }
  out.sec[tk] = o;
}
// Bulk SEC datasets (size only: HEAD-like via range request).
const head = async (u) => { const r = await get(u, { range: 'bytes=0-1023' }); return { status: r.status, bytes: r.bytes, head: r.status >= 400 ? r.t.slice(0, 100) : undefined }; };
out.bulk.fin_stmt_2019q1 = await head('https://www.sec.gov/files/dera/data/financial-statement-data-sets/2019q1.zip'); await sleep(250);
out.bulk.insider_2019q1 = await head('https://www.sec.gov/files/structureddata/data/insider-transactions-data-sets/2019q1_form345.zip'); await sleep(250);
out.bulk.thirteenf_2019q1 = await head('https://www.sec.gov/files/structureddata/data/form-13f-data-sets/01jan2019-28feb2019_form13f.zip'); await sleep(250);
out.bulk.full_index_2010q1 = await head('https://www.sec.gov/Archives/edgar/full-index/2010/QTR1/form.idx'); await sleep(250);
// 13F: Berkshire's filing list and one information table.
const bk = await get('https://data.sec.gov/submissions/CIK0001067983.json'); out.sec.berkshire = { status: bk.status };
if (bk.status === 200) { const r = JSON.parse(bk.t).filings.recent; const f = r.form.map((x, i) => [x, r.filingDate[i], r.accessionNumber[i]]).filter((a) => a[0] === '13F-HR'); out.sec.berkshire.thirteenf = { n: f.length, range: range(f.map((a) => a[1])) }; if (f[0]) { const acc = f[0][2].replace(/-/g, ''); const idx = await get(`https://www.sec.gov/Archives/edgar/data/1067983/${acc}/`); out.sec.berkshire.index_status = idx.status; } }
// FINRA short interest, Nasdaq earnings calendar, Yahoo.
const BR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
for (const [k, u] of [['finra_shrt_20250930_csv', 'https://cdn.finra.org/equity/otcmarket/biweekly/shrt20250930.csv'], ['finra_shrt_20190628_csv', 'https://cdn.finra.org/equity/otcmarket/biweekly/shrt20190628.csv'], ['finra_shrt_20190628_txt', 'https://cdn.finra.org/equity/otcmarket/biweekly/shrt20190628.txt']]) { const r = await get(u, { range: 'bytes=0-600' }, BR); out.other[k] = { status: r.status, head: r.t.slice(0, 200).replace(/\s+/g, ' ') }; await sleep(250); }
const nas = await get('https://api.nasdaq.com/api/calendar/earnings?date=2026-11-05', { accept: 'application/json', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' }, BR);
out.other.nasdaq_earnings = { status: nas.status }; try { const j = JSON.parse(nas.t); const rows = j.data?.rows || []; out.other.nasdaq_earnings.n = rows.length; out.other.nasdaq_earnings.keys = Object.keys(rows[0] || {}); out.other.nasdaq_earnings.sample = JSON.stringify(rows[0]).slice(0, 300); } catch { out.other.nasdaq_earnings.head = nas.t.slice(0, 100); }
writeFileSync('data/probe-us-filings.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ tick: out.sec.company_tickers.status, ua: out.secUaIsCustom, aapl: out.sec.AAPL?.submissions_status, facts: out.sec.AAPL?.companyfacts_status, bulk: Object.fromEntries(Object.entries(out.bulk).map(([k, v]) => [k, v.status])), other: Object.fromEntries(Object.entries(out.other).map(([k, v]) => [k, v.status])) }));
