// One-off probe, round 2 (package I-2): how complete are the free filing histories across a wider sample? India (NSE) and US (SEC EDGAR, FINRA). Writes data/probe-filings-coverage.json, which also lists the sampled symbols for the yfinance step. Public data only; no rule change.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const SEC_UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com';
const BR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url, h = {}, ua = BR) => { try { const r = await fetch(url, { headers: { 'user-agent': ua, ...h }, signal: AbortSignal.timeout(45000) }); return { status: r.status, t: await r.text() }; } catch (e) { return { status: 0, t: '', err: String(e.message || e).slice(0, 60) }; } };
const NSEH = { referer: 'https://www.nseindia.com/', accept: 'application/json' };
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const toDate = (v) => { if (typeof v !== 'string') return null; let m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/); if (m && MON[m[2].toUpperCase()] != null) return new Date(Date.UTC(+m[3], MON[m[2].toUpperCase()], +m[1])); m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return null; };
const iso = (d) => d.toISOString().slice(0, 10);
const qkey = (d) => `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
const qlist = (a, b) => { const o = []; let y = a.getUTCFullYear(), q = Math.floor(a.getUTCMonth() / 3) + 1; const end = qkey(b); for (;;) { const k = `${y}Q${q}`; o.push(k); if (k === end) break; q++; if (q > 4) { q = 1; y++; } if (o.length > 200) break; } return o; };
const dmy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
const jarr = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : null; } catch { return null; } };
const now = new Date();
const out = { at: now.toISOString(), india: { sample: {}, perStock: {}, marketWide: {} }, us: { perStock: {}, delisted: {}, finra: {} } };

// ---------- India sample ----------
const facts = Object.keys(JSON.parse(readFileSync('data/stocks/facts.json', 'utf8')).stocks);
const listed = facts.filter((_, i) => i % 20 === 0);
const first = JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/2020-01-02.json.gz')).toString()).rows;
const latest = JSON.parse(readFileSync('data/india/bhav/2026-11-06.json', 'utf8')).rows;
const gone = Object.entries(first).filter(([s, r]) => r[0] === 'EQ' && !latest[s]).sort((a, b) => b[1][6] - a[1][6]).slice(0, 600).map(([s]) => s).filter((_, i) => i % 40 === 0).slice(0, 15);
out.india.sample = { listed, absentNow: gone };
const tagRe = /<[\w-]+:(\w+)[\s>]/g;
const xbrlCheck = async (url, want) => { if (!url) return { status: 'nolink' }; const r = await get(url); if (r.status !== 200) return { status: r.status }; const tags = new Set(); for (const m of r.t.matchAll(tagRe)) tags.add(m[1]); const hit = [...tags].filter((t) => want.test(t)); return { status: 200, nTags: tags.size, hit: hit.slice(0, 4), n: hit.length }; };
const FIN = /RevenueFromOperations|^Income$|TotalIncome|ProfitLossForPeriod|ProfitBeforeTax|BasicEarningsLossPerShare|DilutedEarningsLossPerShare/;
const SHP = /ShareholdingAsAPercentage|NumberOfSharesEncumbered|EncumberedShare/;
const pick3 = (a) => a.length < 3 ? a : [a[0], a[Math.floor(a.length / 2)], a[a.length - 1]];
for (const s of [...listed, ...gone]) {
  const o = { group: listed.includes(s) ? 'listed' : 'absentNow' };
  const R = await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&symbol=${encodeURIComponent(s)}&period=Quarterly`, NSEH); await sleep(300);
  const rr = jarr(R.t) || []; o.results_status = R.status; o.results_n = rr.length;
  if (rr.length) {
    const ends = rr.map((r) => toDate(r.toDate)).filter(Boolean).sort((a, b) => a - b); const qs = new Set(ends.map(qkey)); const exp = qlist(ends[0], ends[ends.length - 1]);
    o.results = { firstEnd: iso(ends[0]), lastEnd: iso(ends[ends.length - 1]), quarters: qs.size, expected: exp.length, missing: exp.filter((q) => !qs.has(q)).slice(0, 12), consolidatedShare: +(rr.filter((r) => /^Consolidated/i.test(r.consolidated)).length / rr.length).toFixed(2), withXbrl: rr.filter((r) => r.xbrl && r.xbrl !== '-').length };
    const sorted = rr.slice().sort((a, b) => toDate(a.toDate) - toDate(b.toDate)).filter((r) => r.xbrl && r.xbrl !== '-');
    o.results_xbrl = []; for (const r of pick3(sorted)) { o.results_xbrl.push({ end: iso(toDate(r.toDate)), ...(await xbrlCheck(r.xbrl, FIN)) }); await sleep(300); }
  }
  // does a symbol + date range query return filings after the per-stock list stops (Jan 2025)?
  const R2 = await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&symbol=${encodeURIComponent(s)}&period=Quarterly&from_date=01-02-2025&to_date=${dmy(now)}`, NSEH); await sleep(300);
  const r2 = jarr(R2.t) || []; o.results_recent = { status: R2.status, n: r2.length, last: r2.length ? iso(r2.map((r) => toDate(r.toDate)).filter(Boolean).sort((a, b) => b - a)[0]) : null };
  const H = await get(`https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(s)}`, NSEH); await sleep(300);
  const hh = jarr(H.t) || []; o.shp_status = H.status; o.shp_n = hh.length;
  if (hh.length) {
    const ds = hh.map((r) => toDate(r.date)).filter(Boolean).sort((a, b) => a - b); const qs = new Set(ds.map(qkey)); const exp = qlist(ds[0], ds[ds.length - 1]);
    o.shp = { first: iso(ds[0]), last: iso(ds[ds.length - 1]), quarters: qs.size, expected: exp.length, missing: exp.filter((q) => !qs.has(q)).slice(0, 12), revised: hh.filter((r) => r.revisedStatus && r.revisedStatus !== '-' && r.revisedStatus !== 'null').length };
    const srt = hh.slice().sort((a, b) => toDate(a.date) - toDate(b.date)).filter((r) => r.xbrl && r.xbrl !== '-');
    o.shp_xbrl = []; for (const r of pick3(srt)) { o.shp_xbrl.push({ date: iso(toDate(r.date)), ...(await xbrlCheck(r.xbrl, SHP)) }); await sleep(300); }
  }
  out.india.perStock[s] = o;
}
// Market-wide windows: results by filing window and PIT by year; looking for caps and holes.
const win = [];
for (let y = 2019; y <= 2026; y++) for (let q = 0; q < 4; q++) { const a = new Date(Date.UTC(y, q * 3, 1)), b = new Date(Date.UTC(y, q * 3 + 3, 0)); if (a > now) continue; win.push([a, b > now ? now : b]); }
for (const [a, b] of win) {
  const R = await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly&from_date=${dmy(a)}&to_date=${dmy(b)}`, NSEH); await sleep(400);
  const rr = jarr(R.t) || []; out.india.marketWide[`results_${qkey(a)}`] = { status: R.status, n: rr.length, symbols: new Set(rr.map((r) => r.symbol)).size, standalone: rr.filter((r) => !/^Consolidated/i.test(r.consolidated)).length };
}
for (let y = 2015; y <= 2026; y++) {
  const a = new Date(Date.UTC(y, 0, 1)), b = y === 2026 ? now : new Date(Date.UTC(y, 11, 31));
  const R = await get(`https://www.nseindia.com/api/corporates-pit?index=equities&from_date=${dmy(a)}&to_date=${dmy(b)}`, NSEH); await sleep(500);
  const rr = jarr(R.t) || []; out.india.marketWide[`pit_${y}`] = { status: R.status, n: rr.length, symbols: new Set(rr.map((r) => r.symbol)).size };
}

// ---------- US sample ----------
const tk = JSON.parse((await get('https://www.sec.gov/files/company_tickers.json', {}, SEC_UA)).t); const cikOf = {}; for (const v of Object.values(tk)) cikOf[v.ticker] = String(v.cik_str).padStart(10, '0');
const { readdirSync } = await import('node:fs');
const usSyms = readdirSync('data/us/hist').map((f) => f.replace('.json.gz', '')).sort(); const usSample = usSyms.filter((_, i) => i % 38 === 0);
out.us.sample = usSample;
const CHAIN = { revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet', 'InterestAndDividendIncomeOperating'], netIncome: ['NetIncomeLoss', 'ProfitLoss'], epsDiluted: ['EarningsPerShareDiluted'], assets: ['Assets'], equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], opCashFlow: ['NetCashProvidedByUsedInOperatingActivities'] };
const usGet = (u) => get(u, {}, SEC_UA);
for (const t of usSample) {
  const cik = cikOf[t]; const o = { cik: cik || null };
  if (!cik) { o.err = 'no cik'; out.us.perStock[t] = o; continue; }
  const cf = await usGet(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`); await sleep(220); o.status = cf.status;
  if (cf.status === 200) {
    const g = JSON.parse(cf.t).facts['us-gaap'] || {}; o.concepts = {};
    for (const [name, chain] of Object.entries(CHAIN)) {
      const used = chain.filter((c) => g[c]); let rows = []; for (const c of used) rows = rows.concat(Object.values(g[c].units)[0] || []);
      if (!rows.length) { o.concepts[name] = null; continue; }
      const q = rows.filter((r) => ['Q1', 'Q2', 'Q3', 'FY'].includes(r.fp) && ['10-Q', '10-K'].includes(r.form)); const ends = new Set(q.map((r) => r.end)); const filed = q.map((r) => r.filed).sort();
      const e = [...ends].sort(); o.concepts[name] = { tags: used.length, periods: ends.size, firstEnd: e[0], lastEnd: e[e.length - 1], firstFiled: filed[0], yearsOfFilings: +((new Date(filed[filed.length - 1]) - new Date(filed[0])) / 31557600000).toFixed(1) };
    }
  }
  const sub = await usGet(`https://data.sec.gov/submissions/CIK${cik}.json`); await sleep(220); o.sub_status = sub.status;
  if (sub.status === 200) { const j = JSON.parse(sub.t); const r = j.filings.recent; const f4 = r.filingDate.filter((_, i) => r.form[i] === '4').sort(); o.form4 = { n: f4.length, first: f4[0] || null, olderPages: (j.filings.files || []).length }; }
  out.us.perStock[t] = o;
}
// Delisted filers by known CIK (SVB, Bed Bath & Beyond, First Republic, Signature, Lehman-era Washington Mutual not included).
for (const [n, cik] of [['SIVB', '0000719739'], ['BBBY', '0000886158'], ['FRC', '0001132979'], ['SBNY', '0001288784'], ['GE_old_example_CIT', '0001171825']]) {
  const cf = await usGet(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`); await sleep(220); const sub = await usGet(`https://data.sec.gov/submissions/CIK${cik}.json`); await sleep(220);
  const o = { facts_status: cf.status, sub_status: sub.status };
  if (sub.status === 200) { const j = JSON.parse(sub.t); o.name = j.name; o.tickers = j.tickers; const r = j.filings.recent; o.lastFiled = r.filingDate[0]; o.nRecent = r.form.length; }
  if (cf.status === 200) { const g = JSON.parse(cf.t).facts['us-gaap'] || {}; const rows = Object.values((g.NetIncomeLoss || g.ProfitLoss || { units: { x: [] } }).units)[0]; o.netIncomeRows = rows.length; o.lastEnd = rows.map((r) => r.end).sort().pop() || null; }
  out.us.delisted[n] = o;
}
// FINRA short-interest: which settlement dates exist? Try the last business days of Jun and Dec in sample years.
for (const y of [2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024]) for (const [mo, days] of [[6, [30, 29, 28]], [12, [31, 30, 29]]]) {
  let hit = null; for (const d of days) { const ds = `${y}${String(mo).padStart(2, '0')}${d}`; const r = await get(`https://cdn.finra.org/equity/otcmarket/biweekly/shrt${ds}.csv`, { range: 'bytes=0-200' }); await sleep(150); if (r.status === 206 || r.status === 200) { hit = ds; break; } }
  out.us.finra[`${y}-${mo}`] = hit;
}
writeFileSync('data/probe-filings-coverage.json', JSON.stringify(out, null, 1) + '\n');
console.log('india stocks', Object.keys(out.india.perStock).length, 'us', Object.keys(out.us.perStock).length);
