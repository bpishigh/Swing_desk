// Thematic funds scored against their own theme (Engine Rules C-102) and international funds scored with the C-82 score (C-103): the C-81 Tests A and B on each.
// Writes data/funds/backtest-thematic.json and data/funds/backtest-intl.json. Usage: node scripts/fund-themeintl-test.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { normCategory, SETTINGS, scoreAll } from '../src/pm/fundscore.ts';
import { runBacktest, BT } from '../src/pm/fundbacktest.ts';
import { scoreRisk, intlGroup, RISK } from '../src/pm/fundrisk.ts';
import { themeOf } from '../src/pm/fundtheme.ts';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const amfi = J('data/rules/amfi-schemes.json'), asOf = new Date().toISOString().slice(0, 10), SNAP = Date.parse((amfi.asOf ?? asOf) + 'T23:59:59Z');
if (Date.now() - SNAP > 35 * 86400000) { console.error('AMFI scheme list is more than 35 days old: refresh it first'); process.exit(1); }
const ts = (s) => { const [d, m, y] = s.split('-'); return Date.parse(`${d} ${m} ${y} UTC`); };
const recent = (s) => Number.isFinite(ts(s)) && SNAP - ts(s) < 12 * 86400000, recentIntl = (s) => Number.isFinite(ts(s)) && Date.now() - ts(s) < 35 * 86400000;
const extraDirect = new Set((J('data/rules/direct-growth-codes.json', { records: [] }).records || []).map((x) => x.code));
const direct = (r) => (/^Direct/i.test(r[5]) && /^Growth/i.test(r[6])) || extraDirect.has(r[0]);
const rec = (r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] });
const thematic = amfi.rows.filter((r) => direct(r) && recent(r[8]) && normCategory(r[4]) === 'Sectoral/Thematic').map(rec).filter((x) => themeOf(x.name));
const intl = amfi.rows.filter((r) => direct(r) && recentIntl(r[8]) && intlGroup(r[3], r[4])).map(rec);
console.log('thematic', thematic.length, 'international', intl.length);
const series = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
await pool([...thematic, ...intl], async (s) => {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch('https://api.mfapi.in/mf/' + s.code); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(), m = {}; for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; } if (Object.keys(m).length) series.set(s.code, m); return; }
    catch { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
  }
}, 8);
const broken = (m) => { const d = Object.keys(m).sort(); for (let i = 1; i < d.length; i++) { const r = m[d[i]] / m[d[i - 1]]; if (r > 1.4 || r < 0.6) return d[i]; } return null; };
for (const [k, m] of [...series]) if (broken(m)) series.delete(k);
console.log('fetched', series.size, 'of', thematic.length + intl.length, 'failed', failed);
if (series.size < (thematic.length + intl.length) * 0.8) { console.error('too many fetch failures; no result written'); process.exit(1); }
const pts = (r) => r.points.map((p) => [p.date.slice(0, 4), p.scored, p.strong, p.weak, p.medExcessStrong === null ? null : +p.medExcessStrong.toFixed(2), p.medExcessWeak === null ? null : +p.medExcessWeak.toFixed(2)]);
mkdirSync('data/funds', { recursive: true });
// C-102: own-theme groups (5 funds needed) against the whole category as one group (today's practice elsewhere)
const own = runBacktest(thematic, series, undefined, (sc, cut, T) => scoreAll(sc, cut, T, { ...SETTINGS, minPeers: 5 }, (x) => themeOf(x.name)), undefined, BT);
const whole = runBacktest(thematic, series, undefined, (sc, cut, T) => scoreAll(sc, cut, T, SETTINGS, () => 'Sectoral/Thematic'), undefined, BT);
const th = { ranOn: asOf, rule: 'C-102', params: BT, funds: thematic.length, withHistory: thematic.filter((x) => series.has(x.code)).length, ownTheme: { testA: own.testA, testB: own.testB, points: own.points }, wholeCategory: { testA: whole.testA, testB: whole.testB, points: whole.points } };
writeFileSync('data/funds/backtest-thematic.json', JSON.stringify(th) + '\n');
console.log('C-102 own theme:', JSON.stringify({ A: own.testA, B: own.testB, pts: pts(own) })); console.log('C-102 whole category:', JSON.stringify({ A: whole.testA, B: whole.testB, pts: pts(whole) }));
// C-103: the C-82 score (no cost component), groups of 3, a band needs 5 funds in a year
const IBT = { ...BT, minGroup: 5 };
const ir = runBacktest(intl, series, undefined, (sc, cut, T) => scoreRisk(sc, cut, T, (x) => intlGroup(x.name, x.category), new Map(), () => RISK.minPeersIntl, () => false), undefined, IBT);
writeFileSync('data/funds/backtest-intl.json', JSON.stringify({ ranOn: asOf, rule: 'C-103', params: IBT, funds: intl.length, withHistory: intl.filter((x) => series.has(x.code)).length, testable: ir.testA.counted >= IBT.minYears || ir.testB.counted >= IBT.minYears, ...ir }) + '\n');
console.log('C-103 international:', JSON.stringify({ A: ir.testA, B: ir.testB, pts: pts(ir) }));
