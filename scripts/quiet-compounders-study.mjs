// QUIET-COMPOUNDERS (docs/replay/QUIET-COMPOUNDERS-PREREG.md). Usage: node scripts/quiet-compounders-study.mjs [--fund]
import { loadIndia, pc } from './lib/study-harness.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { asOfResults } from '../src/engine/filings-asof.ts';
import { computeFeatures } from '../src/engine/fundamentals-asof.ts';
const FUND = process.argv.includes('--fund');
const H = loadIndia(), { dates, series, syms, N } = H;
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; }, mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN; };
const quant = (a, p) => { const x = a.filter(Number.isFinite).sort((m, n) => m - n); return x.length ? x[Math.min(x.length - 1, Math.floor(x.length * p))] : NaN; };
let entityAt, factsOf, splitsOf; if (FUND) {
  const ents = JSON.parse(readFileSync('data/india/entities.json', 'utf8')).entities, bySym = new Map(); for (const e of ents) for (const u of e.symbols) { const a = bySym.get(u.symbol) || []; a.push([u, e]); bySym.set(u.symbol, a); }
  entityAt = (sym, D) => { const a = bySym.get(sym); if (!a) return null; return (a.find(([u]) => (u.from == null || u.from <= D) && (u.to == null || u.to >= D)) || a[a.length - 1])[1]; };
  splitsOf = new Map(); for (const [sym, date, factor] of H.splits) { const a = splitsOf.get(sym) || []; a.push({ date, factor }); splitsOf.set(sym, a); }
  const cache = new Map(); factsOf = (e) => { if (cache.has(e.id)) return cache.get(e.id); const p = `data/india/filings/${e.id}.json.gz`; let f = null; if (existsSync(p)) { const st = JSON.parse(gunzipSync(readFileSync(p))); f = st.results.filter((y) => y.asOf).map((y) => ({ entity: e.id, period: y.period, basis: y.basis, asOf: y.asOf, revision: y.revision ?? 0, fields: y.fields, ytd: y.ytd, format: y.format, extra: y.extra })); } cache.set(e.id, f); return f; };
}
const FROM = FUND ? '2019-01' : '2011-02', me = []; for (let t = 1; t < N; t++) if (dates[t].slice(0, 7) !== dates[t + 1]?.slice(0, 7) && dates[t].slice(0, 7) >= FROM && t + 756 <= N - 1 && t >= 504) me.push(t);
const rows = [];
for (const t of me) {
  const D = dates[t], idxNow = H.idxRet(dates[t - 126], D), U = [];
  for (const sym of syms) {
    const c = series.get(sym).c, raw = H.openRaw(sym, t)?.[1]; if (!(c[t] > 0) || !(raw >= 20) || !(c[t - 252] > 0) || !(c[t - 126] > 0)) continue; const tv = H.tv(sym, t - 19, t); if (!(tv >= 2e7)) continue;
    let pk = c[t], dd = 0, ok = true; for (let k = t + 1; k <= t + 756; k++) { if (!(c[k] > 0)) continue; if (c[k] > pk) pk = c[k]; dd = Math.min(dd, c[k] / pk - 1); } let end = 0; for (let k = t + 756; k > t + 700; k--) if (c[k] > 0) { end = c[k]; break; } if (!end) continue;
    let c12 = NaN; for (let k = t + 252; k > t + 200; k--) if (c[k] > 0) { c12 = c[k] / c[t] - 1; break; }
    let mx2 = 0; for (let k = t - 503; k <= t; k++) if (c[k] > mx2) mx2 = c[k]; let hi52 = 0; for (let k = t - 251; k <= t; k++) if (c[k] > hi52) hi52 = c[k];
    let a = 0, b = 0, n = 0; for (let k = t - 125; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0) { const r = c[k] / c[k - 1] - 1; a += r; b += r * r; n++; } if (n < 100) continue;
    // smoothness: R^2 of ln c on time over 252 sessions
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0; for (let k = t - 251; k <= t; k++) if (c[k] > 0) { const x = k - t, y = Math.log(c[k]); sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; m++; } const cov = sxy - sx * sy / m, r2 = cov * cov / ((sxx - sx * sx / m) * (syy - sy * sy / m));
    let up = 0, nb = 0; for (let j = 0; j < 12; j++) { const e1 = t - 21 * j, s1 = e1 - 21; if (c[e1] > 0 && c[s1] > 0) { nb++; if (c[e1] > c[s1]) up++; } }
    const tvo = H.tv(sym, t - 250, t - 125);
    const f = { mom6: c[t] / c[t - 126] - 1, mom12_1: c[t - 21] > 0 ? c[t - 21] / c[t - 252] - 1 : NaN, vol126: Math.sqrt(b / n - (a / n) ** 2), dd2y: c[t] / mx2 - 1, prox52: c[t] / hi52, logTV: Math.log(tv), rawPrice: raw, rs6: c[t] / c[t - 126] - 1 - idxNow, smooth: r2, upShare: nb >= 10 ? up / nb : NaN, tvTrend: tv / tvo };
    if (FUND) { const e = entityAt(sym, D); if (e) { const fa = factsOf(e); if (fa) { try { const g = computeFeatures(asOfResults(fa, e.id, D, { limit: 40, events: e.events }), raw, (splitsOf.get(sym) ?? []).filter((s) => s.date <= D)); if (g.marketCap > 0 && g.ttm.pat != null) { const rev = g.ttm.revenue; Object.assign(f, { revGrowth: g.growth.revenue, margin: rev > 0 && g.ttm.pbtPre != null && !g.financial ? g.ttm.pbtPre / rev : NaN, ebitMargin: !g.financial ? g.margin.operatingEbit : NaN, intCover: !g.financial ? g.interestCover : NaN, ey: g.earningsYield, sy: rev > 0 ? rev / g.marketCap : NaN, hasF: 1 }); } } catch {} } } if (!f.hasF) continue; }
    U.push({ sym, t, y: D.slice(0, 4), S: end / c[t] >= 2.5 && dd >= -0.35, ret3: end / c[t] - 1, c12, f });
  }
  const m12 = med(U.map((r) => r.c12)); for (const r of U) r.ex = r.c12 - m12; rows.push(...U);
}
const split = FUND ? '2021-06-30' : '2017-12-31', cutT = dates.findLastIndex((d) => d <= split), P1 = rows.filter((r) => r.t <= cutT), P2 = rows.filter((r) => r.t > cutT);
const rate = (a) => a.filter((r) => r.S).length / a.length, FE = Object.keys(rows[0].f).filter((k) => k !== 'hasF');
function table(S) { const tc = [quant(S.map((r) => r.f.logTV), 1 / 3), quant(S.map((r) => r.f.logTV), 2 / 3)], terc = (r) => (r.f.logTV < tc[0] ? 0 : r.f.logTV < tc[1] ? 1 : 2), res = {}, cuts = {}, b = { s: rate(S), m12: med(S.map((r) => r.c12)) };
  for (const k of FE) { const sub = S.filter((r) => Number.isFinite(r.f[k])); if (sub.length < 200) continue; const lo = quant(sub.map((r) => r.f[k]), 0.2), hi = quant(sub.map((r) => r.f[k]), 0.8); cuts[k] = [lo, hi]; const rs = rate(sub);
    const side = (dir) => { const sel = sub.filter((r) => (dir > 0 ? r.f[k] >= hi : r.f[k] <= lo)); const tl = [0, 1, 2].map((q) => { const T = sub.filter((r) => terc(r) === q), Q = sel.filter((r) => terc(r) === q); return Q.length >= 30 && rate(T) > 0 ? rate(Q) / rate(T) : NaN; }); return { dir, n: sel.length, lift: rate(sel) / rs, tl, m12: med(sel.map((r) => r.c12)), g12: med(sub.map((r) => r.c12)) }; }; res[k] = [side(1), side(-1)]; }
  return { b, res, cuts }; }
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : ' - ');
const T1 = table(P1), T2 = table(P2);
for (const [nm, T, S] of [['SELECTION', T1, P1], ['SCORED period (descriptive until scored)', T2, P2]]) { console.log(`\n${nm}: n ${S.length}, ${new Set(S.map((r) => r.t)).size} month-ends, S rate ${pc(T.b.s)}, 12m median ${pc(T.b.m12)}`); for (const [k, [t, b]] of Object.entries(T.res)) for (const r of [t, b]) console.log(k.padEnd(9), r.dir > 0 ? 'top' : 'bot', String(r.n).padStart(5), 'lift', f2(r.lift), 'terciles', r.tl.map(f2).join('/'), '12m med', pc(r.m12), 'vs', pc(r.g12)); }
const kept = []; for (const [k, [t, b]] of Object.entries(T1.res)) { const r = t.lift >= b.lift ? t : b; if (r.lift >= 1.5 && r.tl.every((x) => Number.isFinite(x) && x >= 1.2) && r.m12 > r.g12) kept.push({ k, dir: r.dir, lift: r.lift, minT: Math.min(...r.tl) }); } kept.sort((a, b) => b.minT - a.minT); const chosen = kept.slice(0, 3);
console.log('\nKept:', JSON.stringify(kept)); console.log('Chosen:', JSON.stringify(chosen));
if (chosen.length) { const inRule = (r) => chosen.every((c) => (c.dir > 0 ? r.f[c.k] >= T1.cuts[c.k][1] : r.f[c.k] <= T1.cuts[c.k][0])); for (const [nm, S, T] of [['selection period', P1, T1], ['SCORED', P2, T2]]) { const sel = S.filter(inRule); const ys = [...new Set(sel.map((r) => r.y))].sort().map((y) => { const q = sel.filter((r) => r.y === y); return `${y}:${pc(med(q.map((r) => r.ex)))}(${q.length})`; }); console.log(`${nm}: n ${sel.length}, S ${pc(rate(sel))} vs ${pc(T.b.s)} (lift ${f2(rate(sel) / T.b.s)}), 12m median ${pc(med(sel.map((r) => r.c12)))} vs ${pc(T.b.m12)}, median excess ${pc(med(sel.map((r) => r.ex)))}, mean 756-session return ${pc(mean(sel.map((r) => r.ret3)))} vs ${pc(mean(S.map((r) => r.ret3)))}; years ${ys.join(' ')}`); } }
