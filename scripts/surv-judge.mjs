// 18a forward judging (C-208): from each stored surveillance snapshot, the next-20-session return of top-500 names on each list against the other top-500 names. Counts shown; no pass or kill line. Unadjusted closes (a split inside 20 sessions would distort one name; noted).
// Usage: node scripts/surv-judge.mjs   (writes docs/replay/SURV-FORWARD.md; safe to run any day)
import fs from 'node:fs';
const R = (p) => JSON.parse(fs.readFileSync(p, 'utf8')), H = 20;
const files = fs.readdirSync('data/india/bhav').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort(), days = files.map((f) => R('data/india/bhav/' + f)), dates = days.map((d) => d.date);
const snaps = fs.existsSync('data/india/surveillance') ? fs.readdirSync('data/india/surveillance').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort() : [];
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const LISTS = ['asmLong', 'asmShort', 'gsm', 'esm'], acc = Object.fromEntries(LISTS.map((k) => [k, { snaps: 0, flagged: [], other: [] }]));
let usable = 0, first = null;
for (const f of snaps) {
  const sd = f.slice(0, 10), t = dates.filter((d) => d <= sd).length - 1; if (t < 19 || t + H >= dates.length) continue;   // snapshot date is the fetch day; use the latest session on or before it
  usable++; first ??= dates[t];
  const tv = {}; for (let i = t - 19; i <= t; i++) for (const [s, r] of Object.entries(days[i].rows)) (tv[s] ??= []).push(r[5] * r[6]);
  const top = new Set(Object.entries(tv).filter(([, a]) => a.length >= 15).map(([s, a]) => [s, med(a)]).sort((a, b) => b[1] - a[1]).slice(0, 500).map(([s]) => s));
  const ret = (s) => { const a = days[t].rows[s]?.[5], b = days[t + H].rows[s]?.[5]; return a > 0 && b > 0 ? b / a - 1 : null; };
  const sv = R('data/india/surveillance/' + f);
  for (const k of LISTS) { const on = new Set(sv[k].map((r) => r.symbol)); acc[k].snaps++; for (const s of top) { const r = ret(s); if (r == null) continue; (on.has(s) ? acc[k].flagged : acc[k].other).push(r); } }
}
const m = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null), p = (x) => (x == null ? 'n/a' : (x * 100).toFixed(1) + '%');
const L = [`# Surveillance lists, forward read (18a, C-208)`, ``, `Run ${new Date().toISOString().slice(0, 10)}. Information only: no pass or kill line. Snapshots stored: ${snaps.length}; snapshots with 20 later sessions available: ${usable}${first ? ' (first ' + first + ')' : ''}. Paper only; not a financial adviser.`, ``];
if (!usable) L.push(`Not readable yet: the first snapshot (14 Nov 2026) needs 20 further sessions, so the first read is about 14 Dec 2026.`, ``);
else { L.push(`Next-20-session price return, top-500 names on each list against the other top-500 names. Observations overlap across snapshots, so counts overstate independent evidence.`, ``, `| List | Snapshots | Flagged observations | Flagged mean | Other observations | Other mean |`, `|---|---|---|---|---|---|`); for (const k of LISTS) L.push(`| ${k} | ${acc[k].snaps} | ${acc[k].flagged.length} | ${p(m(acc[k].flagged))} | ${acc[k].other.length} | ${p(m(acc[k].other))} |`); }
fs.writeFileSync('docs/replay/SURV-FORWARD.md', L.join('\n') + '\n'); console.log(L.join('\n'));
