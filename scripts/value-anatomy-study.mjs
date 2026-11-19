// VALUE-1 addendum ANATOMY (docs/replay/VALUE-1-PREREG.md).
import { loadIndia, pc } from './lib/study-harness.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { asOfResults } from '../src/engine/filings-asof.ts';
import { computeFeatures } from '../src/engine/fundamentals-asof.ts';
const H = loadIndia(), { dates, series, syms, N } = H;
const ents = JSON.parse(readFileSync('data/india/entities.json', 'utf8')).entities, bySym = new Map();
for (const e of ents) for (const u of e.symbols) { const a = bySym.get(u.symbol) || []; a.push([u, e]); bySym.set(u.symbol, a); }
const entityAt = (sym, D) => { const a = bySym.get(sym); if (!a) return null; return (a.find(([u]) => (u.from == null || u.from <= D) && (u.to == null || u.to >= D)) || a[a.length - 1])[1]; };
const splitsOf = new Map(); for (const [sym, date, factor] of H.splits) { const a = splitsOf.get(sym) || []; a.push({ date, factor }); splitsOf.set(sym, a); }
const cache = new Map(), factsOf = (e) => { if (cache.has(e.id)) return cache.get(e.id); const p = `data/india/filings/${e.id}.json.gz`; let f = null; if (existsSync(p)) { const st = JSON.parse(gunzipSync(readFileSync(p))); f = st.results.filter((y) => y.asOf).map((y) => ({ entity: e.id, period: y.period, basis: y.basis, asOf: y.asOf, revision: y.revision ?? 0, fields: y.fields, ytd: y.ytd, format: y.format, extra: y.extra })); } cache.set(e.id, f); return f; };
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; }, mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN; };
const quant = (a, p) => { const x = a.filter(Number.isFinite).sort((m, n) => m - n); return x.length ? x[Math.min(x.length - 1, Math.floor(x.length * p))] : NaN; };
const me = []; for (let t = 1; t < N; t++) if (dates[t].slice(0, 7) !== dates[t + 1]?.slice(0, 7) && dates[t].slice(0, 7) >= '2017-07' && dates[t].slice(0, 7) <= '2023-11' && t + 756 <= N - 1) me.push(t);
const rows = [];
for (const t of me) {
  const D = dates[t], U = []; let allRet = [];
  for (const sym of syms) {
    const c = series.get(sym).c, raw = H.openRaw(sym, t)?.[1]; if (!(c[t] > 0) || !(raw >= 20) || !(H.tv(sym, t - 19, t) >= 2e7)) continue;
    let c12 = NaN; for (let k = t + 252; k > t + 200; k--) if (c[k] > 0) { c12 = c[k] / c[t] - 1; break; } allRet.push(c12);
    const e = entityAt(sym, D); if (!e) continue; const facts = factsOf(e); if (!facts) continue;
    let f; try { f = computeFeatures(asOfResults(facts, e.id, D, { limit: 40, events: e.events }), raw, (splitsOf.get(sym) ?? []).filter((s) => s.date <= D)); } catch { continue; }
    if (!(f.marketCap > 0) || f.ttm.pat == null) continue;
    let top = 0; for (let k = t + 1; k <= t + 756; k++) if (c[k] > top) top = c[k];
    const rev = f.ttm.revenue, x = { sym, t, y: D.slice(0, 4), a: top / c[t] >= 3, b: top / c[t] >= 5, c12, f: { EY: f.earningsYield, SY: rev > 0 ? rev / f.marketCap : NaN, BY: f.ttm.operatingEbit != null ? f.ttm.operatingEbit / f.marketCap : NaN, GR: f.growth.revenue, MG: rev > 0 && f.ttm.pbtPre != null ? f.ttm.pbtPre / rev : NaN, IC: f.interestCover, EM: f.margin.operatingEbit, fin: f.financial } };
    x.f.dd = (() => { let m = 0; for (let k = Math.max(0, t - 503); k <= t; k++) if (c[k] > m) m = c[k]; return c[t] / m - 1; })(); x.f.mom6 = c[t - 126] > 0 ? c[t] / c[t - 126] - 1 : NaN; x.f.vol = (() => { let a = 0, b = 0, n = 0; for (let k = t - 125; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0) { const r = c[k] / c[k - 1] - 1; a += r; b += r * r; n++; } return n > 100 ? Math.sqrt(b / n - (a / n) ** 2) : NaN; })(); x.f.logTV = Math.log(H.tv(sym, t - 19, t)); const tvo = H.tv(sym, t - 250, t - 125); x.f.tvt = H.tv(sym, t - 19, t) / tvo; U.push(x);
  }
  const m12 = med(allRet); for (const x of U) x.ex = x.c12 - m12;
  const cut = {}; for (const k of ['EY', 'SY', 'BY', 'GR', 'MG', 'EM']) { const v = U.filter((x) => !(x.f.fin && (k === 'BY' || k === 'EM' || k === 'MG'))).map((x) => x.f[k]); cut[k] = { p20: quant(v, 0.2), p50: quant(v, 0.5), p80: quant(v, 0.8) }; }
  for (const x of U) { const f = x.f; x.F = { EY5: f.EY >= cut.EY.p80, SY5: f.SY >= cut.SY.p80, BY5: f.BY >= cut.BY.p80 && !f.fin, GR5: f.GR >= cut.GR.p80, MG5: f.MG >= cut.MG.p80 && !f.fin, IC5: f.IC >= 8 && !f.fin, EYbot: f.EY <= cut.EY.p20, SYbot: f.SY <= cut.SY.p20, GRbot: f.GR <= cut.GR.p20,
    V1: f.EY >= cut.EY.p80 && f.GR >= 0.10 && f.MG >= cut.MG.p50 && !f.fin, V2: f.EY >= cut.EY.p80 && f.EM >= cut.EM.p50 && f.IC >= 3 && !f.fin, V3: f.SY >= cut.SY.p80 && f.GR >= cut.GR.p50 && f.MG > 0 && !f.fin }; }
  for (const k of ['EY', 'SY', 'BY']) { const v = U.filter((x) => !(x.f.fin && k === 'BY')).map((x) => x.f[k]).filter(Number.isFinite).sort((a, b) => a - b); for (const x of U) { const i = v.findIndex((y) => y >= x.f[k]); x['p' + k] = Number.isFinite(x.f[k]) && i >= 0 ? i / v.length : NaN; } } for (const x of U) x.cheap = (x.pSY >= 0.8) || (x.pEY >= 0.8) || (!x.f.fin && x.pBY >= 0.8); rows.push(...U);
}

const W = JSON.parse(readFileSync(process.argv[2])); const pcs = (x) => (Number.isFinite(x) ? (x * 100).toFixed(0) + '%' : 'n/a');
// ---- Part 1
const lastME = (L) => { let b = null; for (const t of me) if (t <= L) b = t; return b; };
const byT = new Map(); for (const r of rows) { if (!byT.has(r.t)) byT.set(r.t, []); byT.get(r.t).push(r); }
const rankIn = (t, k, v) => { const a = (byT.get(t) ?? []).map((r) => r.f[k]).filter(Number.isFinite).sort((p, q) => p - q); if (!a.length || !Number.isFinite(v)) return NaN; let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo / a.length; };
function figs(w, idx) { const sym = w.sym, D = dates[idx], raw = H.openRaw(sym, idx)?.[1], e = entityAt(sym, D); if (!e || !(raw > 0)) return null; const facts = factsOf(e); if (!facts) return null; let f; try { f = computeFeatures(asOfResults(facts, e.id, D, { limit: 40, events: e.events }), raw, (splitsOf.get(sym) ?? []).filter((s) => s.date <= D)); } catch { return null; } if (!(f.marketCap > 0) || f.ttm.pat == null) return null; const rev = f.ttm.revenue;
  const o = { EY: f.earningsYield, SY: rev > 0 ? rev / f.marketCap : NaN, BY: f.ttm.operatingEbit != null ? f.ttm.operatingEbit / f.marketCap : NaN, GR: f.growth.revenue, MG: rev > 0 && f.ttm.pbtPre != null ? f.ttm.pbtPre / rev : NaN, IC: f.interestCover, prof: f.ttm.pat > 0 ? 1 : 0, fin: f.financial }; const mt = lastME(idx); for (const k of ['EY', 'SY', 'BY', 'GR', 'MG', 'IC']) o['p' + k] = mt ? rankIn(mt, k, o[k]) : NaN; o.cheap = o.pSY >= 0.8 || o.pEY >= 0.8 || (!o.fin && o.pBY >= 0.8); return o; }
const ws = W.filter((w) => dates[w.L] >= '2019-01-01' && dates[w.L] <= '2023-11-30'); const wf = []; for (const w of ws) { const a = figs(w, w.L), b = w.B > 0 ? figs(w, w.B) : null; if (a) wf.push({ w, a, b }); }
console.log(`\n== PART 1: ${W.length} India 4x winners; trough in 2019-01..2023-11: ${ws.length}; with as-of figures at the trough: ${wf.length}`);
const row = (nm, S, key) => { const vals = (k) => S.map((x) => x[key]?.[k]); console.log(nm.padEnd(18), 'n', String(S.length).padStart(4), '| median pct rank SY', pcs(med(vals('pSY'))), 'BY', pcs(med(vals('pBY'))), 'EY', pcs(med(vals('pEY'))), 'growth', pcs(med(vals('pGR'))), 'margin', pcs(med(vals('pMG'))), 'int.cover', pcs(med(vals('pIC'))), '| sales yield median', (med(vals('SY'))).toFixed(2), '| growth median', pcs(med(vals('GR'))), '| margin median', pcs(med(vals('MG'))), '| profitable', pcs(mean(vals('prof'))), '| cheap on any', pcs(mean(vals('cheap').map((x) => (x ? 1 : 0))))); };
row('winners at trough', wf, 'a'); row('winners 10x+', wf.filter((x) => x.w.ratio >= 10), 'a'); row('winners at breakout', wf.filter((x) => x.b), 'b'); row('crash launch', wf.filter((x) => x.w.dd <= -0.5), 'a'); row('no-crash', wf.filter((x) => x.w.dd > -0.35), 'a');
const cheapPop = rows.filter((r) => r.cheap), cw = cheapPop.filter((r) => r.a), cl = cheapPop.filter((r) => !r.a);
const rs = (nm, S) => console.log(nm.padEnd(26), 'n', String(S.length).padStart(5), '| pct rank SY', pcs(med(S.map((r) => r.pSY))), 'BY', pcs(med(S.map((r) => r.pBY))), 'EY', pcs(med(S.map((r) => r.pEY))), '| growth', pcs(med(S.map((r) => r.f.GR))), 'margin', pcs(med(S.map((r) => r.f.MG))), 'int.cover', med(S.map((r) => r.f.IC)).toFixed(1), '| drawdown from 2y high', pcs(med(S.map((r) => r.f.dd))), 'mom6', pcs(med(S.map((r) => r.f.mom6))), 'vol', pcs(med(S.map((r) => r.f.vol))), 'logTV', med(S.map((r) => r.f.logTV)).toFixed(1));
console.log('\nCheap-on-any stock-months (month-ends 2019-01..2023-11): winners (3x) vs non-winners'); rs('cheap and became 3x', cw); rs('cheap, did not', cl);
// ---- Part 2
const cut1 = dates.findLastIndex((d) => d <= '2021-06-30'), P1 = cheapPop.filter((r) => r.t <= cut1), P2 = cheapPop.filter((r) => r.t > cut1);
const FE = ['GR', 'MG', 'EM', 'IC', 'logTV', 'dd', 'mom6', 'vol', 'tvt', 'pSY'], val = (r, k) => (k === 'pSY' ? r.pSY : r.f[k]);
const rate = (a) => a.filter((r) => r.a).length / a.length;
const base = (S) => ({ a: rate(S), ex: med(S.map((r) => r.ex)), mex: mean(S.map((r) => r.ex)) });
function table(S) { const b = base(S), vc = [quant(S.map((r) => r.f.vol), 1 / 3), quant(S.map((r) => r.f.vol), 2 / 3)], terc = (r) => (r.f.vol < vc[0] ? 0 : r.f.vol < vc[1] ? 1 : 2), res = {}, cuts = {};
  for (const k of FE) { const sub = S.filter((r) => Number.isFinite(val(r, k)) && !(r.f.fin && ['EM', 'IC', 'MG'].includes(k))); if (sub.length < 100) continue; const lo = quant(sub.map((r) => val(r, k)), 0.2), hi = quant(sub.map((r) => val(r, k)), 0.8); cuts[k] = [lo, hi];
    const side = (dir) => { const sel = sub.filter((r) => (dir > 0 ? val(r, k) >= hi : val(r, k) <= lo)); const tl = [0, 1, 2].map((q) => { const T = sub.filter((r) => terc(r) === q), Q = sel.filter((r) => terc(r) === q); return Q.length >= 15 ? rate(Q) / rate(T) : NaN; }); return { dir, n: sel.length, lift: rate(sel) / rate(sub), tl, ex: med(sel.map((r) => r.ex)), exAll: med(sub.map((r) => r.ex)) }; }; res[k] = [side(1), side(-1)]; }
  return { b, res, cuts }; }
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : ' - ');
for (const [nm, S] of [['FIRST period (selection) 2019-01..2021-06', P1], ['SECOND period 2021-07..2023-11 (descriptive until scored)', P2]]) { const T = table(S); console.log(`\n${nm}: cheap population n ${S.length}, 3x rate ${pcs(T.b.a)}, median excess ${pcs(T.b.ex)}`); for (const [k, [t, b2]] of Object.entries(T.res)) for (const r of [t, b2]) console.log(k.padEnd(7), r.dir > 0 ? 'top' : 'bot', String(r.n).padStart(5), 'lift', f2(r.lift), 'terciles', r.tl.map(f2).join('/'), 'median excess', pcs(r.ex), 'vs', pcs(r.exAll)); if (S === P1) globalThis.T1 = T; }
const kept = []; for (const [k, [t, b2]] of Object.entries(globalThis.T1.res)) { const r = t.lift >= b2.lift ? t : b2; if (r.lift >= 1.4 && r.tl.every((x) => Number.isFinite(x) && x >= 1.15) && r.ex > r.exAll) kept.push({ k, dir: r.dir, lift: r.lift, minT: Math.min(...r.tl) }); } kept.sort((a, b2) => b2.minT - a.minT); const chosen = kept.slice(0, 3);
console.log('\nKept:', JSON.stringify(kept)); console.log('Chosen:', JSON.stringify(chosen));
if (chosen.length) { const inRule = (r) => chosen.every((c) => (c.dir > 0 ? val(r, c.k) >= globalThis.T1.cuts[c.k][1] : val(r, c.k) <= globalThis.T1.cuts[c.k][0])); for (const [nm, S] of [['first', P1], ['SECOND (scored)', P2]]) { const sel = S.filter(inRule), b = base(S); const ys = [...new Set(sel.map((r) => r.y))].sort().map((y) => { const q = sel.filter((r) => r.y === y); return `${y}:${pcs(med(q.map((r) => r.ex)))}(${q.length})`; }); console.log(`${nm}: n ${sel.length}, 3x rate ${pcs(rate(sel))} vs ${pcs(b.a)} (lift ${f2(rate(sel) / b.a)}), median excess ${pcs(med(sel.map((r) => r.ex)))} vs ${pcs(b.ex)}, mean excess ${pcs(mean(sel.map((r) => r.ex)))}; years ${ys.join(' ')}`); } }
