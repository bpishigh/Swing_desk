// One-off probe (9 Nov 2026): can the older market-wide results list (corporates-financial-results) feed the loader for quarters before Mar 2025? Samples filings in four filing windows, checks listing size, XBRL link presence, whether the current parser reads them, and which tags carry revenue/PBT/PAT/EPS. Runs on the runner. Writes data/probe-old-results.json.
import { writeFileSync, readFileSync } from 'node:fs';
const maps = JSON.parse(readFileSync('settings/filings-tags.json', 'utf8'));
import { parseResultsXbrl } from '../src/ingest/filings-parse.ts';
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', referer: 'https://www.nseindia.com/', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) }); if (r.status === 200) return { status: 200, t: await r.text() }; if (r.status === 404) return { status: 404, t: '' }; } catch {} await sleep(1500 * (k + 1)); } return { status: 0, t: '' }; };
await get('https://www.nseindia.com/');
const windows = [['Dec 2024 quarter', '01-01-2025', '28-02-2025'], ['Mar 2024 quarter', '01-04-2024', '30-06-2024'], ['Mar 2022 quarter', '01-04-2022', '30-06-2022'], ['Mar 2020 quarter', '01-04-2020', '31-07-2020']];
const out = { when: new Date().toISOString(), windows: {} };
const T = { revenue: /^(RevenueFromOperations|Income|TotalRevenue|Revenue|SalesOrRevenueFromOperations|IncomeFromOperations|TotalIncome|TotalIncomeFromOperations|NetSales|NetSalesOrIncomeFromOperations)$/i, pbt: /^(ProfitBeforeTax|ProfitLossBeforeTax|ProfitLossFromOrdinaryActivitiesBeforeTax|ProfitBeforeTaxAndExceptionalItems)$/i, pat: /^(ProfitLossForPeriod|ProfitLossForThePeriod|NetProfitLossForThePeriod|ProfitLossAfterTaxAndExtraordinaryItems|ProfitAfterTax|ProfitLossForPeriodFromContinuingOperations)$/i, eps: /EarningsLossPerShare|EarningsPerShare/i };
for (const [name, a, b] of windows) {
  const R = await get(`https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly&from_date=${a}&to_date=${b}`); await sleep(500);
  let rows = []; try { const j = JSON.parse(R.t); rows = Array.isArray(j) ? j : j.data || []; } catch {}
  const w = { status: R.status, n: rows.length, keys: rows[0] ? Object.keys(rows[0]) : [], withXbrl: rows.filter((r) => r.xbrl && /^https?:/.test(r.xbrl)).length, sampleRow: rows[0] || null, sample: [] };
  const withX = rows.filter((r) => r.xbrl && /^https?:/.test(r.xbrl)); const step = Math.max(1, Math.floor(withX.length / 40)); const pick = withX.filter((_, i) => i % step === 0).slice(0, 40);
  let ok404 = 0, parsed = 0, tagHit = { revenue: 0, pbt: 0, pat: 0, eps: 0 }, all4 = 0; const taxo = {}, err = {};
  for (const r of pick) {
    const x = await get(r.xbrl); await sleep(200);
    if (x.status !== 200) { ok404++; continue; }
    const tx = /xmlns:([a-z\-]+)="http[^"]*(in-bse-fin|in-capmkt)/i.exec(x.t); taxo[tx ? tx[2] : 'other'] = (taxo[tx ? tx[2] : 'other'] || 0) + 1;
    try { const p = parseResultsXbrl(x.t, maps); if (p.ok && p.missing.length === 0) parsed++; else { const k = p.ok ? 'missing:' + p.missing.join(',') : p.error; err[k] = (err[k] || 0) + 1; } } catch (e) { err['throw ' + String(e.message).slice(0, 50)] = 1; }
    const tags = new Set([...x.t.matchAll(/<([A-Za-z\-]+:)?([A-Za-z0-9]+)\s[^>]*contextRef="(OneD|CurrentQuarter|[^"]*)"/g)].map((m) => m[2]));
    const hit = {}; for (const k of Object.keys(T)) { hit[k] = [...tags].some((t) => T[k].test(t)); if (hit[k]) tagHit[k]++; } if (Object.values(hit).every(Boolean)) all4++;
  }
  Object.assign(w, { sampled: pick.length, fetch404or0: ok404, taxonomy: taxo, parsedByCurrentParser: parsed, tagHit, allFour: all4, parseErrors: err });
  out.windows[name] = w; console.log(name, JSON.stringify({ ...w, sampleRow: undefined }));
}
writeFileSync('data/probe-old-results.json', JSON.stringify(out, null, 1));
