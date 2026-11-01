// Look-ahead test of the across-category overall fund score (Engine Rules C-144). Fetches NAV history for the equity and hybrid Direct-Growth schemes the
// scoring covers plus the Liquid funds (cash rate), runs src/pm/overallscore.ts, writes data/funds/backtest-overall.json. Usage: node scripts/fund-overall-test.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { normCategory, scorable } from '../src/pm/fundscore.ts';
import { debtGroup } from '../src/pm/fundrisk.ts';
import { overallTest, OS } from '../src/pm/overallscore.ts';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const amfi = J('data/rules/amfi-schemes.json'), asOf = new Date().toISOString().slice(0, 10), SNAP = Date.parse((amfi.asOf ?? asOf) + 'T23:59:59Z');
if (Date.now() - SNAP > 35 * 86400000) { console.error('AMFI scheme list is more than 35 days old: refresh it first'); process.exit(1); }
const ts = (s) => { const [d, m, y] = s.split('-'); return Date.parse(`${d} ${m} ${y} UTC`); }, recent = (s) => Number.isFinite(ts(s)) && SNAP - ts(s) < 12 * 86400000;
const extraDirect = new Set((J('data/rules/direct-growth-codes.json', { records: [] }).records || []).map((x) => x.code));
const direct = (r) => (/^Direct/i.test(r[5]) && /^Growth/i.test(r[6])) || extraDirect.has(r[0]);
const funds = [], cash = [], seen = new Set();
for (const r of amfi.rows) {
  if (!direct(r) || !recent(r[8]) || seen.has(r[0])) continue;
  if (scorable(normCategory(r[4]))) { funds.push(r[0]); seen.add(r[0]); }
  else if (debtGroup(r[4]) === 'Liquid') { cash.push(r[0]); seen.add(r[0]); }
}
console.log('equity and hybrid funds', funds.length, 'liquid funds', cash.length);
const series = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
await pool([...funds, ...cash], async (code) => {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch('https://api.mfapi.in/mf/' + code); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(), m = {}; for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; } if (Object.keys(m).length) series.set(code, m); return; }
    catch { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
  }
}, 8);
const broken = (m) => { const d = Object.keys(m).sort(); for (let i = 1; i < d.length; i++) { const r = m[d[i]] / m[d[i - 1]]; if (r > 1.4 || r < 0.6) return d[i]; } return null; };
for (const [k, m] of [...series]) if (broken(m)) series.delete(k);
console.log('fetched', series.size, 'of', funds.length + cash.length, 'failed', failed);
if (series.size < (funds.length + cash.length) * 0.8) { console.error('too many fetch failures; no result written'); process.exit(1); }
const res = overallTest(funds, cash, series);
mkdirSync('data/funds', { recursive: true });
writeFileSync('data/funds/backtest-overall.json', JSON.stringify({ ranOn: asOf, rule: 'C-144', params: OS, universe: { funds: funds.length, cash: cash.length, withHistory: series.size }, ...res }) + '\n');
console.log('C-144', JSON.stringify({ counted: res.counted, beat: res.beat, medianEx: res.medianEx, worstTop: res.worstTop, worstAll: res.worstAll, beatBottom: res.beatBottom, parts: res.parts, pass: res.pass }));
console.log(JSON.stringify(res.years.map((y) => [y.date.slice(0, 4), y.eligible, +y.topSharpe.toFixed(2), +y.allSharpe.toFixed(2), +y.botSharpe.toFixed(2), +y.retRank3Sharpe.toFixed(2), +y.topRet.toFixed(1), +y.allRet.toFixed(1)])));
