// C-72 India skip days. Registered in the change log and the run manifest (C-72-r1) before running.
// Runs the engine's own analyze() over Nifty 50 rows (Jan 2020 to 16 Oct 2025) with no skipped days (A) and with expiry / Muhurat / after-holiday sessions skipped (B), then asks which version's
// "5 or more active distribution days" signal better separates the next 20 and 60 sessions of the Nifty 500. Holdout rows stay hidden until the manifest records a reveal.
// Usage: node scripts/replay-ind-skipflag.mjs --run=C-72-r1
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { analyze } from '../src/engine/regime.ts';
import { dateCalendar } from '../src/backtest/desk-sim.ts';
import { loadManifest, gate } from '../src/backtest/manifest.ts';
const RUN = process.argv.find((a) => a.startsWith('--run='))?.slice(6);
const entry = loadManifest().runs.find((r) => r.id === RUN); if (!entry) { console.error('pass --run=<registered id>'); process.exit(1); }
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const n50 = {}, n500 = {};
for (let y = 2020; y <= 2025; y++) { const j = R(`data/india/idx-hist/idx-${y}.json`); for (const [d, v] of Object.entries(j['Nifty 50'] || {})) n50[d] = v; for (const [d, v] of Object.entries(j['Nifty 500'] || {})) n500[d] = v; }
const dates = Object.keys(n50).filter((d) => d <= '2025-10-16' && n500[d]).sort(), T = dates.length, cal = dateCalendar(dates);
const rows = dates.map((d) => ({ date: d, open: n50[d][0], high: n50[d][1], low: n50[d][2], close: n50[d][3], volume: n50[d][4] }));
const c500 = dates.map((d) => n500[d][3]);
// ---- skipped days (variant B)
const MUHURAT = new Set(['2020-11-14', '2021-11-04', '2022-10-24', '2023-11-12', '2024-11-01', '2025-10-21']);
const set = new Set(dates), ymd = (t) => t.toISOString().slice(0, 10);
const expiry = new Set(); // monthly F&O expiry: last Thursday to Aug 2025, last Tuesday from Sep 2025; the previous session if that day is not a session
for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) {
  const want = (y > 2025 || (y === 2025 && m >= 8)) ? 2 : 4; let t = new Date(Date.UTC(y, m + 1, 0)); while (t.getUTCDay() !== want) t.setUTCDate(t.getUTCDate() - 1);
  for (let k = 0; k < 6 && !set.has(ymd(t)); k++) t.setUTCDate(t.getUTCDate() - 1); if (set.has(ymd(t))) expiry.add(ymd(t));
}
const afterHoliday = new Set(); // the previous weekday (Mon-Fri) was not a session
for (const d of dates) { const t = new Date(d + 'T00:00:00Z'); do t.setUTCDate(t.getUTCDate() - 1); while (t.getUTCDay() === 0 || t.getUTCDay() === 6); if (!set.has(ymd(t)) && d > dates[0]) afterHoliday.add(d); }
const skipDay = (d) => expiry.has(d) || MUHURAT.has(d) || afterHoliday.has(d);
const rowsB = rows.map((r) => ({ ...r, skip: skipDay(r.date) }));
// ---- signal per session: 5+ active distribution days on the 130 rows ending there
const sig = (rs) => { const s = new Uint8Array(T); for (let t = 60; t < T; t++) { const w = rs.slice(Math.max(0, t - 129), t + 1); s[t] = analyze(w, { cal }).active.length >= 5 ? 1 : 0; } return s; };
const sA = sig(rows), sB = sig(rowsB);
// ---- outcomes
const fwd = (t, h) => (t + h < T ? c500[t + h] / c500[t] - 1 : NaN);
const dd60 = (t) => { if (t + 60 >= T) return NaN; let hi = c500[t], w = 0; for (let k = t + 1; k <= t + 60; k++) { hi = Math.max(hi, c500[k]); w = Math.min(w, c500[k] / hi - 1); } return w; };
const pts = []; for (let t = 60; t < T; t++) if (fwd(t, 60) === fwd(t, 60)) pts.push({ t, d: dates[t], ym: dates[t].slice(0, 7), a: sA[t], b: sB[t], r20: fwd(t, 20), r60: fwd(t, 60), dd: dd60(t) });
const g = gate(entry, pts, (p) => p.d);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const pct = (v) => (v * 100).toFixed(2) + '%', f = (v) => (Number.isFinite(v) ? v.toFixed(2) : 'n/a');
const gap = (a, key, which) => { const on = a.filter((p) => p[which]).map((p) => p[key]).filter(Number.isFinite), off = a.filter((p) => !p[which]).map((p) => p[key]).filter(Number.isFinite); return { on: on.length, off: off.length, mOn: mean(on), mOff: mean(off), gap: mean(off) - mean(on) }; };
const clusterT = (a, h) => { const m = {}; for (const p of a) { const x = h(p); if (Number.isFinite(x)) (m[p.ym] ||= []).push(x); } const v = Object.values(m).map(mean); return v.length > 2 ? mean(v) / (sd(v) / Math.sqrt(v.length)) : NaN; };
// paired monthly difference of the (off - on) gap: for each month, gapB - gapA using that month's rows is not defined when a month has only one state, so the paired test is on a per-session score:
// score_v = (signal off ? +1 : -1) * return, so mean(score) rises when "off" sessions have higher returns than "on" sessions; B - A per session, clustered by month.
const score = (p, w, key) => (p[w] ? -1 : 1) * p[key];
const report = (name, a) => {
  const diff = a.filter((p) => p.a !== p.b).length;
  const o = { n: a.length, differ: diff, onA: a.filter((p) => p.a).length, onB: a.filter((p) => p.b).length };
  for (const key of ['r20', 'r60', 'dd']) o[key] = { A: gap(a, key, 'a'), B: gap(a, key, 'b') };
  o.t60 = clusterT(a, (p) => score(p, 'b', 'r60') - score(p, 'a', 'r60')); o.dGap60 = o.r60.B.gap - o.r60.A.gap;
  console.log(`${name}: ${a.length} sessions; signal on A ${o.onA}, on B ${o.onB}; A and B differ on ${diff}`);
  for (const key of ['r20', 'r60', 'dd']) { const x = o[key]; console.log(`  ${key}: A on ${pct(x.A.mOn)} off ${pct(x.A.mOff)} gap ${pct(x.A.gap)} | B on ${pct(x.B.mOn)} off ${pct(x.B.mOff)} gap ${pct(x.B.gap)}`); }
  console.log(`  B gap minus A gap (60-session return): ${pct(o.dGap60)}, paired monthly-cluster t ${f(o.t60)}`); return o;
};
console.log(`${RUN} | sessions ${T} (${dates[0]} to ${dates[T - 1]}) | skipped days: expiry ${expiry.size}, Muhurat ${[...MUHURAT].filter((d) => set.has(d)).length}, after-holiday ${afterHoliday.size}, any ${dates.filter(skipDay).length}`);
console.log(`fit ${g.fit.length} sessions | holdout ${g.holdout ? g.holdout.length : 'hidden (' + g.hidden + ' sessions)'}`);
const out = { run: RUN, skipped: { expiry: expiry.size, afterHoliday: afterHoliday.size, any: dates.filter(skipDay).length }, fit: report('FIT', g.fit) }; if (g.holdout) out.holdout = report('HOLDOUT', g.holdout);
const F = out.fit, pass = F.differ >= 60 && F.dGap60 >= 0.01 && F.t60 > 2;
console.log(`FIT RULE: ${F.differ < 60 ? 'NO DETECTABLE DIFFERENCE (A and B differ on fewer than 60 sessions)' : pass ? 'PASS' : 'FAIL'}`);
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/ind-skipflag.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), out }, null, 1) + '\n');
