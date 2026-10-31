// C-122: clears the LIQUID unresolved India price breaks dated before 2020-02-01 with rules R1-R4 of scripts/derive-india-overrides.mjs, unchanged, plus R5 (the list gives no ratio, price step within 5% of 1/n for a whole n >= 2, ten-session median volume rose by at least max(1.5, n/3)). Adds entries to data/india/corp-action-overrides-hist.json under new keys; touches nothing dated 2020 or later.
// Liquid = 20-session average traded value (close x volume) of at least Rs 5 crore before the break. No announcement is checked. Leftovers are listed in data/replay/c122-overrides.json.
// Usage: node --max-old-space-size=8000 scripts/derive-india-overrides-pre2020.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { loadIndia } from '../src/backtest/india-loader.ts';
const DRY = process.argv.includes('--dry'), OVF = 'data/india/corp-action-overrides-hist.json';
const D = loadIndia('data/india', { pre2020: true, allSymbols: true, to: '2020-01-31' });
const ix = new Map(D.days.map((d, i) => [d.date, i])), cache = new Map(), rows = (i) => cache.get(i) ?? (cache.set(i, new Map(D.days[i].rows.map((r) => [r[0], r]))), cache.get(i));
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const existing = JSON.parse(readFileSync(OVF, 'utf8')), out = {}, left = [], counts = { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, left: 0, illiquid: 0, already: 0 };
const before = D.res.counts;
for (const u of D.res.dropped) {
  const i = ix.get(u.date); if (!i || u.date >= '2020-02-01') continue; const key = `${u.symbol}|${u.date}`; if (existing[key]) { counts.already++; continue; }
  let v = 0, n = 0; for (let k = Math.max(0, i - 20); k < i; k++) { const r = rows(k).get(u.symbol); if (r && r[1] > 0 && r[4] > 0) { v += r[1] * r[4]; n++; } }
  if (!n || v / n < 5e7) { counts.illiquid++; continue; }
  const pr = rows(i - 1).get(u.symbol), cr = rows(i).get(u.symbol), ratio = pr && cr ? +(cr[1] / pr[1]).toFixed(4) : NaN;
  const vb = [], va = []; for (let k = i - 10; k < i; k++) { const r = rows(k).get(u.symbol); if (r && r[4] > 0) vb.push(r[4]); } for (let k = i + 1; k <= i + 10; k++) { const r = rows(k)?.get(u.symbol); if (r && r[4] > 0) va.push(r[4]); }
  const volx = med(va) / med(vb), inv = 1 / ratio, nn = Math.round(inv);
  const put = (rule, e) => { out[key] = { ...e, note: `${rule}: ${e.note}; no announcement checked (derived by rule, scripts/derive-india-overrides-pre2020.mjs, C-122)` }; counts[rule]++; };
  if (/clean \d+\/n|clean #\/n|clean 1\/n/.test(u.why) && nn >= 2 && Math.abs(inv / nn - 1) <= 0.05) put('R1', { factor: +(1 / nn).toFixed(6), derived: true, note: `split 1:${nn} (price step ${ratio})` });
  else if (/^demerger/.test(u.why)) put('R2', { factor: ratio, derived: true, note: `demerger, observed ex-date price ratio ${ratio}` });
  else if (/does not match/.test(u.why) && volx >= 2) put('R3', { factor: ratio, derived: true, note: `split or bonus, list ratio differs; volume x${volx.toFixed(1)}; observed ratio ${ratio}` });
  else if ((/no action on the list for a large move|only a cash action/.test(u.why) && ratio >= 0.6) || /-RE$/.test(u.symbol)) put('R4', { ignore: true, note: `genuine one-day move to ${ratio} of the prior close` });
  else if (/^other: the list gives no price ratio/.test(u.why) && nn >= 2 && Math.abs(inv / nn - 1) <= 0.05 && volx >= Math.max(1.5, nn / 3)) put('R5', { factor: +(1 / nn).toFixed(6), derived: true, note: `split 1:${nn}, list gives no ratio (price step ${ratio}, volume x${volx.toFixed(1)})` });
  else { counts.left++; left.push({ key, ratio, volx: +volx.toFixed(2), avgCrore: +(v / n / 1e7).toFixed(1), why: u.why }); }
}
writeFileSync('data/replay/c122-overrides.json', JSON.stringify({ run: new Date().toISOString().slice(0, 10), beforeCounts: before, counts, left }, null, 1) + '\n');
if (!DRY) writeFileSync(OVF, JSON.stringify({ ...existing, ...out }, null, 1) + '\n');
console.log(JSON.stringify({ before, counts })); console.log(left.map((l) => `${l.key} ratio ${l.ratio} vol x${l.volx} Rs${l.avgCrore}cr ${l.why.slice(0, 50)}`).join('\n'));
