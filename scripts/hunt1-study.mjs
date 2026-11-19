// HUNT-1 (docs/replay/HUNT-1-PREREG.md). Usage: node scripts/hunt1-study.mjs --from 2011-01-03 --to 2018-12-31 [--rules M1,S2]
import { loadIndia, loadUS, summarize, line, header } from './lib/study-harness.mjs';
import { writeFileSync } from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = arg('from'), TO = arg('to'), RULES = (arg('rules', 'M1,M2,M3,M4,S1,S2,S3,S4')).split(',');
const H = arg('market') === 'us' ? loadUS() : loadIndia(), { dates, series, syms } = H;
const t0 = Math.max(H.t0(FROM), 260), t1 = H.dates.findLastIndex((d) => d <= TO);
const out = Object.fromEntries(RULES.map((r) => [r, []])), last = Object.fromEntries(RULES.map((r) => [r, new Map()]));
const mean = (s, a, b) => { let x = 0, n = 0; for (let i = a; i <= b; i++) if (s[i] > 0) { x += s[i]; n++; } return n >= (b - a + 1) * 0.85 ? x / n : NaN; };
for (let t = t0; t <= t1; t++) {
  const D = dates[t], g = H.green(D), liq = [];
  const rets = []; 
  for (const sym of syms) { const s = series.get(sym); if (!(s.c[t] > 0) || !(s.c[t - 126] > 0) || !(s.c[t - 1] > 0)) continue; const tv = H.tv(sym, t - 19, t); if (!(tv >= 2e7)) continue; liq.push([sym, tv]); rets.push(s.c[t] / s.c[t - 126] - 1); }
  if (liq.length < 100) continue; const cut10 = [...rets].sort((a, b) => a - b)[Math.floor(rets.length * 0.9)];
  liq.forEach(([sym, tv], qi) => {
    const s = series.get(sym), c = s.c, v = s.v, px = c[t];
    const v50 = (() => { let x = 0, n = 0; for (let k = t - 50; k < t; k++) if (v[k] >= 0) { x += v[k]; n++; } return n >= 40 ? x / n : NaN; })();
    const m200 = mean(c, t - 199, t), m50 = mean(c, t - 49, t), m10 = mean(c, t - 9, t);
    let hi252 = 0, lo60 = 1e18, hi60 = 0, hi20 = 0; for (let k = t - 251; k < t; k++) if (c[k] > hi252) hi252 = c[k]; for (let k = t - 59; k <= t; k++) { if (c[k] > 0 && c[k] < lo60) lo60 = c[k]; if (c[k] > hi60) hi60 = c[k]; } for (let k = t - 20; k < t; k++) if (c[k] > hi20) hi20 = c[k];
    const hit = (r, gap, o) => { if (t - (last[r].get(sym) ?? -1e9) < gap) return; const tr = H.trade(sym, t, o); if (!tr) return; last[r].set(sym, t); out[r].push(tr); };
    const newHigh = px >= hi252 && px > 0;
    const volx = (m) => v[t] >= m * v50;
    const rng = (a, b) => { let h = 0, l = 1e18, n = 0, sum = 0; for (let k = a; k <= b; k++) if (c[k] > 0 && c[k - 1] > 0) { sum += Math.abs(c[k] / c[k - 1] - 1); n++; } return n >= (b - a + 1) * 0.8 ? sum / n : NaN; };
    const MB = { trail: 0.35, hold: 780 }, SW = { trail: 0.08, hold: 15 };
    if (RULES.includes('M1') && g && newHigh && volx(2) && hi60 / lo60 <= 1.35 && px > m200) hit('M1', 126, MB);
    if (RULES.includes('M2') && g && newHigh && volx(2) && hi60 / lo60 <= 1.35 && px > m200 && tv < 1.5e8) hit('M2', 126, MB);
    if (RULES.includes('M3') && g && newHigh && rets[qi] >= cut10) hit('M3', 126, MB);
    if (RULES.includes('M4') && g && newHigh && px > m200 && rng(t - 19, t) < 0.6 * rng(t - 99, t)) hit('M4', 126, MB);
    if (RULES.includes('S1') && px > hi20 && volx(1.5) && px > m50) hit('S1', 60, SW);
    if (RULES.includes('S2') && px > m200 && m50 > m200 && c[t] < c[t - 1] && c[t - 1] < c[t - 2] && c[t - 2] < c[t - 3] && px >= 0.92 * hi60 && px < m10) hit('S2', 60, SW);
    if (RULES.includes('S3')) { const o = H.open(sym, t); if (o >= 1.04 * c[t - 1] && volx(3) && px > o) hit('S3', 60, SW); }
    if (RULES.includes('S4') && px > m200 && c[t - 5] > 0 && px / c[t - 5] - 1 <= -0.12 && px > c[t - 1]) hit('S4', 60, SW);
  });
}
console.log(`HUNT-1 ${FROM}..${TO}\n` + header);
const rows = {}; for (const r of RULES) { const s = summarize(out[r], r); rows[r] = s; console.log(line(s)); }
for (const r of RULES) console.log(r, 'years', Object.entries(rows[r].years ?? {}).map(([y, o]) => `${y}:${(o.excess * 100).toFixed(0)}(${o.n})`).join(' '), '| top-decile share', (rows[r].topDecileShare * 100).toFixed(0) + '%');
writeFileSync(`/tmp/claude-0/-home-claude/777998c4-9f61-52d1-a143-48376f83c2ab/scratchpad/hunt1-${arg('market','in')}-${FROM}-${TO}.json`, JSON.stringify(rows));
// Descriptive portfolio replay of the passing rules (no tuning): --portfolio M2 ; 50 names x 2%, first come first served, trades already carry cost and the 35% trail.
if (arg('portfolio')) for (const r of arg('portfolio').split(',')) {
  const trs = [...out[r]].sort((a, b) => a.t - b.t), N = H.N, open = []; let cash = 1, eq = [], pk = 1, mdd = 0, ti = 0; const nav = new Float64Array(N).fill(NaN);
  const ev = trs.map((x) => ({ ...x, tEnd: x.t + 1 + x.hold })); const pos = [];
  let val = 1; const sizeOf = () => 0.02;
  for (let t = t0; t <= t1 + 1 && t < N; t++) {
    // mark positions
    let pv = 0; for (const p of pos) { const c = series.get(p.sym).c[t]; if (c > 0) p.last = c; pv += p.sh * p.last; }
    val = cash + pv;
    for (let i = pos.length - 1; i >= 0; i--) if (pos[i].tEnd <= t) { cash += pos[i].sh * pos[i].last * (1 - H.costRT / 2); pos.splice(i, 1); }
    while (ti < ev.length && ev[ti].t < t) { const x = ev[ti++]; if (pos.length >= 50 || x.t + 1 !== t) continue; const amt = Math.min(cash, val * 0.02); if (amt < val * 0.005) continue; cash -= amt; pos.push({ sym: x.sym, sh: amt / x.ent * (1 - H.costRT / 2), last: x.ent, tEnd: x.tEnd }); }
    nav[t] = cash + pos.reduce((a, p) => a + p.sh * p.last, 0);
  }
  const a = t0, b = Math.min(N - 1, t1), yrs = (Date.parse(dates[b]) - Date.parse(dates[a])) / 3.156e10; let pk2 = 0, dd = 0, ipk = 0, idd = 0; for (let t = a; t <= b; t++) { if (nav[t] > pk2) pk2 = nav[t]; dd = Math.min(dd, nav[t] / pk2 - 1); const iv = H.idx[H.ik[H.idxAt(dates[t])]]; if (iv > ipk) ipk = iv; idd = Math.min(idd, iv / ipk - 1); }
  const ir = H.idxRet(dates[a], dates[b]), fr = nav[b] / nav[a] - 1, inv = (() => { let s = 0, n = 0; for (let t = a; t <= b; t++) { const x = 1 - 0; n++; } return 0; })();
  console.log(`PORTFOLIO ${r}: total ${(fr * 100).toFixed(0)}% CAGR ${((Math.pow(1 + fr, 1 / yrs) - 1) * 100).toFixed(1)}% maxDD ${(dd * 100).toFixed(0)}% | Nifty500 total ${(ir * 100).toFixed(0)}% CAGR ${((Math.pow(1 + ir, 1 / yrs) - 1) * 100).toFixed(1)}% maxDD ${(idd * 100).toFixed(0)}%`);
}
