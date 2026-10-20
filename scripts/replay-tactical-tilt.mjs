// C-74 tactical tilt of asset-class weights. Registered in the change log and the run manifest (C-74-r1) before running.
// Static arm: the allocation engine's strategic weights (horizon 10 years), rebalanced each month-end. Tilt arm: the same, but each risk sleeve is over-weighted by tau when its price is above its
// 200-session average and its 126-session return is positive, and under-weighted by tau otherwise (the difference moves to or from debt), each sleeve held inside its limit.
// Sleeves and proxies: equity NIFTYBEES, international MON100, gold GOLDBEES, silver SILVERBEES (folded into gold before it exists), debt and liquid a fixed 6% a year.
// Signals at month-end close, trade at the next session close, 0.30% of traded value in both arms. Holdout rows stay hidden until the manifest records a reveal.
// Usage: node scripts/replay-tactical-tilt.mjs --run=C-74-r1
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { allocate } from '../src/pm/allocation.ts';
import { loadManifest, gate } from '../src/backtest/manifest.ts';
const RUN = process.argv.find((a) => a.startsWith('--run='))?.slice(6);
const entry = loadManifest().runs.find((r) => r.id === RUN); if (!entry) { console.error('pass --run=<registered id>'); process.exit(1); }
const S = JSON.parse(readFileSync('settings/allocation.json', 'utf8'));
const SYM = { equity: 'NIFTYBEES', intl: 'MON100', gold: 'GOLDBEES', silver: 'SILVERBEES' }, RISK = Object.keys(SYM);
// ---- prices: NSE bhav copies to 16 Oct 2025, then the stored daily closes
const px = Object.fromEntries(Object.values(SYM).map((s) => [s, {}]));
for (const f of readdirSync('data/india/bhav-hist').filter((x) => /^\d{4}-\d\d-\d\d\.json\.gz$/.test(x))) { const d = JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f)).toString()); for (const s of Object.values(SYM)) { const r = d.rows[s]; if (r) px[s][d.date] = r[5]; } }
for (const dir of ['data/india/prices-hist', 'site/pm-data/prices']) for (const f of readdirSync(dir).filter((x) => /^\d{4}-\d\d\.json$/.test(x)).sort()) { const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); for (const s of Object.values(SYM)) { const a = d.px[s]; if (a) d.dates.forEach((dt, i) => { if (a[i] != null && dt > '2025-10-16') px[s][dt] = a[i]; }); } }
const dates = Object.keys(px.NIFTYBEES).filter((d) => d >= '2020-01-02').sort(), T = dates.length;
const close = Object.fromEntries(RISK.map((k) => [k, dates.map((d) => px[SYM[k]][d] ?? null)]));
// MON100's first day (2021-06-16) is a listing artefact (ten-fold price break next day): its history starts 2021-06-17
const iStart = dates.indexOf('2021-06-18'), DEBT = Math.pow(1.06, 1 / 252);
const sma = (a, t, n) => { if (t < n - 1) return null; let s = 0; for (let k = t - n + 1; k <= t; k++) { if (a[k] == null) return null; s += a[k]; } return s / n; };
const up = (k, t) => { const a = close[k], m = sma(a, t, 200); if (m == null || t < 126 || a[t - 126] == null || a[t] == null) return null; return a[t] > m && a[t] / a[t - 126] - 1 > 0; };
const monthEnd = new Set(); for (let t = 0; t < T - 1; t++) if (dates[t].slice(0, 7) !== dates[t + 1].slice(0, 7)) monthEnd.add(t);
const TAU = { Cautious: 0.25, Balanced: 0.35, Aggressive: 0.5 }, CHECKED = ['Cautious', 'Balanced', 'Aggressive'];
function strategic(profile) {
  const r = allocate(S, { capital: 1e6, profile, horizonYears: 10 }); const g = (c) => r.rows.find((x) => x.cls === c)?.target ?? 0;
  const eqMax = allocate(S, { capital: 1e6, profile, horizonYears: 30 }).equityShare;
  return { w: { equity: g('direct_equity') + g('active_equity_fund') + g('index') + g('sector_thematic'), intl: g('international'), gold: g('gold'), silver: g('silver') }, max: { equity: eqMax, intl: S.classMax.international, gold: S.classMax.gold, silver: S.classMax.silver } };
}
function simulate(profile, tilt, cost) {
  const { w: base, max } = strategic(profile), tau = TAU[profile]; let units = null, debt = 0; const val = [];
  const alive = (k, t) => close[k][t] != null && !(k === 'intl' && dates[t] < '2021-06-17');
  const weights = (t, useTilt) => {
    const w = { ...base }; if (!alive('silver', t)) { w.gold += w.silver; w.silver = 0; }
    if (!alive('intl', t)) { w.equity += w.intl; w.intl = 0; }
    if (useTilt) for (const k of RISK) { if (!w[k]) continue; const u = up(k, t); if (u === null) continue; w[k] = Math.min(max[k] ?? 1, Math.max(0, w[k] * (1 + (u ? tau : -tau)))); }
    const s = RISK.reduce((a, k) => a + w[k], 0); if (s > 1) for (const k of RISK) w[k] /= s;
    return w;
  };
  let pending = null;
  for (let t = iStart; t < T; t++) {
    if (units === null) { units = {}; const w = weights(t, false); let v = 100; for (const k of RISK) units[k] = alive(k, t) && w[k] ? (v * w[k]) / close[k][t] : 0; debt = v * (1 - RISK.reduce((a, k) => a + w[k], 0)); }
    else debt *= DEBT;
    const value = () => debt + RISK.reduce((a, k) => a + (units[k] ? units[k] * close[k][t] : 0), 0);
    if (pending) {   // rebalance at today's close to the weights set at the last month-end
      const v = value(); let traded = 0; const w = pending; pending = null;
      for (const k of RISK) { const tgt = alive(k, t) ? v * w[k] : 0, cur = units[k] ? units[k] * close[k][t] : 0; traded += Math.abs(tgt - cur); units[k] = tgt ? tgt / close[k][t] : 0; }
      const newDebt = v - RISK.reduce((a, k) => a + (units[k] ? units[k] * close[k][t] : 0), 0); traded += Math.abs(newDebt - debt); debt = newDebt - traded * cost;   // cost taken from the debt sleeve
      val.turn = (val.turn ?? 0) + traded;
    }
    if (monthEnd.has(t)) pending = weights(t, tilt);
    val.push({ d: dates[t], v: value() });
  }
  return val;
}
const metrics = (rows, from, to) => {
  const r = rows.filter((p) => p.d >= from && p.d <= to); if (r.length < 2) return null; const first = r[0].v, last = r[r.length - 1].v, days = (Date.parse(r[r.length - 1].d) - Date.parse(r[0].d)) / 86400000;
  let hi = r[0].v, dd = 0; for (const p of r) { hi = Math.max(hi, p.v); dd = Math.min(dd, p.v / hi - 1); }
  return { n: r.length, cagr: Math.pow(last / first, 365.25 / days) - 1, dd, total: last / first - 1 };
};
const pct = (v) => (v * 100).toFixed(2) + '%';
const [fa, fb] = entry.fit, [ha, hb] = entry.holdout;
const blocks = [[fa, '2022-06-17'], ['2022-06-18', '2023-06-17'], ['2023-06-18', fb]];
const out = { run: RUN, data: { sessions: T, first: dates[0], last: dates[T - 1], fit: entry.fit, holdout: entry.holdout }, profiles: {} };
const manifestGate = gate(entry, simulate('Balanced', false, 0.003), (p) => p.d);
console.log(`${RUN} | ${T} sessions ${dates[0]}..${dates[T - 1]} | simulation from ${dates[iStart]} | fit ${manifestGate.fit.length} sessions | holdout ${manifestGate.holdout ? manifestGate.holdout.length : 'hidden (' + manifestGate.hidden + ' sessions)'}`);
const revealed = !!manifestGate.holdout;
for (const prof of CHECKED) for (const cost of [0.003, 0.006]) {
  const sRows = simulate(prof, false, cost), tRows = simulate(prof, true, cost), key = `${prof}@${cost}`;
  const one = (from, to) => { const s = metrics(sRows, from, to), t = metrics(tRows, from, to); return s && t ? { S: s, T: t, dCagr: t.cagr - s.cagr, ddWorse: s.dd - t.dd } : null; };
  const fit = one(fa, fb), yrs = blocks.map(([a, b]) => one(a, b)), ahead = yrs.filter((y) => y && y.dCagr > 0).length;
  const ok = fit.dCagr >= 0.01 && fit.ddWorse <= 0.01 && ahead >= 2;
  out.profiles[key] = { fit, blocks: yrs.map((y) => y && { dCagr: y.dCagr, S: y.S.cagr, T: y.T.cagr }), ahead, fitRule: ok, turnover: { S: sRows.turn, T: tRows.turn } };
  if (revealed) { const ho = one(ha, hb); out.profiles[key].holdout = ho; }
  console.log(`FIT ${key}: static ${pct(fit.S.cagr)} dd ${pct(fit.S.dd)} | tilt ${pct(fit.T.cagr)} dd ${pct(fit.T.dd)} | tilt minus static ${pct(fit.dCagr)}, drawdown worse by ${pct(fit.ddWorse)} | ahead in ${ahead}/3 blocks [${yrs.map((y) => y ? pct(y.dCagr) : 'n/a').join(', ')}] | turnover (x start value) static ${(sRows.turn / 100).toFixed(1)} tilt ${(tRows.turn / 100).toFixed(1)} | ${ok ? 'meets bars' : 'misses'}`);
}
const b1 = out.profiles['Balanced@0.003'].fitRule, b2 = out.profiles['Balanced@0.006'].fitRule, others = CHECKED.filter((p) => out.profiles[`${p}@0.006`].fitRule).length;
out.verdict = b1 && b2 && others >= 2 ? 'PASS' : 'FAIL'; console.log(`FIT RULE (Balanced at 0.30% cost: ${b1}; at double cost: ${b2}; profiles meeting the bars at double cost: ${others}/3): ${out.verdict}`);
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/tactical-tilt.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), out }, null, 1) + '\n');
