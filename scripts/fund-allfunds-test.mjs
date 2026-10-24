// All fund types together, cross-group allocation back-test (Engine Rules C-100). Fetches NAV history for every Direct-Growth scheme and ETF the scoring covers,
// groups them (category, theme, index, market, debt group), runs src/pm/alltilt.ts and writes data/funds/backtest-allfunds.json. Usage: node scripts/fund-allfunds-test.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { normCategory, scorable, indexKey } from '../src/pm/fundscore.ts';
import { debtGroup, intlGroup } from '../src/pm/fundrisk.ts';
import { themeOf } from '../src/pm/fundtheme.ts';
import { allFundsTilt, AT } from '../src/pm/alltilt.ts';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const amfi = J('data/rules/amfi-schemes.json'), alloc = J('settings/allocation.json'), asOf = new Date().toISOString().slice(0, 10);
const SNAP = Date.parse((amfi.asOf ?? asOf) + 'T23:59:59Z');
if (Date.now() - SNAP > 35 * 86400000) { console.error('AMFI scheme list is more than 35 days old: refresh it first'); process.exit(1); }
const ts = (s) => { const [d, m, y] = s.split('-'); return Date.parse(`${d} ${m} ${y} UTC`); };
const recent = (s) => Number.isFinite(ts(s)) && SNAP - ts(s) < 12 * 86400000, recentIntl = (s) => Number.isFinite(ts(s)) && Date.now() - ts(s) < 35 * 86400000;
const extraDirect = new Set((J('data/rules/direct-growth-codes.json', { records: [] }).records || []).map((x) => x.code));
const direct = (r) => (/^Direct/i.test(r[5]) && /^Growth/i.test(r[6])) || extraDirect.has(r[0]);
const isEtfRow = (r) => r[5] === '' && /\bETF\b|BeES|Exchange Traded/i.test(r[3]) && !/IDCW|dividend/i.test(r[3]);
const HYBRID = new Set(['Aggressive Hybrid', 'Balanced Advantage', 'Multi Asset Allocation', 'Equity Savings']);
const members = new Map(), add = (code, group, cls, type) => { if (!members.has(code)) members.set(code, { code, group, cls, type }); };
for (const r of amfi.rows) {
  if (direct(r) && recent(r[8]) && scorable(normCategory(r[4]))) {
    const c = normCategory(r[4]);
    if (c === 'Sectoral/Thematic') add(r[0], 'th:' + (themeOf(r[3]) ?? 'other'), 'sector_thematic', 'thematic');
    else if (HYBRID.has(c)) add(r[0], 'hy:' + c, 'hybrid', 'hybrid');
    else add(r[0], 'eq:' + c, 'active_equity_fund', 'equity');
  }
  if ((direct(r) || isEtfRow(r)) && recent(r[8]) && /index|etf|bees|exchange traded/i.test(r[3] + r[4]) && !/fund of fund/i.test(r[3])) { const k = indexKey(r[3]); if (k) add(r[0], 'idx:' + k, k === 'Gold' ? 'gold' : k === 'Silver' ? 'silver' : 'index', k === 'Gold' || k === 'Silver' ? 'gold and silver' : 'index'); }
  if (direct(r) && recent(r[8])) { const g = debtGroup(r[4]); if (g) add(r[0], 'debt:' + g, g === 'Liquid' || g === 'Overnight' ? 'liquid' : 'debt', 'debt'); }
  if (direct(r) && recentIntl(r[8])) { const g = intlGroup(r[3], r[4]); if (g) add(r[0], 'intl:' + g, 'international', 'international'); }
}
const list = [...members.values()], types = {}; for (const m of list) types[m.type] = (types[m.type] ?? 0) + 1;
console.log('funds', list.length, JSON.stringify(types));
// the Balanced preset at the middle horizon, over the fund classes only (direct equity left out, the rest rescaled in alltilt)
const eq = alloc.equityShare.Balanced[2], direct0 = alloc.equitySplit.directEquity.Balanced, rest = alloc.equitySplit.rest, ne = alloc.nonEquitySplit;
const weights = { index: (eq - direct0) * rest.index, active_equity_fund: (eq - direct0) * rest.active_equity_fund, international: (eq - direct0) * rest.international, sector_thematic: (eq - direct0) * (rest.sector_thematic ?? 0), debt: (1 - eq) * ne.debt, gold: (1 - eq) * ne.gold, silver: (1 - eq) * ne.silver, liquid: (1 - eq) * ne.liquid };
const series = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
await pool(list, async (s) => {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch('https://api.mfapi.in/mf/' + s.code); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(), m = {}; for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; } if (Object.keys(m).length) series.set(s.code, m); return; }
    catch { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
  }
}, 8);
const broken = (m) => { const d = Object.keys(m).sort(); for (let i = 1; i < d.length; i++) { const r = m[d[i]] / m[d[i - 1]]; if (r > 1.4 || r < 0.6) return d[i]; } return null; };
for (const [k, m] of [...series]) if (broken(m)) series.delete(k);
console.log('fetched', series.size, 'of', list.length, 'failed', failed);
if (series.size < list.length * 0.8) { console.error('too many fetch failures; no result written'); process.exit(1); }
const res = allFundsTilt(list, series, weights);
mkdirSync('data/funds', { recursive: true });
writeFileSync('data/funds/backtest-allfunds.json', JSON.stringify({ ranOn: asOf, rule: 'C-100', params: AT, weightsUsed: weights, universe: types, fundsWithHistory: series.size, ...res }) + '\n');
console.log('C-100', JSON.stringify({ counted: res.counted, beatPreset: res.beatPreset, beatEqual: res.beatEqual, medianExPreset: res.medianExPreset, worstTilt: res.worstTilt, worstPreset: res.worstPreset, parts: res.parts, pass: res.pass, byType: res.pickedByType }));
console.log(JSON.stringify(res.years.map((y) => [y.date.slice(0, 4), y.eligible, y.picked.join(' + '), +y.tilt.toFixed(1), +y.preset.toFixed(1), +y.equal.toFixed(1)])));
