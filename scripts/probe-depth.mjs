// One-off probe, round 7 (package I-2): (a) depth of SAST, insider and shareholding history with earlier start dates; (b) whether FINRA short-interest files before June 2021 hold exchange-listed names; (c) Nasdaq short-interest depth; (d) which results formats exist across a wide sample of integrated filings. Writes data/probe-depth.json. Public data only.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const NSEH = { ...UA, referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url, h = UA) => { try { const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(90000) }); return { status: r.status, t: await r.text() }; } catch (e) { return { status: 0, t: '' }; } };
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const toD = (v) => { const m = String(v || '').match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/); return m && MON[m[2].toUpperCase()] != null ? new Date(Date.UTC(+m[3], MON[m[2].toUpperCase()], +m[1])) : null; };
const iso = (d) => d.toISOString().slice(0, 10);
const arr = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : j.data || []; } catch { return []; } };
const range = (a, f) => { const d = a.map((x) => toD(x[f])).filter(Boolean).sort((p, q) => p - q); return d.length ? [iso(d[0]), iso(d[d.length - 1])] : null; };
const out = { at: new Date().toISOString(), nse: {}, finra: {}, nasdaq: {}, formats: {} };
// (a) per-symbol depth with early start dates
for (const s of ['RELIANCE', 'ADANIENT', 'KPITTECH', 'JPPOWER', 'TCS', 'HDFCBANK', 'TATASTEEL', 'INFY']) {
  const o = {};
  const sast = arr((await get(`https://www.nseindia.com/api/corporate-sast-reg29?index=equities&symbol=${s}&from_date=01-01-2008&to_date=08-11-2026`, NSEH)).t); await sleep(300); o.sast = { n: sast.length, range: range(sast.map((x) => ({ d: (x.acquirerDate || '').split(' to ')[0] })), 'd'), sys: range(sast, 'sysTime') };
  const pit = arr((await get(`https://www.nseindia.com/api/corporates-pit?index=equities&symbol=${s}&from_date=01-01-2008&to_date=08-11-2026`, NSEH)).t); await sleep(300); o.pit = { n: pit.length, range: range(pit, 'acqfromDt') };
  const shp = arr((await get(`https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${s}&from_date=01-01-2010&to_date=31-12-2021`, NSEH)).t); await sleep(300); o.shp_dated = { n: shp.length, range: range(shp, 'date') };
  const shp0 = arr((await get(`https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${s}`, NSEH)).t); await sleep(300); o.shp_plain = { n: shp0.length, range: range(shp0, 'date') };
  out.nse[s] = o;
}
// (b) FINRA content check by date and market class
for (const d of ['20180629', '20190628', '20210528', '20210630', '20250930']) {
  const r = await get(`https://cdn.finra.org/equity/otcmarket/biweekly/shrt${d}.csv`); const lines = r.t.split(/\r?\n/).filter(Boolean); const hdr = (lines[0] || '').split('|'); const iS = hdr.indexOf('symbolCode'), iM = hdr.indexOf('marketClassCode'), iE = hdr.indexOf('issuerServicesGroupExchangeCode');
  const rows = lines.slice(1).map((l) => l.split('|')); const cnt = (i) => { const c = {}; for (const x of rows) c[x[i]] = (c[x[i]] || 0) + 1; return Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8)); };
  const has = (sym) => rows.some((x) => x[iS] === sym);
  out.finra[d] = { status: r.status, rows: rows.length, marketClass: iM >= 0 ? cnt(iM) : null, exchangeCode: iE >= 0 ? cnt(iE) : null, hasAAPL: has('AAPL'), hasMSFT: has('MSFT'), hasPLUG: has('PLUG'), header: hdr.join(' ').slice(0, 220) };
  await sleep(300);
}
// (c) Nasdaq short interest API depth
const nq = await get('https://api.nasdaq.com/api/quote/AAPL/short-interest?assetClass=stocks', { ...UA, accept: 'application/json', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' });
try { const j = JSON.parse(nq.t); const rows = j.data?.shortInterestTable?.rows || []; out.nasdaq = { status: nq.status, n: rows.length, first: rows[0], last: rows[rows.length - 1] }; } catch { out.nasdaq = { status: nq.status, head: nq.t.slice(0, 120) }; }
// (d) result formats across a wide sample of integrated filings (30-Sep-2025 and 31-Mar-2026), header comment of each XBRL file
const TYPE = encodeURIComponent('Integrated Filing- Financials');
for (const pend of ['30-Sep-2025', '31-Mar-2026']) {
  let all = []; for (let p = 1; p <= 12; p++) { const a = arr((await get(`https://www.nseindia.com/api/integrated-filing-results?index=equities&type=${TYPE}&period_ended=${pend}&page=${p}&size=500`, NSEH)).t); if (!a.length) break; all = all.concat(a); await sleep(300); }
  const cons = all.filter((x) => /^Consolidated/i.test(x.consolidated)); const stand = all.filter((x) => !/^Consolidated/i.test(x.consolidated));
  const pool = all.filter((_, i) => i % Math.ceil(all.length / 220) === 0).slice(0, 220);
  const tally = {}, ex = {}, fails = { n: 0, statuses: {} };
  for (const rec of pool) {
    const r = await get(rec.xbrl); if (r.status !== 200) { fails.n++; fails.statuses[r.status] = (fails.statuses[r.status] || 0) + 1; await sleep(150); continue; }
    const hdr = (r.t.match(/<!--([^>]*?)-->/) || [])[1] || 'none'; const pre = [...new Set([...r.t.matchAll(/<(in-[\w-]+):/g)].map((m) => m[1]))].join('+');
    const hasRev = /<in-[\w-]+:(RevenueFromOperations|RevenueOnInvestments|InterestEarned|PremiumEarned|NetPremium)\b/.test(r.t), hasPat = /<in-[\w-]+:(ProfitLossForPeriod\w*|ProfitLossForThePeriod|ProfitLossForPeriodFromContinuingOperations|ProfitLossAfterTax\w*|NetProfitLoss\w*)\b/.test(r.t), hasEps = /EarningsLossPerShare|EarningsPerShare/.test(r.t);
    const key = `${hdr.replace(/\s*V[\d.]+.*$/, '').trim()} | ${pre}`; tally[key] = tally[key] || { n: 0, rev: 0, pat: 0, eps: 0 }; tally[key].n++; if (hasRev) tally[key].rev++; if (hasPat) tally[key].pat++; if (hasEps) tally[key].eps++;
    if (!ex[key]) ex[key] = rec.smName || rec.symbol; await sleep(150);
  }
  out.formats[pend] = { totalRecords: all.length, consolidated: cons.length, standalone: stand.length, sampled: pool.length, fetchFails: fails, tally, example: ex };
}
writeFileSync('data/probe-depth.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ finra: Object.fromEntries(Object.entries(out.finra).map(([k, v]) => [k, [v.status, v.rows, v.hasAAPL]])), nasdaq: [out.nasdaq.status, out.nasdaq.n], formats: Object.fromEntries(Object.entries(out.formats).map(([k, v]) => [k, Object.keys(v.tally).length])) }));
