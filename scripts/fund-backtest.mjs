// Fund-score back-test (Engine Rules C-81). Fetches NAV history for the same Direct-Growth schemes the monthly scoring uses, runs the fixed test, writes
// data/funds/backtest.json (read by the Portfolio page to switch Replace on or off) and docs/replay/FUND-BACKTEST-<date>.md. Usage: node scripts/fund-backtest.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normCategory } from '../src/pm/fundscore.ts';
import { runBacktest, BT } from '../src/pm/fundbacktest.ts';
import { scoreRisk, debtGroup, RISK } from '../src/pm/fundrisk.ts';
import { indexKey } from '../src/pm/fundscore.ts';
// The test covers the categories whose verdict is Keep, Watch or Replace (C-81): plain equity categories. Sector and thematic funds use the stock lens and hybrids get no verdict, so they are not in the sample.
const PURE_EQUITY = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
const amfi = JSON.parse(readFileSync('data/rules/amfi-schemes.json', 'utf8'));
const asOf = new Date().toISOString().slice(0, 10);
const recent = (s) => { const [d, m, y] = s.split('-'); const t = Date.parse(`${d} ${m} ${y} UTC`); return Number.isFinite(t) && Date.now() - t < 12 * 86400000; };
const direct = (r) => /^Direct/i.test(r[5]) && /^Growth/i.test(r[6]);
const mf = amfi.rows.filter((r) => direct(r) && recent(r[8]) && PURE_EQUITY.has(normCategory(r[4]))).map((r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] }));
const debt = amfi.rows.filter((r) => direct(r) && recent(r[8]) && debtGroup(r[4])).map((r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] }));
// C-85: index funds (Nifty 50, Midcap 150, Smallcap 250, 500) and liquid funds for the index and cash tests
const idxFunds = amfi.rows.filter((r) => direct(r) && recent(r[8]) && /index/i.test(r[3] + r[4]) && !/fund of fund|etf/i.test(r[3]) && ['Nifty 50', 'Nifty Midcap 150', 'Nifty Smallcap 250', 'Nifty 500'].includes(indexKey(r[3]))).map((r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] }));
const liquid = debt.filter((x) => debtGroup(x.category) === 'Liquid').map((x) => x.code);
console.log('schemes', mf.length, 'debt', debt.length, 'index', idxFunds.length, 'liquid', liquid.length);
const series = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
await pool([...mf, ...debt, ...idxFunds.filter((x) => !debt.some((d) => d.code === x.code))], async (s) => {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch('https://api.mfapi.in/mf/' + s.code); if (!r.ok) throw new Error('status ' + r.status);
      const j = await r.json(), m = {};
      for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; }
      if (Object.keys(m).length) series.set(s.code, m); return;
    } catch { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
  }
}, 8);
const broken = (m) => { const d = Object.keys(m).sort(); for (let i = 1; i < d.length; i++) { const r = m[d[i]] / m[d[i - 1]]; if (r > 1.4 || r < 0.6) return d[i]; } return null; };
for (const [k, m] of [...series]) if (broken(m)) series.delete(k);
console.log('fetched', series.size, 'of', mf.length, 'failed', failed);
if (series.size < mf.length * 0.8) { console.error('too many fetch failures; no result written'); process.exit(1); }
const res = runBacktest(mf, series, undefined, undefined, { idx: idxFunds, liquid });
// C-82, information only: the same test on the risk-aware score for debt groups (no TER at past dates, so cost is left out of this run)
const debtRes = runBacktest(debt, series, undefined, (sc, cut, T) => scoreRisk(sc, cut, T, (x) => debtGroup(x.category), new Map(), () => RISK.minPeersDebt));
mkdirSync('data/funds', { recursive: true }); mkdirSync('docs/replay', { recursive: true });
writeFileSync('data/funds/backtest.json', JSON.stringify({ ranOn: asOf, rule: 'C-81', params: BT, ...res, debt: { rule: 'C-82', informationOnly: true, ...debtRes } }) + '\n');
const f = (v) => (v === null ? '–' : v.toFixed(2));
const rows = res.points.map((p) => `| ${p.date} | ${p.scored} | ${p.strong} | ${f(p.medExcessStrong)} | ${p.countedA ? (p.passA ? 'pass' : 'fail') : 'not counted'} | ${p.weak} | ${f(p.medExcessWeak)} | ${p.countedB ? (p.passB ? 'pass' : 'fail') : 'not counted'} |`).join('\n');
writeFileSync(`docs/replay/FUND-BACKTEST-${asOf}.md`, `# Fund-score back-test (C-81), run ${asOf}\n\nCriteria fixed in Engine Rules C-81 before this run. ${res.funds} Direct-Growth equity schemes alive today (survivorship bias: closed and merged funds are missing, which flatters every group). Score = unchanged FUND-3 settings using only NAVs up to 1 October of each year; forward return = the next 12 months; excess = fund minus its category median, in percentage points.\n\n| Year | Funds scored | Strong funds | Median excess, Strong | Test A | Weak funds | Median excess, Weak | Test B |\n|---|---|---|---|---|---|---|---|\n${rows}\n\n**Test A (Strong beats the median):** ${res.testA.passed} of ${res.testA.counted} counted years pass → ${res.testA.pass ? 'PASS' : 'FAIL'} (needs ${BT.passShare * 100}% and at least ${BT.minYears} years).\n\n**Test B (Weak trails the median):** ${res.testB.passed} of ${res.testB.counted} counted years pass → ${res.testB.pass ? 'PASS' : 'FAIL'}.\n\n**Replace verdicts: ${res.replaceOn ? 'ON' : 'OFF'}** (on only if both tests pass). Nothing was tuned.\n\n## Index and cash tests (C-85)\n\nTest D (below the segment index funds' 3-year median, then trail them next year): ${res.testD.passed} of ${res.testD.counted} counted years → ${res.testD.pass ? 'PASS (rule on)' : 'FAIL or not testable (rule off)'}. Test E (below the liquid funds' 3-year median, then trail cash): ${res.testE.passed} of ${res.testE.counted} counted years → ${res.testE.pass ? 'PASS (rule on)' : 'FAIL or not testable (rule off)'}.\n\n| Year | Funds below index | Median excess vs index | Funds below cash | Median excess vs cash |\n|---|---|---|---|---|\n${res.points.map((p) => `| ${p.date} | ${p.nD} | ${f(p.medD)} | ${p.nE} | ${f(p.medE)} |`).join('\n')}\n\n## Near the bottom quarter (C-83)\n\nTest C: funds scoring from 25 up to ${BT.nearWeakTo} trail their category median: ${res.testC.passed} of ${res.testC.counted} counted years → ${res.testC.pass ? 'PASS (those funds read Watch)' : 'FAIL (band unchanged)'}.\n\n| Year | Funds 25 to ${BT.nearWeakTo} | Median excess |\n|---|---|---|\n${res.points.map((p) => `| ${p.date} | ${p.near} | ${f(p.medExcessNear)} |`).join('\n')}\n\n## Debt funds, risk-aware score (C-82, information only)\n\n${debt.length} debt schemes. Cost is left out of this run (no expense ratio at past dates). Test A (Strong beats the group median): ${debtRes.testA.passed} of ${debtRes.testA.counted} years → ${debtRes.testA.pass ? 'PASS' : 'FAIL'}. Test B (Weak trails): ${debtRes.testB.passed} of ${debtRes.testB.counted} years → ${debtRes.testB.pass ? 'PASS' : 'FAIL'}. Replace is not available for debt funds whatever the result.\n\n| Year | Strong funds | Median excess, Strong | Weak funds | Median excess, Weak |\n|---|---|---|---|---|\n${debtRes.points.map((p) => `| ${p.date} | ${p.strong} | ${f(p.medExcessStrong)} | ${p.weak} | ${f(p.medExcessWeak)} |`).join('\n')}\n`);
console.log(JSON.stringify({ A: res.testA, B: res.testB, replaceOn: res.replaceOn }));
