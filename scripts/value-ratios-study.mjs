// VALUE-1 addendum RATIOS (docs/replay/VALUE-1-PREREG.md).
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
const divs = new Map(); for (const f of ['data/india/corp-actions-history-pre2019.json', 'data/india/corp-actions-history.json', 'data/india/corp-actions.json']) if (existsSync(f)) for (const a of JSON.parse(readFileSync(f, 'utf8'))) { if (!/dividend/i.test(a.subject ?? '') || !a.exDate) continue; let amt = 0; for (const m of (a.subject.matchAll(/(?:Rs\.?|Re\.?|INR)\s*([\d.]+)/gi))) amt += Number(m[1]); const pm = a.subject.match(/(?:Rs\.?|Re\.?)\s*([\d.]+)\s*(?:\/-)?\s*Per\s*Share/i); if (pm) amt = Number(pm[1]); if (!(amt > 0) || amt > 5000) continue; const l = divs.get(a.symbol) || []; l.push([a.exDate, amt]); divs.set(a.symbol, l); }
const dyAt = (sym, D) => { const l = divs.get(sym); if (!l) return 0; const lo = new Date(new Date(D) - 365 * 864e5).toISOString().slice(0, 10); let x = 0; const seen = new Set(); for (const [d, a] of l) if (d <= D && d > lo && !seen.has(d + a)) { seen.add(d + a); x += a; } return x; };
const me = []; for (let t = 1; t < N; t++) if (dates[t].slice(0, 7) !== dates[t + 1]?.slice(0, 7) && dates[t].slice(0, 7) >= '2019-01' && t + 252 <= N - 1) me.push(t);
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
    { const fy = f.fiscalYears.filter((y) => y.pat != null).slice(0, 3); x.f.NEY = fy.length === 3 ? (fy.reduce((s, y) => s + y.pat, 0) / 3) / f.marketCap : NaN; const pe = f.earningsYield > 0 ? 1 / f.earningsYield : NaN, g = f.growth.pat; x.f.PEG = pe > 0 && g > 0 ? pe / (g * 100) : NaN; const d = dyAt(sym, D); x.f.DYr = d / raw; x.f.pays = d > 0;
  const bs = f.bs, eq = bs?.equity; x.f.PB = eq > 0 ? f.marketCap / eq : NaN; x.f.EVE = !f.financial && f.enterpriseValue > 0 && f.ttm.operatingEbit > 0 ? f.enterpriseValue / f.ttm.operatingEbit : NaN; x.f.ROCE = f.returnOnCapital ?? NaN; x.f.DE = !f.financial && eq > 0 && bs?.borrowings != null ? bs.borrowings / eq : NaN; }
  U.push(x);
  }
  const m12 = med(allRet); for (const x of U) x.ex = x.c12 - m12;
  const cut = {}; for (const k of ['EY', 'SY', 'BY', 'GR', 'MG', 'EM']) { const v = U.filter((x) => !(x.f.fin && (k === 'BY' || k === 'EM' || k === 'MG'))).map((x) => x.f[k]); cut[k] = { p20: quant(v, 0.2), p50: quant(v, 0.5), p80: quant(v, 0.8) }; }
  for (const x of U) { const f = x.f; x.F = { EY5: f.EY >= cut.EY.p80, SY5: f.SY >= cut.SY.p80, BY5: f.BY >= cut.BY.p80 && !f.fin, GR5: f.GR >= cut.GR.p80, MG5: f.MG >= cut.MG.p80 && !f.fin, IC5: f.IC >= 8 && !f.fin, EYbot: f.EY <= cut.EY.p20, SYbot: f.SY <= cut.SY.p20, GRbot: f.GR <= cut.GR.p20,
    V1: f.EY >= cut.EY.p80 && f.GR >= 0.10 && f.MG >= cut.MG.p50 && !f.fin, V2: f.EY >= cut.EY.p80 && f.EM >= cut.EM.p50 && f.IC >= 3 && !f.fin, V3: f.SY >= cut.SY.p80 && f.GR >= cut.GR.p50 && f.MG > 0 && !f.fin }; }
  rows.push(...U);
}

const halves = { first: rows.filter((r) => r.t <= dates.findLastIndex((d) => d <= '2020-12-31')), second: rows.filter((r) => dates[r.t] >= '2021-01-01' && r.t + 756 <= N - 1) };
const full = rows.filter((r) => r.t + 756 <= N - 1);
const rate = (a) => a.filter((r) => r.a).length / a.length;
// cut points per month-end
const byT = new Map(); for (const r of rows) { if (!byT.has(r.t)) byT.set(r.t, []); byT.get(r.t).push(r); }
const q = (a, p) => quant(a, p);
for (const [t, U] of byT) { const c = {}; for (const k of ['NEY', 'PEG', 'DYr', 'PB', 'EVE', 'ROCE', 'DE']) { const v = U.map((x) => x.f[k]).filter(Number.isFinite); c[k] = { p20: q(v, 0.2), p50: q(v, 0.5), p80: q(v, 0.8) }; } const dyv = U.filter((x) => x.f.pays).map((x) => x.f.DYr); c.DYp = { p80: q(dyv, 0.8) };
  for (const x of U) { const f = x.f; x.F = { NEY5: f.NEY >= c.NEY.p80, PEGlow: f.PEG <= c.PEG.p20, DY5: f.pays && f.DYr >= c.DYp.p80, noDiv: !f.pays, PB5: f.PB <= c.PB.p20, EVE5: f.EVE <= c.EVE.p20, ROCE5: f.ROCE >= c.ROCE.p80, DE5: f.DE <= c.DE.p20, V4: f.PB <= c.PB.p20 && f.ROCE >= c.ROCE.p50 && f.DE <= c.DE.p50, V5: f.EVE <= c.EVE.p20 && f.ROCE >= c.ROCE.p80 }; } }
console.log('dividend names parsed:', divs.size);
const A = ['NEY5', 'PEGlow', 'DY5', 'noDiv'];
for (const [nm, S] of Object.entries(halves)) { const bs = rate(S), bm = med(S.map((r) => r.c12)); console.log(`\n== Set A ${nm}: ${S.length} covered stock-months; covered 3x rate ${pc(bs)}, 12m median ${pc(bm)}`);
  for (const k of A) { const R = S.filter((r) => r.F[k]); if (R.length < 30) { console.log(k, R.length); continue; } const ys = [...new Set(R.map((r) => r.y))].sort().map((y) => { const z = R.filter((r) => r.y === y); return `${y}:${pc(med(z.map((r) => r.ex)))}`; }); console.log(k.padEnd(8), String(R.length).padStart(5), '3x', pc(rate(R)).padStart(6), 'lift', (rate(R) / bs).toFixed(2), '12m med', pc(med(R.map((r) => r.c12))), 'median excess', pc(med(R.map((r) => r.ex))), 'mean excess', pc(mean(R.map((r) => r.ex))), '|', ys.join(' ')); } }
const B = rows.filter((r) => dates[r.t] >= '2022-09-01' && Number.isFinite(r.f.PB)); const a12 = (a) => a.filter((r) => r.c12 >= 0.5).length / a.length;
console.log(`\n== Set B (2022-09..${dates[Math.max(...B.map((r) => r.t))]}): ${B.length} stock-months with a balance sheet, ${new Set(B.map((r) => r.t)).size} month-ends; share up 50%+ in 12m ${pc(a12(B))}, 12m median ${pc(med(B.map((r) => r.c12)))}`);
for (const k of ['PB5', 'EVE5', 'ROCE5', 'DE5', 'V4', 'V5']) { const R = B.filter((r) => r.F[k]); if (R.length < 30) { console.log(k, R.length); continue; } const ys = [...new Set(R.map((r) => r.y))].sort().map((y) => { const z = R.filter((r) => r.y === y), by = B.filter((r) => r.y === y); return `${y}:lift ${(a12(z) / a12(by)).toFixed(2)} med excess ${pc(med(z.map((r) => r.ex)))}(${z.length})`; }); console.log(k.padEnd(6), String(R.length).padStart(5), 'A12', pc(a12(R)).padStart(6), 'lift', (a12(R) / a12(B)).toFixed(2), '12m med', pc(med(R.map((r) => r.c12))), 'median excess', pc(med(R.map((r) => r.ex))), '|', ys.join(' | ')); }
