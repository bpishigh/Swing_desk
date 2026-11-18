// Trend leaders with a wide trailing exit (docs/replay/TREND-LEADERS-PREREG.md). Event study, one run per sample.
// Usage: node --max-old-space-size=7000 scripts/trend-leaders-study.mjs --from=2011-01-03 --to=2017-12-29 --tag=discovery [--rules=0.25,0.35,0.5]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays } from '../src/backtest/india-asof.ts';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const FROM = arg('from', '2011-01-03'), TO = arg('to', '2017-12-29'), TAG = arg('tag', 'discovery'), OUT = 'docs/replay', RULES = arg('rules', '0.25,0.35,0.5').split(',').map(Number);
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const raw = [];
for (const dir of ['bhav-hist', 'bhav-pre2020']) for (const f of readdirSync('data/india/' + dir).filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync(`data/india/${dir}/${f}`))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
raw.sort((a, b) => (a.date < b.date ? -1 : 1)); const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date);
const actions = [...R('data/india/corp-actions-history-pre2019.json', []), ...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(uniq, actions, ov), days = toDays(uniq), dates = days.map((d) => d.date), N = dates.length;
const eq = new Set(); for (const d of uniq) for (const [s, r] of Object.entries(d.rows)) if (r[0] === 'EQ') eq.add(s);
const series = buildHistories(days, res.splits, eq).series;
const comp = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) if (v?.[3] > 0) comp[d] = v[3]; }
const ck = Object.keys(comp).sort(); if (ck.length < 1000) throw new Error('index series not found: ' + ck.length);
const compAt = (D) => { let lo = 0, hi = ck.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ck[m] <= D) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
const green = (D) => { const a = compAt(D); if (a < 199) return false; let s = 0; for (let i = a - 199; i <= a; i++) s += comp[ck[i]]; return comp[ck[a]] > s / 200; };
const syms = [...series.keys()];
// per-symbol rolling stats computed on the fly
const t0 = dates.findIndex((d) => d >= FROM); let t1 = N - 2; const tEnd = dates.findLastIndex((d) => d <= TO);
const sig = []; const last = new Map();
const tv20 = (s, t) => { let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] >= 0) { a += s.c[i] * s.v[i]; n++; } return n >= 15 ? a / n : 0; };
for (let t = Math.max(t0, 260); t <= tEnd; t++) {
  const D = dates[t]; if (!green(D)) continue;
  const liq = [], rets = [];
  for (const sym of syms) { const s = series.get(sym); if (!(s.c[t] > 0) || !(s.c[t - 126] > 0)) continue; if (tv20(s, t) < 2e7) continue; liq.push(sym); rets.push(s.c[t] / s.c[t - 126] - 1); }
  if (liq.length < 100) continue;
  const srt = [...rets].sort((a, b) => a - b), cut = srt[Math.floor(srt.length * 0.9)];
  for (let i = 0; i < liq.length; i++) {
    if (rets[i] < cut) continue; const sym = liq[i], s = series.get(sym);
    if (t - (last.get(sym) ?? -1e9) < 126) continue;
    let hi = 0; for (let k = t - 251; k <= t; k++) if (s.c[k] > hi) hi = s.c[k];
    if (s.c[t] < hi) continue;
    let s200 = 0, n200 = 0, v50 = 0, n50 = 0; for (let k = t - 199; k <= t; k++) if (s.c[k] > 0) { s200 += s.c[k]; n200++; } for (let k = t - 50; k < t; k++) if (s.v[k] >= 0) { v50 += s.v[k]; n50++; }
    if (n200 < 180 || s.c[t] <= s200 / n200 || n50 < 40 || !(s.v[t] >= 1.5 * (v50 / n50))) continue;
    const ent = uniq[t + 1]?.rows?.[sym]?.[2]; if (!(ent > 0)) continue;
    last.set(sym, t); sig.push({ sym, t, D, ent, year: D.slice(0, 4) });
  }
}
const out = {};
for (const X of RULES) {
  const tr = sig.map((e) => {
    const s = series.get(e.sym); let hi = e.ent, xo = null, j = e.t + 1;
    for (; j <= Math.min(N - 2, e.t + 781); j++) { if (!(s.c[j] > 0)) continue; if (s.c[j] > hi) hi = s.c[j]; if (s.c[j] <= hi * (1 - X)) { const o = uniq[j + 1]?.rows?.[e.sym]?.[2]; xo = o > 0 ? o : s.c[j]; break; } }
    if (xo == null) { let m = Math.min(N - 1, e.t + 781); while (m > e.t && !(s.c[m] > 0)) m--; xo = s.c[m]; }
    const a = compAt(e.D), b = compAt(dates[Math.min(N - 1, j)]), ben = comp[ck[b]] / comp[ck[a]] - 1;
    return { ...e, r: xo / e.ent - 1 - 0.013, hold: j - e.t, ben };
  });
  const stat = (arr) => { const n = arr.length; if (!n) return { n: 0 }; const r = arr.map((x) => x.r), srt = [...r].sort((a, b) => b - a), tot = r.reduce((a, x) => a + x, 0), med = [...r].sort((a, b) => a - b)[Math.floor(n / 2)]; return { n, mean: tot / n, median: med, win: r.filter((x) => x > 0).length / n, hold: arr.reduce((a, x) => a + x.hold, 0) / n, topShare: srt.slice(0, Math.max(1, Math.round(n * 0.1))).reduce((a, x) => a + x, 0) / tot, meanEx1: n > 1 ? (tot - srt[0]) / (n - 1) : null, meanEx2: n > 2 ? (tot - srt[0] - srt[1]) / (n - 2) : null, bench: arr.reduce((a, x) => a + x.ben, 0) / n, excess: tot / n - arr.reduce((a, x) => a + x.ben, 0) / n }; };
  const years = {}; for (const y of [...new Set(tr.map((x) => x.year))].sort()) years[y] = stat(tr.filter((x) => x.year === y));
  out[X] = { all: stat(tr), years };
}
mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/TREND-LEADERS-${TAG}.json`, JSON.stringify({ from: FROM, to: TO, signals: sig.length, out }));
const pc = (x) => (x == null ? 'n/a' : (x * 100).toFixed(1) + '%');
let md = `# Trend leaders, ${TAG} (${FROM}..${TO})\n\nRule: docs/replay/TREND-LEADERS-PREREG.md. ${sig.length} signals.\n\n| trail | n | mean net | median | winners | hold (sessions) | top-10% profit share | mean ex best | mean ex best 2 | Nifty 500 same periods | excess |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const X of RULES) { const a = out[X].all; md += `| ${X} | ${a.n} | ${pc(a.mean)} | ${pc(a.median)} | ${pc(a.win)} | ${a.hold?.toFixed(0)} | ${pc(a.topShare)} | ${pc(a.meanEx1)} | ${pc(a.meanEx2)} | ${pc(a.bench)} | ${pc(a.excess)} |\n`; }
for (const X of RULES) { md += `\n### Trail ${X} by signal year\n\n| year | n | mean net | median | winners |\n|---|---|---|---|---|\n` + Object.entries(out[X].years).map(([y, a]) => `| ${y} | ${a.n} | ${pc(a.mean)} | ${pc(a.median)} | ${pc(a.win)} |`).join('\n') + '\n'; }
writeFileSync(`${OUT}/TREND-LEADERS-${TAG}.md`, md); console.log(md);
