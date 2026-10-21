// Clears the liquid unexplained India price breaks (those the corporate-action list cannot explain) with RULES written before applying them, not case by case.
// Reads data/india/audit/actions-audit.json and the stored bhav history; writes data/india/corp-action-overrides-hist.json (used by the audit, the as-of view and the India scan,
// NOT by the live nightly store, whose averages stay conservative). Every entry says which rule produced it and that no announcement was checked.
// Rules, in order, for a break in a stock that traded at least Rs 5 crore a day on average over the 20 sessions before:
//   R1  the audit already calls it a clean 1/n price break and the step is within 5% of 1/n for a whole n >= 2: split, factor 1/n (derived).
//   R2  the corporate-action list says demerger (no ratio), or the break is the Tata Motors demerger of 14 Oct 2025 the list lacks: factor = the observed ex-date price ratio (derived; the day's market move is not removed).
//   R3  the list gave a ratio that does not match the price move and ten-session median volume rose to at least 2x: split or bonus stacked on others; factor = observed ratio (derived).
//   R4  a one-day fall to between 60% and 100% of the prior close with no action on the list, or a rights-entitlement ticker (-RE): genuine move, history kept (ignore). Hiding a real fall would flatter every test.
//   Anything else stays unresolved and is listed for the owner.
// Usage: node --max-old-space-size=6000 scripts/derive-india-overrides.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const audit = JSON.parse(readFileSync('data/india/audit/actions-audit.json'));
const days = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) days.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) days.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
days.sort((a, b) => (a.date < b.date ? -1 : 1)); const ix = new Map(days.map((d, i) => [d.date, i]));
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const MANUAL = {
  'YESBANK|2020-03-06': { ignore: true, note: 'MANUAL: genuine 56% fall on 6 Mar 2020, the RBI moratorium on Yes Bank (widely reported); no corporate action' },
  // Typed 17 Oct 2026 (web sources); each ratio cross-checked against the observed price move before use.
  'MAJESCO|2020-12-23': { factor: 0.0124, note: 'MANUAL (typed override, 17 Oct 2026): special dividend of Rs 974 a share, ex-date 23 Dec 2020 (sale of the US subsidiary); history adjusted as a cash distribution, factor = observed ex-date ratio 0.0124' },
  'INFIBEAM|2021-03-18': { factor: 0.5, note: 'MANUAL (typed override, 17 Oct 2026): 1:1 bonus, ex-date 18 Mar 2021; factor 1/2. Observed ratio 0.4282, the remaining 14% is that day\'s genuine fall and stays in the history' },
  'AJANTPHARM|2022-06-22': { factor: 2 / 3, note: 'MANUAL (typed override, 17 Oct 2026): 1:2 bonus, ex-date 22 Jun 2022; factor 2/3. Observed ratio 0.6599' },
  'HEG|2026-09-07': { factor: 0.3738, note: 'MANUAL (typed override, 17 Oct 2026): demerger of the graphite business into HEG Graphite, 1:1, record date 7 Sep 2026; factor = observed ex-date ratio 0.3738 (the day\'s market move is not removed)' },
};
const out = { ...MANUAL }, left = []; const counts = { R1: 0, R2: 0, R3: 0, R4: 0, left: 0, illiquid: 0 };
for (const u of audit.unresolvedList) {
  const i = ix.get(u.date); if (!i) continue;
  let v = 0, n = 0; for (let k = Math.max(0, i - 20); k < i; k++) { const r = days[k].rows[u.symbol]; if (r && r[5] > 0 && r[6] > 0) { v += r[5] * r[6]; n++; } }
  if (!n || v / n / 1e7 < 5) { counts.illiquid++; continue; }
  const vb = [], va = []; for (let k = i - 10; k < i; k++) { const r = days[k]?.rows[u.symbol]; if (r && r[6] > 0) vb.push(r[6]); } for (let k = i + 1; k <= i + 10; k++) { const r = days[k]?.rows[u.symbol]; if (r && r[6] > 0) va.push(r[6]); }
  if (MANUAL[`${u.symbol}|${u.date}`]) continue;
  const volx = med(va) / med(vb), key = `${u.symbol}|${u.date}`, ratio = u.ratio, inv = 1 / ratio, nn = Math.round(inv);
  const put = (rule, e) => { out[key] = { ...e, note: `${rule}: ${e.note}; no announcement checked (derived by rule, scripts/derive-india-overrides.mjs)` }; counts[rule]++; };
  if (/clean 1\/n/.test(u.reason) && nn >= 2 && Math.abs(inv / nn - 1) <= 0.05) put('R1', { factor: +(1 / nn).toFixed(6), derived: true, note: `split 1:${nn} (price step ${ratio})` });
  else if (/^demerger/.test(u.reason) || key === 'TATAMOTORS|2025-10-14') put('R2', { factor: ratio, derived: true, note: `demerger, observed ex-date price ratio ${ratio}` });
  else if (/does not match/.test(u.reason) && volx >= 2) put('R3', { factor: ratio, derived: true, note: `split or bonus, list ratio differs; volume x${volx.toFixed(1)}; observed ratio ${ratio}` });
  else if ((/no action on the list for a large move|only a cash action/.test(u.reason) && ratio >= 0.6) || /-RE$/.test(u.symbol)) put('R4', { ignore: true, note: `genuine one-day move to ${ratio} of the prior close` });
  else { counts.left++; left.push(`${key} ratio ${ratio} volume x${volx.toFixed(2)} ${u.reason}`); }
}
writeFileSync('data/india/corp-action-overrides-hist.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(counts)); console.log(left.join('\n'));
