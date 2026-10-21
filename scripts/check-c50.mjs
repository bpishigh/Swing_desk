// C-50 pass criteria: coverage, method check against typed records, no side effects, branch list.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stockVerdict, adjustSeries } from '../src/pm/verdict.ts';
import { stockVerdict as oldVerdict } from './ref/verdict-before-c50.ts';
const dir = 'site/pm-data/prices/'; const months = JSON.parse(readFileSync(dir + 'index.json', 'utf8'));
const dates = [], px = {};
for (const m of months) { const c = JSON.parse(readFileSync(dir + m + '.json', 'utf8')); const b = dates.length; dates.push(...c.dates); for (const [s, a] of Object.entries(c.px)) { const arr = (px[s] ??= []); while (arr.length < b) arr.push(null); arr.push(...a); } }
const dem = JSON.parse(readFileSync(existsSync('portfolio/rules/demergers.json') ? 'portfolio/rules/demergers.json' : 'data/rules/demergers.json', 'utf8')).records;
const f = JSON.parse(readFileSync('data/india/corp-actions-history.json', 'utf8')); const rows = Array.isArray(f) ? f : f.rows;
const hist = { dates, px }; const N = dates.length; const from = dates[Math.max(0, N - 300)];
let total = 0, oldBlocked = 0, newBlocked = 0, changed = [], same = 0; const branches = [];
for (const s of Object.keys(px)) {
  if (px[s][N - 1] == null) continue; total++;
  const o = oldVerdict(s, hist, rows, dem), n = stockVerdict(s, hist, rows, dem);
  const ob = o.label === 'No verdict' && /corporate action/.test(o.reasons[0]), nb = n.label === 'No verdict' && /corporate action/.test(n.reasons[0]);
  if (ob) oldBlocked++; if (nb) newBlocked++;
  const a = adjustSeries(dates, px[s], rows.filter((r) => r.symbol === s), from, dem);
  const touched = a.estimated.length + a.truncated.length > 0;
  if (touched) branches.push({ s, branch: a.estimated.length ? 'a (adjusted from price, fell ' + ((1 - 1 / a.estimated[0].factor) * 100).toFixed(0) + '%)' : 'b (history cut)', old: o.label, new: n.label });
  if (o.label === n.label && o.close === n.close && o.sma200 === n.sma200 && o.below200 === n.below200 && o.belowSwing === n.belowSwing) same++; else if (!touched) changed.push(s);
}
// method check: observed-ratio factor vs typed factor, for typed records that pass the price check
const diffs = [];
for (const r of dem) {
  if (r.feed === false) continue; const i = dates.findIndex((d) => d >= r.exDate), a = px[r.parent]; if (!a || i < 1 || a[i] == null || a[i - 1] == null) continue;
  const typed = 1 / (1 - r.costPct), obs = a[i - 1] / a[i]; const pass = Math.abs(Math.log(a[i] / (a[i - 1] / typed))) <= Math.min(Math.log(1.25), 0.5 * Math.log(typed));
  diffs.push({ parent: r.parent, typedDrop: +(1 - 1 / typed).toFixed(3), observedDrop: +(1 - 1 / obs).toFixed(3), diffPts: +(Math.abs((1 - 1 / typed) - (1 - 1 / obs)) * 100).toFixed(1), passesPriceCheck: pass, breakAtLeast15: 1 - 1 / obs >= 0.15 });
}
const used = diffs.filter((d) => d.passesPriceCheck && d.breakAtLeast15).map((d) => d.diffPts).sort((x, y) => x - y);
const med = used.length ? used[Math.floor(used.length / 2)] : null, mx = used.length ? used[used.length - 1] : null;
const out = { total, oldBlocked, newBlocked, unchangedEverywhere: same, changedOutsideAffected: changed, branches, methodCheck: { diffs, medianDiffPts: med, maxDiffPts: mx } };
writeFileSync('data/replay/c50-check.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({ total, oldBlocked, newBlocked, changedOutsideAffected: changed, affected: branches.length, medianDiffPts: med, maxDiffPts: mx }, null, 1)); console.table(branches); console.table(diffs);
