// C-86 rebalancing cadence. Registered in the change log and the run manifest (C-86-r1) before running.
// Arms on the strategic weights of the allocation engine (horizon 10 years): N no rebalancing; M full rebalance every month-end; Y full rebalance at the first month-end of each year; BF month-end band check, all classes to target if any risk class is outside its band; BE same trigger, only the breaching classes move, to the band edge (the difference goes to or from debt).
// Bands from settings/allocation.json driftBand (5 points; silver 2). Debt is the residual sleeve and is not tested. Proxies, cost and trade timing as C-74. No contributions are simulated.


// Usage: node scripts/replay-rebalance-cadence.mjs --run=C-86-r1
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
const BAND = (k) => S.driftBand[k] ?? S.driftBand.default;
const ARMS = ['N', 'M', 'Y', 'BF', 'BE'];
function simulate(profile, arm, cost) {
  const { w: base } = strategic(profile); let units = null, debt = 0; const val = []; val.turn = 0; val.events = 0;
  const alive = (k, t) => close[k][t] != null && !(k === 'intl' && dates[t] < '2021-06-17');
  const target = (t) => { const w = { ...base }; if (!alive('silver', t)) { w.gold += w.silver; w.silver = 0; } if (!alive('intl', t)) { w.equity += w.intl; w.intl = 0; } return w; };
  let pending = null;
  for (let t = iStart; t < T; t++) {
    if (units === null) { units = {}; const w = target(t); const v = 100; for (const k of RISK) units[k] = alive(k, t) && w[k] ? (v * w[k]) / close[k][t] : 0; debt = v * (1 - RISK.reduce((a, k) => a + w[k], 0)); }
    else debt *= DEBT;
    const cur = (k) => (units[k] ? units[k] * close[k][t] : 0);
    const value = () => debt + RISK.reduce((a, k) => a + cur(k), 0);
    if (pending) {
      const v = value(), w = pending; pending = null; let traded = 0;
      for (const k of RISK) { const tgt = alive(k, t) ? v * w[k] : 0; traded += Math.abs(tgt - cur(k)); units[k] = tgt ? tgt / close[k][t] : 0; }
      const nd = v - RISK.reduce((a, k) => a + cur(k), 0); traded += Math.abs(nd - debt); debt = nd - traded * cost; val.turn += traded; val.events++;
    }
    if (monthEnd.has(t) && arm !== 'N') {
      const v = value(), tw = target(t);
      if (arm === 'M') pending = tw;
      else if (arm === 'Y') { if (dates[t].slice(5, 7) === '01') pending = tw; }
      else {
        const out = RISK.filter((k) => Math.abs(cur(k) / v - tw[k]) > BAND(k) + 1e-12);
        if (out.length) {
          if (arm === 'BF') pending = tw;
          else { const w = {}; for (const k of RISK) { const x = cur(k) / v; w[k] = out.includes(k) ? tw[k] + Math.sign(x - tw[k]) * BAND(k) : x; } pending = w; }
        }
      }
    }
    val.push({ d: dates[t], v: value() });
  }
  return val;
}
const metrics = (rows, from, to) => {
  const r = rows.filter((p) => p.d >= from && p.d <= to); if (r.length < 2) return null; const first = r[0].v, last = r[r.length - 1].v, days = (Date.parse(r[r.length - 1].d) - Date.parse(r[0].d)) / 86400000;
  let hi = r[0].v, dd = 0; for (const p of r) { hi = Math.max(hi, p.v); dd = Math.min(dd, p.v / hi - 1); }
  return { n: r.length, cagr: Math.pow(last / first, 365.25 / days) - 1, dd };
};
const pct = (v) => (v * 100).toFixed(2) + '%';
const [fa, fb] = entry.fit, [ha, hb] = entry.holdout;
const out = { run: RUN, data: { sessions: T, first: dates[0], last: dates[T - 1], fit: entry.fit, holdout: entry.holdout }, profiles: {} };
const manifestGate = gate(entry, simulate('Balanced', 'M', 0.003), (p) => p.d), revealed = !!manifestGate.holdout;
console.log(`${RUN} | ${T} sessions ${dates[0]}..${dates[T - 1]} | simulation from ${dates[iStart]} | fit ${manifestGate.fit.length} sessions | holdout ${revealed ? manifestGate.holdout.length : 'hidden (' + manifestGate.hidden + ' sessions)'}`);
const CAND = ['Y', 'BF', 'BE'];
for (const prof of CHECKED) for (const cost of [0.003, 0.006]) {
  const R = Object.fromEntries(ARMS.map((a) => [a, simulate(prof, a, cost)])), key = `${prof}@${cost}`;
  const stat = (from, to) => Object.fromEntries(ARMS.map((a) => [a, { ...metrics(R[a], from, to), turn: R[a].turn / 100, events: R[a].events }]));
  const fit = stat(fa, fb); const pass = {};
  for (const c of CAND) pass[c] = fit[c].cagr - fit.M.cagr >= -0.005 && fit[c].turn <= fit.M.turn / 2 && fit.M.dd - fit[c].dd <= 0.01;
  out.profiles[key] = { fit, pass }; if (revealed) out.profiles[key].holdout = stat(ha, hb);
  console.log(`FIT ${key}: ` + ARMS.map((a) => `${a} ${pct(fit[a].cagr)} dd ${pct(fit[a].dd)} turn ${fit[a].turn.toFixed(1)}x (${fit[a].events} trades)`).join(' | ') + ` | pass ${CAND.map((c) => c + ':' + (pass[c] ? 'yes' : 'no')).join(' ')}`);
}
const ok = (c) => CHECKED.filter((p) => out.profiles[`${p}@0.003`].pass[c] && out.profiles[`${p}@0.006`].pass[c]).length >= 2 && out.profiles['Balanced@0.003'].pass[c] && out.profiles['Balanced@0.006'].pass[c];
const passers = CAND.filter(ok).sort((a, b) => out.profiles['Balanced@0.003'].fit[a].turn - out.profiles['Balanced@0.003'].fit[b].turn);
out.passers = passers; out.proposed = passers[0] ?? null; out.verdict = passers.length ? 'PASS: ' + passers[0] : 'FAIL';
console.log(`FIT RULE: passers ${passers.join(', ') || 'none'} -> ${out.verdict}`);
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/rebalance-cadence.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), out }, null, 1) + '\n');
