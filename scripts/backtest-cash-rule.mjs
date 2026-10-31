// C-120: the 200-session cash rule on its own, India (Nifty 500, BSE 500 stand-in) and US (SPY). One run, no tuning. Usage: node scripts/backtest-cash-rule.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spliceIndex, above200 } from '../src/backtest/index-splice.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const nifty = {}, bse = {};
for (let y = 2010; y <= 2025; y++) { let o; try { o = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(o['Nifty 500'] ?? {})) nifty[d] = v[3]; for (const [d, v] of Object.entries(o['BSE 500'] ?? {})) bse[d] = v[3]; }
const idates = [...new Set([...Object.keys(nifty), ...Object.keys(bse)])].sort();
const sp = spliceIndex(idates, nifty, bse);
const spy = JSON.parse(gunzipSync(readFileSync('data/us/hist-bench/SPY.json.gz')).toString()).bars;
const sdates = spy.map((b) => b[0]), sv = Float64Array.from(spy.map((b) => b[1]));
function run(name, dates, v, start, end, cost, cashRate) {
  const S = []; for (let i = 1; i < dates.length; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= start && dates[i] <= end && i >= 199 && v[i] > 0) S.push(i);
  const ent = S.map((t) => t + 1), on = S.map((t) => above200(v, t)), first = ent[0];
  let last = first; while (last + 1 < dates.length && dates[last + 1] <= end && v[last + 1] > 0) last++;
  let eq = 1, bh = 1, k = 0, prevOn = null, switches = 0, daysOn = 0, peak = 1, bpeak = 1, mdd = 0, bmdd = 0; const yr = {};
  for (let i = first + 1; i <= last; i++) {
    while (k + 1 < ent.length && ent[k + 1] < i) k++;   // state k applies to sessions after entry k, up to and including entry k+1
    const isOn = on[k], r = v[i] / v[i - 1] - 1, y = dates[i].slice(0, 4);
    if (prevOn !== null && isOn !== prevOn && i === ent[k] + 1) { eq *= 1 - cost; switches++; }
    prevOn = isOn; const dr = isOn ? r : cashRate / 252; if (isOn) daysOn++;
    eq *= 1 + dr; bh *= 1 + r; peak = Math.max(peak, eq); bpeak = Math.max(bpeak, bh); mdd = Math.min(mdd, eq / peak - 1); bmdd = Math.min(bmdd, bh / bpeak - 1);
    (yr[y] ??= { e: 1, b: 1 }); yr[y].e *= 1 + dr; yr[y].b *= 1 + r;
  }
  const n = last - first, years = Object.entries(yr).map(([y, o]) => ({ y, rule: o.e - 1, bh: o.b - 1 }));
  return { name, from: dates[first], to: dates[last], months: S.length, switches, shareInIndex: daysOn / n, rule: eq - 1, buyHold: bh - 1, ratio: (eq) / (bh), ruleMaxFall: mdd, buyHoldMaxFall: bmdd, fallCut: 1 - mdd / bmdd, years: years.map((o) => ({ ...o, within3: o.rule - o.bh >= -0.03 })) };
}
const crit = (r) => ({ fallCutAtLeastThird: r.fallCut >= 1 / 3, returnAtLeast80pct: r.rule + 1 >= 0.8 * (r.buyHold + 1), halfOfYearsWithin3: r.years.filter((o) => o.within3).length >= r.years.length / 2 });
const out = { run: new Date().toISOString().slice(0, 10), indexSource: { nifty: sp.fromNifty, bse: sp.fromBse, missing: sp.missing }, markets: {} };
for (const [m, args, cash] of [['india', [idates, sp.values, '2011-01-01', '2025-10-31', 0.001], [0, 0.05]], ['us', [sdates, sv, '2018-01-01', '2025-10-31', 0.0002], [0, 0.03]]]) {
  const r = run(m, ...args, cash[0]), r2 = run(m + '-cash-side', ...args, cash[1]); r.criteria = crit(r); r.pass = Object.values(r.criteria).every(Boolean); r.cashSide = { rule: r2.rule, ratio: r2.ratio }; out.markets[m] = r;
}
out.pass = Object.values(out.markets).every((r) => r.pass);
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/c120-cash.json', JSON.stringify(out, null, 1) + '\n');
const f = (x) => (x * 100).toFixed(1) + '%';
let md = '# C-120: the 200-day cash rule on its own\n\nPrice-only index returns; cash earns 0%. Same dates for rule and buy-and-hold.\n\n';
for (const r of Object.values(out.markets)) md += `## ${r.name} ${r.from} to ${r.to}\n- Rule ${f(r.rule)} vs buy-and-hold ${f(r.buyHold)}; in the index ${f(r.shareInIndex)} of sessions; ${r.switches} switches\n- Worst fall: rule ${f(r.ruleMaxFall)} vs buy-and-hold ${f(r.buyHoldMaxFall)} (cut ${f(r.fallCut)})\n- Years within 3 points or better: ${r.years.filter((o) => o.within3).length} of ${r.years.length}\n- Conditions: ${JSON.stringify(r.criteria)} -> ${r.pass ? 'PASS' : 'FAIL'}\n- Side note, cash earning interest: rule ${f(r.cashSide.rule)}\n- By year (rule / buy-and-hold): ${r.years.map((o) => `${o.y} ${f(o.rule)}/${f(o.bh)}`).join(', ')}\n\n`;
md += `Overall: ${out.pass ? 'PASS' : 'FAIL'} (needs both markets).\n`; writeFileSync('docs/replay/C120-REPORT.md', md);
console.log(md);
