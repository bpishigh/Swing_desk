// C-104: proxy back-test of the holdings-health reading (today's portfolios applied to past dates; biased in favour, so a fail counts and a pass proves nothing).
// C-105: rank-correlation re-test of thematic (own theme) and international scores, with plain equity as a yardstick. Writes data/funds/backtest-holdhealth.json and backtest-rankcorr.json.
// Usage: node --max-old-space-size=6000 scripts/fund-rankcorr-test.mjs [--dry]   (--dry: prices and portfolios only, no NAV fetch)
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { normCategory, SETTINGS, scoreAll, navOn, addDays } from '../src/pm/fundscore.ts';
import { scoreRisk, intlGroup, RISK } from '../src/pm/fundrisk.ts';
import { themeOf } from '../src/pm/fundtheme.ts';
import { stockTrend, fundHealth, rankHealth, HH } from '../src/pm/holdhealth.ts';
import { schemeBase } from '../src/pm/lookthrough.ts';
const DRY = process.argv.includes('--dry'), J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d), asOf = new Date().toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plusYear = (d) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); };
const rank = (v) => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const spearman = (x, y) => { if (x.length < 3) return null; const a = rank(x), b = rank(y), n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return va > 0 && vb > 0 ? c / Math.sqrt(va * vb) : null; };
// ---- NAVs ----
const amfi = J('data/rules/amfi-schemes.json'), scores = J('data/funds/scores.json'), SNAP = Date.parse((amfi.asOf ?? asOf) + 'T23:59:59Z');
const ts = (s) => { const [d, m, y] = s.split('-'); return Date.parse(`${d} ${m} ${y} UTC`); };
const recent = (s) => Number.isFinite(ts(s)) && SNAP - ts(s) < 12 * 86400000, recentIntl = (s) => Number.isFinite(ts(s)) && Date.now() - ts(s) < 35 * 86400000;
const extraDirect = new Set((J('data/rules/direct-growth-codes.json', { records: [] }).records || []).map((x) => x.code));
const direct = (r) => (/^Direct/i.test(r[5]) && /^Growth/i.test(r[6])) || extraDirect.has(r[0]);
const rec = (r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] });
const EQ = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
const thematic = amfi.rows.filter((r) => direct(r) && recent(r[8]) && normCategory(r[4]) === 'Sectoral/Thematic').map(rec).filter((x) => themeOf(x.name));
const intl = amfi.rows.filter((r) => direct(r) && recentIntl(r[8]) && intlGroup(r[3], r[4])).map(rec);
const equity = amfi.rows.filter((r) => /^Direct/i.test(r[5]) && /^Growth/i.test(r[6]) && recent(r[8]) && EQ.has(normCategory(r[4]))).map(rec);
const hcodes = scores.funds.filter((f) => f.g === 'mf' || f.g === 'idx').map((f) => ({ code: f.code, name: f.name }));
const want = new Map(); for (const x of [...thematic, ...intl, ...equity, ...hcodes]) want.set(x.code, x);
console.log('thematic', thematic.length, 'intl', intl.length, 'equity', equity.length, 'health funds', hcodes.length, 'NAVs wanted', want.size);
const series = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
if (!DRY) {
  await pool([...want.values()], async (s) => {
    for (let a = 0; a < 3; a++) {
      try { const r = await fetch('https://api.mfapi.in/mf/' + s.code); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(), m = {}; for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; } if (Object.keys(m).length) series.set(s.code, m); return; }
      catch { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
    }
  }, 8);
  const broken = (m) => { const d = Object.keys(m).sort(); for (let i = 1; i < d.length; i++) { const r = m[d[i]] / m[d[i - 1]]; if (r > 1.4 || r < 0.6) return d[i]; } return null; };
  for (const [k, m] of [...series]) if (broken(m)) series.delete(k);
  console.log('fetched', series.size, 'of', want.size, 'failed', failed);
  if (series.size < want.size * 0.8) { console.error('too many fetch failures; no result written'); process.exit(1); }
}
mkdirSync('data/funds', { recursive: true });
// ---- C-105: rank correlation ----
const navDates = new Map(); for (const [k, m] of series) navDates.set(k, Object.keys(m).sort());
function rankcorr(schemes, scorer, bt = { firstYear: 2015, lastYear: 2025, minScored: 10, passShare: 0.6, minYears: 5 }) {
  const years = [];
  for (let y = bt.firstYear; y <= bt.lastYear; y++) {
    const T = `${y}-10-01`, E = plusYear(T), cut = new Map();
    for (const s of schemes) { const nav = series.get(s.code); if (!nav) continue; const d = navDates.get(s.code); if (d[0] > T) continue; const o = {}; for (const x of d) { if (x > T) break; o[x] = nav[x]; } cut.set(s.code, o); }
    const sc = scorer(schemes.filter((s) => cut.has(s.code)), cut, T).filter((r) => r.score != null);
    const fwd = new Map(); for (const r of sc) { const d = navDates.get(r.code), nav = series.get(r.code), a = navOn(d, nav, T), b = navOn(d, nav, E); if (a && b && a > 0) fwd.set(r.code, b / a - 1); }
    const by = new Map(); for (const r of sc) if (fwd.has(r.code)) (by.get(r.cat) ?? by.set(r.cat, []).get(r.cat)).push(fwd.get(r.code));
    const med = new Map([...by].map(([k, v]) => [k, median(v)])), use = sc.filter((r) => fwd.has(r.code));
    const rho = use.length >= 3 ? spearman(use.map((r) => r.score), use.map((r) => fwd.get(r.code) - med.get(r.cat))) : null;
    years.push({ date: T, scored: use.length, rho: rho === null ? null : +rho.toFixed(3), counted: use.length >= bt.minScored && rho !== null, pass: use.length >= bt.minScored && rho !== null && rho > 0 });
  }
  const c = years.filter((y) => y.counted), p = c.filter((y) => y.pass), mean = c.length ? c.reduce((s, y) => s + y.rho, 0) / c.length : null;
  return { years, counted: c.length, passed: p.length, meanRho: mean === null ? null : +mean.toFixed(3), pass: c.length >= bt.minYears && p.length / c.length >= bt.passShare && mean > 0 };
}
let rc = null;
if (!DRY) {
  const th = rankcorr(thematic, (sc, cut, T) => scoreAll(sc, cut, T, { ...SETTINGS, minPeers: 5 }, (x) => themeOf(x.name)));
  const it = rankcorr(intl, (sc, cut, T) => scoreRisk(sc, cut, T, (x) => intlGroup(x.name, x.category), new Map(), () => RISK.minPeersIntl, () => false));
  const eq = rankcorr(equity, (sc, cut, T) => scoreAll(sc, cut, T, SETTINGS, (x) => { const c = normCategory(x.category); return EQ.has(c) ? c : null; }));
  rc = { ranOn: asOf, rule: 'C-105', thematic: th, international: it, equityYardstick: eq };
  writeFileSync('data/funds/backtest-rankcorr.json', JSON.stringify(rc) + '\n');
  for (const [k, r] of [['thematic', th], ['international', it], ['equity yardstick', eq]]) console.log('C-105', k, JSON.stringify({ counted: r.counted, passed: r.passed, meanRho: r.meanRho, pass: r.pass, years: r.years.map((y) => [y.date.slice(0, 4), y.scored, y.rho]) }));
}
// ---- C-104: holdings health at past dates ----
const hold = J('data/funds/holdings.json'), byDay = {};
if (existsSync('data/india/prices-hist')) for (const f of readdirSync('data/india/prices-hist').filter((x) => /^\d{4}-\d\d\.json$/.test(x)).sort()) { const c = J('data/india/prices-hist/' + f); c.dates.forEach((d, i) => { const o = (byDay[d] ??= {}); for (const [s, a] of Object.entries(c.px)) if (a[i] != null) o[s] = a[i]; }); }
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) { const o = (byDay[f.slice(0, 10)] ??= {}); for (const [s, r] of Object.entries(J('data/india/bhav/' + f).rows)) if (r[5] != null) o[s] = r[5]; }
const dates = Object.keys(byDay).sort(), allSyms = new Set(); for (const d of dates) for (const s of Object.keys(byDay[d])) allSyms.add(s);
const RENAMED = { zomato: 'eternal', 'larsen and toubro infotech': 'ltimindtree' };
const norm0 = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/\b(limited|ltd|the|corporation|corp|company|co)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim(), norm = (s) => { const n = norm0(s); return RENAMED[n] ?? n; };
const names = J('data/names.json', { india: {} }).india, byName = new Map(); for (const [s, n] of Object.entries(names)) { if (!byName.has(norm(n))) byName.set(norm(n), s); if (!byName.has(norm(s))) byName.set(norm(s), s); }
const isinSym = new Map(); for (const r of J('data/india/corp-actions-history.json', [])) if (r.isin && r.symbol) isinSym.set(r.isin, r.symbol);
const resolve = (l) => (l.symbol && allSyms.has(l.symbol) ? l.symbol : l.isin && isinSym.get(l.isin)) || byName.get(norm(l.name)) || null;
const TS = ['2023-10-01', '2024-01-01', '2024-04-01', '2024-07-01', '2024-10-01', '2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01'], BAR = { passShare: 0.6, minDates: 6, minGroup: 10 };
const pts = [];
for (const T of TS) {
  let i = dates.length - 1; while (i >= 0 && dates[i] > T) i--;
  const span = dates.slice(Math.max(0, i - (HH.breakLookback + 4)), i + 1), priceDate = dates[i], trend = new Map();
  for (const s of allSyms) { const t = stockTrend(span, span.map((d) => byDay[d][s] ?? null), priceDate); if (t) trend.set(s, t); }
  const rows = [];
  for (const f of scores.funds.filter((x) => x.g === 'mf' || x.g === 'idx')) { const p = hold.funds[schemeBase(f.name)]; if (!p || (p.code && p.code !== f.code)) continue; const h = fundHealth(p.lines, resolve, trend); if (h) rows.push({ code: f.code, cat: f.cat ?? f.category, ...h }); }
  const ranked = rankHealth(rows);
  if (DRY) { console.log('C-104 dry', T, priceDate, 'readable stocks', trend.size, 'covered funds', rows.length, 'ranked', ranked.filter((r) => r.pct !== null).length); continue; }
  const E = plusYear(T), fwd = new Map();
  for (const r of ranked) { const nav = series.get(r.code); if (!nav) continue; const d = navDates.get(r.code), a = navOn(d, nav, T), b = navOn(d, nav, E); if (a && b && a > 0) fwd.set(r.code, b / a - 1); }
  const by = new Map(); for (const r of ranked) if (r.pct !== null && fwd.has(r.code)) (by.get(r.cat) ?? by.set(r.cat, []).get(r.cat)).push(fwd.get(r.code));
  const med = new Map([...by].map(([k, v]) => [k, median(v)])), use = ranked.filter((r) => r.pct !== null && fwd.has(r.code)), ex = (r) => (fwd.get(r.code) - med.get(r.cat)) * 100;
  const A = use.filter((r) => r.band === 'Strong').map(ex), B = use.filter((r) => r.band === 'Weak').map(ex), rho = spearman(use.map((r) => r.pct), use.map(ex));
  const mA = A.length ? median(A) : null, mB = B.length ? median(B) : null, cA = A.length >= BAR.minGroup, cB = B.length >= BAR.minGroup;
  pts.push({ date: T, covered: rows.length, scored: use.length, nStrong: A.length, nWeak: B.length, medExcessStrong: mA, medExcessWeak: mB, rho: rho === null ? null : +rho.toFixed(3), countedA: cA, countedB: cB, passA: cA && mA > 0, passB: cB && mB < 0, countedC: use.length >= BAR.minGroup && rho !== null, passC: use.length >= BAR.minGroup && rho !== null && rho > 0 });
}
if (!DRY) {
  const t = (c, p) => { const counted = pts.filter((x) => x[c]).length, passed = pts.filter((x) => x[c] && x[p]).length; return { counted, passed, pass: counted >= BAR.minDates && passed / counted >= BAR.passShare }; };
  const A = t('countedA', 'passA'), B = t('countedB', 'passB'), C = t('countedC', 'passC'), cc = pts.filter((x) => x.countedC), mean = cc.length ? cc.reduce((s, x) => s + x.rho, 0) / cc.length : null;
  const res = { ranOn: asOf, rule: 'C-104', bar: BAR, biasNote: 'today portfolios applied to past dates: favours the score', points: pts, testA: A, testB: B, testC: C, meanRho: mean === null ? null : +mean.toFixed(3), notRejected: A.pass && B.pass && C.pass && mean > 0 };
  writeFileSync('data/funds/backtest-holdhealth.json', JSON.stringify(res) + '\n');
  console.log('C-104', JSON.stringify({ A, B, C, meanRho: res.meanRho, notRejected: res.notRejected, pts: pts.map((x) => [x.date, x.scored, x.nStrong, x.nWeak, x.medExcessStrong && +x.medExcessStrong.toFixed(2), x.medExcessWeak && +x.medExcessWeak.toFixed(2), x.rho]) }));
}
