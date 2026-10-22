// Fund-score back-test (Engine Rules C-81). Fetches NAV history for the same Direct-Growth schemes the monthly scoring uses, runs the fixed test, writes
// data/funds/backtest.json (read by the Portfolio page to switch Replace on or off) and docs/replay/FUND-BACKTEST-<date>.md. Usage: node scripts/fund-backtest.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normCategory } from '../src/pm/fundscore.ts';
import { runBacktest, BT } from '../src/pm/fundbacktest.ts';
// The test covers the categories whose verdict is Keep, Watch or Replace (C-81): plain equity categories. Sector and thematic funds use the stock lens and hybrids get no verdict, so they are not in the sample.
const PURE_EQUITY = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
const amfi = JSON.parse(readFileSync('data/rules/amfi-schemes.json', 'utf8'));
const asOf = new Date().toISOString().slice(0, 10);
const recent = (s) => { const [d, m, y] = s.split('-'); const t = Date.parse(`${d} ${m} ${y} UTC`); return Number.isFinite(t) && Date.now() - t < 12 * 86400000; };
const direct = (r) => /^Direct/i.test(r[5]) && /^Growth/i.test(r[6]);
const mf = amfi.rows.filter((r) => direct(r) && recent(r[8]) && PURE_EQUITY.has(normCategory(r[4]))).map((r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] }));
console.log('schemes', mf.length);
const series = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
await pool(mf, async (s) => {
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
const res = runBacktest(mf, series);
mkdirSync('data/funds', { recursive: true }); mkdirSync('docs/replay', { recursive: true });
writeFileSync('data/funds/backtest.json', JSON.stringify({ ranOn: asOf, rule: 'C-81', params: BT, ...res }) + '\n');
const f = (v) => (v === null ? '–' : v.toFixed(2));
const rows = res.points.map((p) => `| ${p.date} | ${p.scored} | ${p.strong} | ${f(p.medExcessStrong)} | ${p.countedA ? (p.passA ? 'pass' : 'fail') : 'not counted'} | ${p.weak} | ${f(p.medExcessWeak)} | ${p.countedB ? (p.passB ? 'pass' : 'fail') : 'not counted'} |`).join('\n');
writeFileSync(`docs/replay/FUND-BACKTEST-${asOf}.md`, `# Fund-score back-test (C-81), run ${asOf}\n\nCriteria fixed in Engine Rules C-81 before this run. ${res.funds} Direct-Growth equity schemes alive today (survivorship bias: closed and merged funds are missing, which flatters every group). Score = unchanged FUND-3 settings using only NAVs up to 1 October of each year; forward return = the next 12 months; excess = fund minus its category median, in percentage points.\n\n| Year | Funds scored | Strong funds | Median excess, Strong | Test A | Weak funds | Median excess, Weak | Test B |\n|---|---|---|---|---|---|---|---|\n${rows}\n\n**Test A (Strong beats the median):** ${res.testA.passed} of ${res.testA.counted} counted years pass → ${res.testA.pass ? 'PASS' : 'FAIL'} (needs ${BT.passShare * 100}% and at least ${BT.minYears} years).\n\n**Test B (Weak trails the median):** ${res.testB.passed} of ${res.testB.counted} counted years pass → ${res.testB.pass ? 'PASS' : 'FAIL'}.\n\n**Replace verdicts: ${res.replaceOn ? 'ON' : 'OFF'}** (on only if both tests pass). Nothing was tuned.\n`);
console.log(JSON.stringify({ A: res.testA, B: res.testB, replaceOn: res.replaceOn }));
