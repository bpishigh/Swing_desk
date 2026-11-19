// VALUE-1 (docs/replay/VALUE-1-PREREG.md). Single run over both halves; no tuning.
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
    U.push(x);
  }
  const m12 = med(allRet); for (const x of U) x.ex = x.c12 - m12;
  const cut = {}; for (const k of ['EY', 'SY', 'BY', 'GR', 'MG', 'EM']) { const v = U.filter((x) => !(x.f.fin && (k === 'BY' || k === 'EM' || k === 'MG'))).map((x) => x.f[k]); cut[k] = { p20: quant(v, 0.2), p50: quant(v, 0.5), p80: quant(v, 0.8) }; }
  for (const x of U) { const f = x.f; x.F = { EY5: f.EY >= cut.EY.p80, SY5: f.SY >= cut.SY.p80, BY5: f.BY >= cut.BY.p80 && !f.fin, GR5: f.GR >= cut.GR.p80, MG5: f.MG >= cut.MG.p80 && !f.fin, IC5: f.IC >= 8 && !f.fin, EYbot: f.EY <= cut.EY.p20, SYbot: f.SY <= cut.SY.p20, GRbot: f.GR <= cut.GR.p20,
    V1: f.EY >= cut.EY.p80 && f.GR >= 0.10 && f.MG >= cut.MG.p50 && !f.fin, V2: f.EY >= cut.EY.p80 && f.EM >= cut.EM.p50 && f.IC >= 3 && !f.fin, V3: f.SY >= cut.SY.p80 && f.GR >= cut.GR.p50 && f.MG > 0 && !f.fin }; }
  rows.push(...U);
}
const halves = { first: rows.filter((r) => r.t <= dates.findLastIndex((d) => d <= '2020-12-31')), second: rows.filter((r) => dates[r.t] >= '2021-01-01'), y2020: rows.filter((r) => r.y === '2020') };
const rate = (a) => a.filter((r) => r.a).length / a.length, rate5 = (a) => a.filter((r) => r.b).length / a.length;
for (const [nm, S] of Object.entries(halves)) {
  const bs = rate(S), b5 = rate5(S), bm = med(S.map((r) => r.c12)); console.log(`\n== ${nm}: ${S.length} covered stock-months, ${new Set(S.map((r) => r.t)).size} month-ends; covered 3x rate ${pc(bs)}, 5x ${pc(b5)}, 12m median ${pc(bm)}`);
  console.log('rule      n    3x rate  lift   5x rate  12m med   mean excess  median excess | years with median excess > 0');
  for (const k of ['EY5', 'SY5', 'BY5', 'GR5', 'MG5', 'IC5', 'EYbot', 'SYbot', 'GRbot', 'V1', 'V2', 'V3']) { const R = S.filter((r) => r.F[k]); if (R.length < 30) { console.log(k.padEnd(8), R.length); continue; }
    const ys = [...new Set(R.map((r) => r.y))].sort().map((y) => { const q = R.filter((r) => r.y === y); return `${y}:${pc(med(q.map((r) => r.ex)))}`; });
    console.log(k.padEnd(8), String(R.length).padStart(5), pc(rate(R)).padStart(7), (rate(R) / bs).toFixed(2).padStart(5), pc(rate5(R)).padStart(7), pc(med(R.map((r) => r.c12))).padStart(8), pc(mean(R.map((r) => r.ex))).padStart(9), pc(med(R.map((r) => r.ex))).padStart(9), '|', ys.join(' ')); }
}
