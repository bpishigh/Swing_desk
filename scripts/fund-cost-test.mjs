// Cost in the score (Engine Rules C-108): Variant A = live FUND-3 score; Variant B = 0.85 x FUND-3 + 0.15 x (100 - cost percentile) inside the category.
// Expense ratio at each 1 October comes from the fund page's own history (last row on or before the date, at most 31 days old). Plain-equity categories only.
// Writes data/funds/backtest-cost.json. Usage: node scripts/fund-cost-test.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { normCategory, scoreAll } from '../src/pm/fundscore.ts';
import { runBacktest, BT } from '../src/pm/fundbacktest.ts';
const PURE = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
const amfi = JSON.parse(readFileSync('data/rules/amfi-schemes.json', 'utf8')), asOf = new Date().toISOString().slice(0, 10), SNAP = Date.parse((amfi.asOf ?? asOf) + 'T23:59:59Z');
if (Date.now() - SNAP > 35 * 86400000) { console.error('AMFI scheme list is more than 35 days old'); process.exit(1); }
const ts = (s) => { const [d, m, y] = s.split('-'); return Date.parse(`${d} ${m} ${y} UTC`); }, recent = (s) => Number.isFinite(ts(s)) && SNAP - ts(s) < 12 * 86400000;
const extra = new Set((existsSync('data/rules/direct-growth-codes.json') ? JSON.parse(readFileSync('data/rules/direct-growth-codes.json', 'utf8')).records || [] : []).map((x) => x.code));
const direct = (r) => (/^Direct/i.test(r[5]) && /^Growth/i.test(r[6])) || extra.has(r[0]);
const mf = amfi.rows.filter((r) => direct(r) && recent(r[8]) && PURE.has(normCategory(r[4]))).map((r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] }));
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
async function pool(items, fn, n = 6) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
const get = async (u, json) => { for (let a = 0; a < 3; a++) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(40000) }); if (r.ok) return json ? await r.json() : await r.text(); if (r.status === 404) return null; } catch {} await new Promise((r) => setTimeout(r, 1200 * (a + 1))); } return null; };
const series = new Map(), ter = new Map(); let navFail = 0, terFail = 0;
await pool(mf, async (s) => {
  const j = await get('https://api.mfapi.in/mf/' + s.code, true); if (!j) { navFail++; return; }
  const m = {}; for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; } if (Object.keys(m).length) series.set(s.code, m);
});
const broken = (m) => { const d = Object.keys(m).sort(); for (let i = 1; i < d.length; i++) { const r = m[d[i]] / m[d[i - 1]]; if (r > 1.4 || r < 0.6) return d[i]; } return null; };
for (const [k, m] of [...series]) if (broken(m)) series.delete(k);
console.log('NAV series', series.size, 'of', mf.length);
await pool(mf.filter((x) => series.has(x.code)), async (s) => {
  const q = encodeURIComponent(s.name.replace(/ - /g, ' ').replace(/direct plan|growth option|growth/gi, '').trim());
  const r = await get(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${q}&size=8`, true); const hit = r?.content?.find((x) => String(x.scheme_code) === String(s.code) || (x.isin && x.isin === s.isin));
  if (!hit) { terFail++; return; }
  const html = await get(`https://groww.in/mutual-funds/${hit.search_id}`); const m = html && /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) { terFail++; return; }
  let d; try { d = JSON.parse(m[1]).props.pageProps.mfServerSideData; } catch { terFail++; return; }
  if (String(d?.scheme_code ?? s.code) !== String(s.code)) { terFail++; return; }
  const rows = (d.historic_fund_expense || []).map((x) => [String(x.as_on_date).slice(0, 10), Number(x.expense_ratio)]).filter((x) => x[1] > 0).sort((a, b) => a[0].localeCompare(b[0]));
  if (rows.length) ter.set(s.code, rows);
});
console.log('expense history for', ter.size, 'funds; failed', terFail);
const erOn = (code, T) => { const rows = ter.get(code); if (!rows) return null; let r = null; for (const x of rows) { if (x[0] <= T) r = x; else break; } if (!r) return null; return (Date.parse(T) - Date.parse(r[0])) / 86400000 <= 31 ? r[1] : null; };
const span = [...ter.values()].map((r) => r[0][0]).sort(); const firstDates = { earliest: span[0], median: span[Math.floor(span.length / 2)], latest: span[span.length - 1] };
const pctRank = (v, all) => (all.filter((x) => x < v).length + 0.5 * all.filter((x) => x === v).length) / all.length * 100;
const catOf = (x) => normCategory(x.category);
// Variant A and B are scored on the same funds each year: only funds with an expense ratio at the date, and only years with >= 30 such funds
const yearsOk = {};
const fundsAt = (T) => mf.filter((x) => erOn(x.code, T) !== null);
const scorerA = (sc, cut, T) => { const ok = fundsAt(T); if (ok.length < 30) return []; const set = new Set(ok.map((x) => x.code)); return scoreAll(sc.filter((x) => set.has(x.code)), cut, T); };
const scorerB = (sc, cut, T) => {
  const ok = fundsAt(T); if (ok.length < 30) return []; const set = new Set(ok.map((x) => x.code)); const base = scoreAll(sc.filter((x) => set.has(x.code)), cut, T);
  const byCat = new Map(); for (const r of base) if (r.score !== null) (byCat.get(r.cat) ?? byCat.set(r.cat, []).get(r.cat)).push(r);
  const out = [];
  for (const [, list] of byCat) { const ers = list.map((r) => erOn(r.code, T)); const rescored = list.map((r, i) => ({ ...r, score: Math.round((0.85 * r.score + 0.15 * (100 - pctRank(ers[i], ers))) * 10) / 10 })); for (const r of rescored) r.band = r.score >= 75 ? 'Strong' : r.score < 25 ? 'Weak' : 'Average'; out.push(...rescored); }
  return out;
};
const A = runBacktest(mf, series, undefined, scorerA, undefined, BT), B = runBacktest(mf, series, undefined, scorerB, undefined, BT);
const pts = (r) => r.points.map((p) => [p.date.slice(0, 4), p.scored, p.strong, p.weak, p.medExcessStrong === null ? null : +p.medExcessStrong.toFixed(2), p.medExcessWeak === null ? null : +p.medExcessWeak.toFixed(2)]);
const testedYears = A.points.filter((p) => p.scored > 0).length;
const pass = (r) => r.testA.pass && r.testB.pass, testable = A.testA.counted >= BT.minYears || A.testB.counted >= BT.minYears;
const verdict = !testable ? 'not testable: fewer than 5 counted years of expense history' : pass(B) && !pass(A) ? 'B passes, A fails: add cost at 0.15' : pass(B) && pass(A) ? 'both pass: add cost at 0.15 (rule: B passes)' : 'B fails: score unchanged, cost stays a displayed fact';
mkdirSync('data/funds', { recursive: true });
writeFileSync('data/funds/backtest-cost.json', JSON.stringify({ ranOn: asOf, rule: 'C-108', params: BT, funds: mf.length, withNav: series.size, withExpenseHistory: ter.size, firstDates, testedYears, testable, verdict, variantA: A, variantB: B }) + '\n');
console.log('history starts', JSON.stringify(firstDates)); console.log('A', JSON.stringify({ A: A.testA, B: A.testB, pts: pts(A) })); console.log('B', JSON.stringify({ A: B.testA, B: B.testB, pts: pts(B) })); console.log('verdict:', verdict);
