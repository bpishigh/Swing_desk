// Shared harness for registered event studies (19 Nov 2026). Loads split-adjusted India or US history once and gives every study the same fills, costs and summary.
// Lessons built in: opens are put on the adjusted scale (C-243), prices adjusted for splits and bonuses, index series spliced (BSE 500 before the first Nifty 500 date).
// A study = a signal function (sym, t) -> boolean/object over this data + a pre-registration doc. This file decides nothing about rules.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../../src/ingest/us-scan.ts';
import { resolveHistory, toDays } from '../../src/backtest/india-asof.ts';
import { loadDays } from '../us-hist-lib.mjs';
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);

export function loadIndia() {
  const raw = [];
  for (const dir of ['bhav-hist', 'bhav-pre2020']) for (const f of readdirSync('data/india/' + dir).filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync(`data/india/${dir}/${f}`))));
  for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
  raw.sort((a, b) => (a.date < b.date ? -1 : 1)); const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date);
  const actions = [...R('data/india/corp-actions-history-pre2019.json', []), ...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
  const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
  const res = resolveHistory(uniq, actions, ov), days = toDays(uniq), dates = days.map((d) => d.date), eq = new Set();
  for (const d of uniq) for (const [s, r] of Object.entries(d.rows)) if (r[0] === 'EQ') eq.add(s);
  const series = buildHistories(days, res.splits, eq).series;
  const bse = {}, nif = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['BSE 500'] ?? {})) if (v?.[3] > 0) bse[d] = v[3]; for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) if (v?.[3] > 0) nif[d] = v[3]; }
  const join = Object.keys(nif).sort().find((d) => bse[d] > 0), k = bse[join] / nif[join], idx = {}; for (const d of Object.keys(bse)) if (d < join) idx[d] = bse[d]; for (const d of Object.keys(nif)) idx[d] = nif[d] * k;
  return finish({ market: 'in', uniq, days, dates, series, idx, openRaw: (sym, i) => { const r = uniq[i]?.rows?.[sym]; return r && r[2] > 0 && r[5] > 0 ? [r[2], r[5]] : null; }, costRT: 0.013, floor: 2e7 });
}
export function loadUS() {
  const days = loadDays(), dates = days.map((d) => d.date), series = buildHistories(days, [], new Set(days.flatMap((d) => d.rows.map((r) => r[0])))).series;
  const spy = JSON.parse(gunzipSync(readFileSync('data/us/hist-bench/SPY.json.gz')).toString()).bars, idx = Object.fromEntries(spy.map((b) => [b[0], b[1]]));
  return finish({ market: 'us', uniq: null, days, dates, series, idx, openRaw: () => null, costRT: 0.004, floor: 2e6 });
}
function finish(H) {
  const { dates, series, idx } = H; H.N = dates.length; H.syms = [...series.keys()];
  const ik = Object.keys(idx).sort(); H.ik = ik;
  H.idxAt = (D) => { let lo = 0, hi = ik.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ik[m] <= D) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
  H.idxRet = (D0, D1) => { const a = H.idxAt(D0), b = H.idxAt(D1); return a >= 0 && b >= 0 ? idx[ik[b]] / idx[ik[a]] - 1 : NaN; };
  H.green = (D) => { const a = H.idxAt(D); if (a < 199) return false; let s = 0; for (let i = a - 199; i <= a; i++) s += idx[ik[i]]; return idx[ik[a]] > s / 200; };
  // open on the same scale as the split-adjusted closes (India); the US store has no opens, so the fill-day close stands in
  H.open = (sym, i) => { const s = series.get(sym); if (!s) return NaN; if (H.market === 'us') return s.c[i] > 0 ? s.c[i] : NaN; const p = H.openRaw(sym, i); return p && s.c[i] > 0 ? (p[0] * s.c[i]) / p[1] : NaN; };
  H.tv = (sym, a, b) => { const s = series.get(sym); let x = 0, n = 0; for (let i = a; i <= b; i++) if (s.c[i] > 0 && s.v[i] >= 0) { x += s.c[i] * s.v[i]; n++; } return n >= (b - a + 1) * 0.7 ? x / n : NaN; };
  H.t0 = (D) => dates.findIndex((d) => d >= D);
  // One trade: signal on session t (close), fill at next open, hold with a trailing stop on closes (trail fraction, or null) and/or a fixed number of sessions; returns net return and benchmark return over the same dates.
  H.trade = (sym, t, o = {}) => {
    const s = series.get(sym), N = H.N, hold = o.hold ?? 780, ent = H.open(sym, t + 1); if (!(ent > 0) || t + 2 >= N) return null;
    let hi = ent, j = t + 1, xo = null;
    for (; j <= Math.min(N - 2, t + 1 + hold); j++) {
      if (!(s.c[j] > 0)) continue; if (s.c[j] > hi) hi = s.c[j];
      if (o.trail && s.c[j] <= hi * (1 - o.trail)) { const x = H.open(sym, j + 1); xo = x > 0 ? x : s.c[j]; break; }
      if (o.hold && j === t + 1 + o.hold) { const x = H.open(sym, j + 1); xo = x > 0 ? x : s.c[j]; break; }
    }
    if (xo == null) { let m = Math.min(N - 1, t + 1 + hold); while (m > t && !(s.c[m] > 0)) m--; xo = s.c[m]; j = m; }
    const cost = o.cost ?? H.costRT; return { sym, t, D: dates[t], year: dates[t].slice(0, 4), ent, ret: xo / ent - 1 - cost, bench: H.idxRet(dates[t + 1], dates[Math.min(N - 1, j + 1)]), hold: j - t, open: j >= N - 2 };
  };
  return H;
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export function summarize(trs, label = '') {
  const r = trs.map((x) => x.ret), n = r.length, srt = [...r].sort((a, b) => b - a), tot = r.reduce((a, b) => a + b, 0), bench = mean(trs.map((x) => x.bench).filter(Number.isFinite));
  const years = {}; for (const y of [...new Set(trs.map((x) => x.year))].sort()) { const a = trs.filter((x) => x.year === y); years[y] = { n: a.length, mean: mean(a.map((x) => x.ret)), excess: mean(a.map((x) => x.ret - (Number.isFinite(x.bench) ? x.bench : 0))) }; }
  return { label, n, mean: tot / n, median: [...r].sort((a, b) => a - b)[n >> 1], win: r.filter((x) => x > 0).length / n, hold: mean(trs.map((x) => x.hold)), meanEx1: n > 1 ? (tot - srt[0]) / (n - 1) : NaN, meanEx2: n > 2 ? (tot - srt[0] - srt[1]) / (n - 2) : NaN, topDecileShare: srt.slice(0, Math.max(1, Math.round(n * 0.1))).reduce((a, b) => a + b, 0) / tot, bench, excess: tot / n - bench, years, yearsPositive: Object.values(years).filter((y) => y.mean > 0).length, yearsN: Object.keys(years).length };
}
export const pc = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
export const line = (s) => `| ${s.label} | ${s.n} | ${pc(s.mean)} | ${pc(s.median)} | ${pc(s.win)} | ${s.hold?.toFixed(0)} | ${pc(s.meanEx2)} | ${pc(s.bench)} | ${pc(s.excess)} | ${s.yearsPositive}/${s.yearsN} |`;
export const header = '| study | n | mean net | median | winners | hold | mean ex best 2 | index same dates | excess | years > 0 |\n|---|---|---|---|---|---|---|---|---|---|';
