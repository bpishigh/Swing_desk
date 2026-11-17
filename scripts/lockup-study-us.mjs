// US IPO lock-up expiry event study (U-6; docs/replay/LOCKUP-STUDY-US-PREREG.md). One run, report only. Writes docs/replay/LOCKUP-STUDY-US.md and data/us/lockup-study.json.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const G = (p) => JSON.parse(gunzipSync(readFileSync(p)));
const spy = G('data/us/hist-bench/SPY.json.gz').bars, sIdx = new Map(spy.map((b, i) => [b[0], i]));
const L = 7, A = 4, LOCK = 180, FIRST = '2016-12-01';
const rows = []; let listings = 0, skippedShort = 0;
for (const f of readdirSync('data/us/hist').filter((x) => x.endsWith('.json.gz'))) {
  const sym = f.slice(0, -8), bars = G('data/us/hist/' + f).bars; if (!bars.length || bars[0][0] <= FIRST) continue; listings++;
  const d = bars.map((b) => b[0]), c = bars.map((b) => b[1]); if (bars.length < 260) { skippedShort++; continue; }
  const centre = new Date(Date.parse(d[0]) + LOCK * 864e5).toISOString().slice(0, 10); let k = d.findIndex((x) => x >= centre); if (k < 0 || k + A >= d.length || k - L - 1 < 1) continue;
  const a = k - L - 1, b = k + A, r = c[b] / c[a] - 1, pre = c[k - 1] / c[a] - 1, post = c[b] / c[k - 1] - 1;
  const ret = (i, j) => c[j] / c[i] - 1, ws = []; for (let s = 20; s + L + A + 1 < d.length; s += L + A + 1) { if (s + L + A + 1 >= a && s <= b) continue; ws.push(ret(s, s + L + A + 1)); }
  const base = ws.length >= 3 ? ws.reduce((x, y) => x + y, 0) / ws.length : null;
  const i1 = sIdx.get(d[a]), i2 = sIdx.get(d[b]), vs = i1 != null && i2 != null ? r - (spy[i2][1] / spy[i1][1] - 1) : null;
  rows.push({ sym, listed: d[0], r, pre, post, ex: base == null ? null : r - base, vs });
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null), med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; }, P = (v) => (v == null ? 'n/a' : (v * 100).toFixed(1) + '%');
const groups = [['All listings', () => true], ['Listed 2017 to 2020', (x) => x.listed < '2021-01-01'], ['Listed 2021 onward', (x) => x.listed >= '2021-01-01']];
const out = { run: new Date().toISOString().slice(0, 10), listings, skippedShort, groups: {} };
for (const [n, f] of groups) { const g = rows.filter(f), ex = g.filter((x) => x.ex != null), vs = g.filter((x) => x.vs != null); out.groups[n] = { n: g.length, mean: mean(g.map((x) => x.r)), median: med(g.map((x) => x.r)), negShare: g.filter((x) => x.r < 0).length / Math.max(1, g.length), meanPre7: mean(g.map((x) => x.pre)), meanPost4: mean(g.map((x) => x.post)), nEx: ex.length, meanEx: mean(ex.map((x) => x.ex)), nVs: vs.length, meanVsSpy: mean(vs.map((x) => x.vs)) }; }
writeFileSync('data/us/lockup-study.json', JSON.stringify(out, null, 1) + '\n');
const md = ['# US IPO lock-up expiry event study (U-6)', '', `Run ${out.run}. One run, registered before it ran (LOCKUP-STUDY-US-PREREG.md), report only. Paper only; not a financial adviser.`, '', `${listings} listings found; ${skippedShort} skipped for fewer than 260 sessions. Window: 7 sessions before to 4 after the session 180 calendar days after listing.`, '', '| Group | n | Mean window return | Median | Share negative | Mean 7 sessions before | Mean 4 sessions after | Mean vs own average | Mean vs SPY |', '|---|---|---|---|---|---|---|---|---|',
  ...Object.entries(out.groups).map(([n, g]) => `| ${n} | ${g.n} | ${P(g.mean)} | ${P(g.median)} | ${P(g.negShare)} | ${P(g.meanPre7)} | ${P(g.meanPost4)} | ${P(g.meanEx)} | ${P(g.meanVsSpy)} |`), '',
  '**Limits.** Survivor bias (all stored US symbols are still trading, so failed IPOs are absent, flattering every group); first appearances include spin-offs, SPAC mergers and ticker changes; 180 days is a proxy for the real prospectus date; the window can contain an earnings reaction; the 2021 to 2022 IPO boom and crash sit in the later group. A mean under about 1 percentage point is within noise.'];
writeFileSync('docs/replay/LOCKUP-STUDY-US.md', md.join('\n') + '\n'); console.log(md.slice(4).join('\n'));
