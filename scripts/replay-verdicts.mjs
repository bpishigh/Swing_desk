// Replay of the Legacy exit test on stored closes (Engine Rules change log C-41 to C-43). Reproducible from a commit: reads only files in the repo.
// Usage: node scripts/replay-verdicts.mjs [--step=5] [--out=data/replay]
// Writes <out>/replay-<last stored date>.json and docs/replay/BASELINE-<date>.md. No personal data is read.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { stockVerdict, adjustSeries } from '../src/pm/verdict.ts';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const TAG = arg('tag', ''), STEP = +arg('step', 5), OUT = arg('out', 'data/replay'), T0 = 210, HS = [20, 60];
const dir = 'site/pm-data/prices/';
const months = JSON.parse(readFileSync(dir + 'index.json', 'utf8'));
const dates = [], px = {};
for (const m of months) { const c = JSON.parse(readFileSync(dir + m + '.json', 'utf8')); const base = dates.length; dates.push(...c.dates); for (const [s, a] of Object.entries(c.px)) { const arr = (px[s] ??= []); while (arr.length < base) arr.push(null); arr.push(...a); } }
for (const s in px) while (px[s].length < dates.length) px[s].push(null);
const N = dates.length, ASOF = dates[N - 1];
const feedRaw = JSON.parse(readFileSync('data/india/corp-actions-history.json', 'utf8')); const rows = Array.isArray(feedRaw) ? feedRaw : feedRaw.rows;
const ADJ = /\b(split|sub-?division|bonus|demerger|de-merger|arrangement|consolidation|capital reduction|scheme)\b/i;   // same list as src/pm/verdict.ts
const firstIdx = (d) => { let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] >= d) hi = m; else lo = m + 1; } return lo; };
// Back-adjust every symbol's closes for plain splits and bonuses that the stored prices confirm (src/pm/verdict.ts adjustSeries); only actions that cannot be adjusted keep the guard.
const bySym = new Map(); for (const r of rows) if (ADJ.test(r.subject)) (bySym.get(r.symbol) ?? bySym.set(r.symbol, []).get(r.symbol)).push(r);
const rawPx = { ...px };   // unadjusted, for the parity check against the module (which adjusts for itself)
const ca = new Map(); let adjustedN = 0; const rejectedAdj = [];
for (const [sym, rs] of bySym) { if (!px[sym]) continue; const a = adjustSeries(dates, px[sym], rs, dates[0]); px[sym] = a.series; adjustedN += a.applied.length; rejectedAdj.push(...a.rejected.map((r) => ({ symbol: sym, exDate: r.rows[0].exDate, factor: +r.factor.toFixed(2), observed: r.observed === null ? null : +r.observed.toFixed(2), subjects: r.rows.map((x) => x.subject.trim()) }))); if (a.unresolved.length) ca.set(sym, a.unresolved.map((r) => firstIdx(r.exDate)).filter((i) => i < N)); }
const cur = new Set(Object.keys(JSON.parse(readFileSync('site/pm-data/prices.json', 'utf8')).prices));
const n500 = new Set(JSON.parse(readFileSync('data/india/nifty500.json', 'utf8')).symbols);
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pct = (a, p) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const sma = (arr, t, len) => { if (t < len - 1) return null; let s = 0; for (let i = t - len + 1; i <= t; i++) { const v = arr[i]; if (v == null) return null; s += v; } return s / len; };
const atr = (arr, k) => { let s = 0, n = 0; for (let m = k - 13; m <= k; m++) if (m >= 1 && arr[m] != null && arr[m - 1] != null) { s += Math.abs(arr[m] - arr[m - 1]); n++; } return n ? s / n : NaN; };   // close-to-close proxy: no highs or lows before Oct 2025
const isLow = (arr, i) => { const c = arr[i]; if (c == null) return false; for (let j = i - 10; j <= i + 10; j++) { const v = arr[j]; if (j !== i && v != null && v < c) return false; } return true; };
const isHigh = (arr, i) => { const c = arr[i]; if (c == null) return false; for (let j = i - 10; j <= i + 10; j++) { const v = arr[j]; if (j !== i && v != null && v > c) return false; } return true; };
const pivotLowIdx = (arr, t) => { for (let i = t - 10; i >= 10; i--) if (isLow(arr, i)) return i; return -1; };
const priorHigh = (arr, i) => { for (let j = i - 1; j >= 10; j--) if (isHigh(arr, j)) return arr[j]; return null; };
const guarded = (sym, t, fwd = 0) => (ca.get(sym) ?? []).some((i) => i >= Math.max(0, t + 1 - 300) && i <= t + fwd);
function group(sym, t, fwd = 0) {
  const arr = px[sym]; const c = arr[t]; if (c == null || guarded(sym, t, fwd)) return null;
  const s = sma(arr, t, 200), pi = pivotLowIdx(arr, t), sw = pi < 0 ? null : arr[pi], bsw = sw !== null && c < sw;
  if (s === null) return bsw ? { g: 'Swing only (no 200-day yet)', s200: NaN, sw, pi } : null;
  const b200 = c < s; return { g: b200 && bsw ? 'Both' : b200 ? '200 only' : bsw ? 'Swing only' : 'Keep', s200: s, sw, pi };
}
// market proxy: index of the median daily move of Nifty 500 stocks (index history before Dec 2025 is not stored); Red = below both its 50 and 200 day averages
const proxy = [100]; for (let t = 1; t < N; t++) { const r = []; for (const s of n500) { const a = px[s]; if (a && a[t] != null && a[t - 1] != null) { const x = a[t] / a[t - 1] - 1; if (Math.abs(x) < 0.4) r.push(x); } } proxy.push(proxy[t - 1] * (1 + (med(r) || 0))); }
const red = (t) => { const a = sma(proxy, t, 50), b = sma(proxy, t, 200); return a !== null && b !== null && proxy[t] < a && proxy[t] < b; };

const result = { asOf: ASOF, firstDate: dates[0], sessions: N, step: STEP, firstStart: dates[T0], universe: 'symbols with a stored close on the start date', proxy: 'median Nifty 500 stock; Red = its cumulative index below both its 50 and 200 day averages', atr: 'mean absolute close-to-close move over 14 sessions', preregistered: 'C-42 and C-43 in the Engine Rules change log, written before the first run of this script' };
// ---- parity with the module at the latest date
{ let diff = 0, n = 0; for (const s of Object.keys(px)) { if (px[s][N - 1] == null) continue; const v = stockVerdict(s, { dates, px: rawPx }, rows); const g = group(s, N - 1); const mine = g ? (g.g === 'Keep' ? 'Keep' : 'Exit') : 'No verdict'; n++; if (mine !== v.label) diff++; } result.parity = { symbols: n, identical: n - diff }; }
// ---- cross-section at the latest date
{
  const t = N - 1, universe = [...cur].filter((s) => px[s]), rs = {}, all = [];
  for (const s of universe) { const a = px[s]; if (a[t] != null && a[t - 63] != null) all.push([s, a[t] / a[t - 63] - 1]); }
  all.sort((x, y) => x[1] - y[1]); all.forEach(([s], i) => (rs[s] = (i / (all.length - 1)) * 100));
  const out = {}; const GS = ['Both', '200 only', 'Swing only', 'Swing only (no 200-day yet)', 'Keep'];
  for (const g of GS) out[g] = { n: 0, nifty500: 0, d: [], r: [] };
  let none = 0, ca_ = 0;
  for (const s of universe) { const a = px[s]; if (a[t] == null) continue; if (guarded(s, t)) { ca_++; continue; } const x = group(s, t); if (!x) { none++; continue; } const o = out[x.g]; o.n++; if (n500.has(s)) o.nifty500++; if (!isNaN(x.s200)) o.d.push((a[t] / x.s200 - 1) * 100); if (rs[s] !== undefined) o.r.push(rs[s]); }
  result.crossSection = { date: dates[t], stocks: universe.length, noVerdictCorporateAction: ca_, noVerdictOther: none, groups: Object.fromEntries(GS.map((g) => [g, { stocks: out[g].n, nifty500: out[g].nifty500, medianPctFrom200: +med(out[g].d).toFixed(1), medianRsPercentile: +med(out[g].r).toFixed(0) }])) };
}
// ---- replay
const ts = []; for (let t = T0; t <= N - 21; t += STEP) ts.push(t);
const recs = { 20: [], 60: [] }, removed = { 20: 0, 60: 0 }, kept = { 20: 0, 60: 0 };
for (const H of HS) {
  for (const t of ts) {
    if (t + H > N - 1) break; const obs = [], R = red(t) ? 1 : 0, yr = +dates[t].slice(0, 4);
    for (const s of Object.keys(px)) {
      const a = px[s]; if (a[t] == null || a[t + H] == null) continue; const x = group(s, t, H);
      if (!x || x.g === 'Swing only (no 200-day yet)') { if (!x && guarded(s, t, H) && sma(a, t, 200) !== null) removed[H]++; continue; }
      kept[H]++; const ret = a[t + H] / a[t] - 1; const labels = [x.g];
      if (x.g === '200 only') { const gap = x.s200 - a[t], A = atr(a, t); labels.push(gap <= A ? '200 only: near (within 1 ATR)' : a[t] / x.s200 - 1 >= -0.03 ? '200 only: mid (1 ATR to 3%)' : '200 only: far (beyond both)'); }
      if (x.g === 'Swing only') { const ph = priorHigh(a, x.pi), A = atr(a, x.pi); labels.push(ph === null || isNaN(A) ? 'Swing only: no prior pivot high' : ph - x.sw >= 1.5 * A ? 'Swing only: deep (1.5 ATR)' : 'Swing only: shallow'); }
      const y = group(s, t + H); obs.push({ s, labels, ret, back: y && y.g === 'Keep' ? 1 : 0, hasBack: y ? 1 : 0 });
    }
    const m500 = med(obs.filter((o) => n500.has(o.s)).map((o) => o.ret)); if (isNaN(m500)) continue;
    for (const o of obs) for (const l of o.labels) recs[H].push({ l, ex: (o.ret - m500) * 100, back: o.back, hb: o.hasBack, red: R, yr });
  }
}
const stats = (rs) => ({ n: rs.length, medianExcess: +med(rs.map((r) => r.ex)).toFixed(2), meanExcess: +mean(rs.map((r) => r.ex)).toFixed(2), p10Excess: +pct(rs.map((r) => r.ex), 0.1).toFixed(2), backToKeepPct: +((rs.reduce((a, r) => a + r.back, 0) / Math.max(1, rs.reduce((a, r) => a + r.hb, 0))) * 100).toFixed(1) });
const LABELS = ['Both', '200 only', '200 only: near (within 1 ATR)', '200 only: mid (1 ATR to 3%)', '200 only: far (beyond both)', 'Swing only', 'Swing only: deep (1.5 ATR)', 'Swing only: shallow', 'Swing only: no prior pivot high', 'Keep'];
result.replay = { kept, removedByCorporateActionGuard: removed, byHorizon: {} };
const by = (H, l, f = () => true) => recs[H].filter((r) => r.l === l && f(r));
for (const H of HS) result.replay.byHorizon[H] = Object.fromEntries(LABELS.map((l) => [l, { all: stats(by(H, l)), redOnly: stats(by(H, l, (r) => r.red === 1)), byYear: Object.fromEntries([2022, 2023, 2024, 2025, 2026].map((y) => [y, stats(by(H, l, (r) => r.yr === y))])) }]));
// ---- pre-registered tests (C-42, C-43). A calendar year counts only with at least 100 observations in the cell.
const MIN = 100, YEARS = [2022, 2023, 2024, 2025];
const cell = (H, l, y, redOnly) => stats(by(H, l, (r) => (y ? r.yr === y : true) && (redOnly ? r.red === 1 : true)));
const c42 = (band) => { const test = (y) => { const b60 = cell(60, band, y), b20 = cell(20, band, y), g60 = cell(60, 'Both', y), g20 = cell(20, 'Both', y); if (b60.n < MIN || b20.n < MIN) return { ok: false, thin: true }; const back = b20.backToKeepPct >= 2 * g20.backToKeepPct, ex = b60.medianExcess - g60.medianExcess >= 1; return { ok: back && ex, back, ex, backPct: [b20.backToKeepPct, g20.backToKeepPct], excessGap: +(b60.medianExcess - g60.medianExcess).toFixed(2) }; };
  const full = test(null), yrs = Object.fromEntries(YEARS.map((y) => [y, test(y)])), yearsPassed = YEARS.filter((y) => yrs[y].ok).length; return { band, full, years: yrs, yearsPassed, pass: full.ok && yearsPassed >= 3 }; };
const c43 = () => { const l = 'Swing only: deep (1.5 ATR)'; const test = (y) => { const d60 = cell(60, l, y), d20 = cell(20, l, y), k60 = cell(60, 'Keep', y), k20 = cell(20, 'Keep', y); if (d60.n < MIN || d20.n < MIN) return { ok: false, thin: true }; const ex = d60.medianExcess - k60.medianExcess <= -1, back = d20.backToKeepPct <= k20.backToKeepPct - 15; return { ok: ex && back, ex, back, excessGap: +(d60.medianExcess - k60.medianExcess).toFixed(2), backPct: [d20.backToKeepPct, k20.backToKeepPct] }; };
  const full = test(null), yrs = Object.fromEntries(YEARS.map((y) => [y, test(y)])), yearsPassed = YEARS.filter((y) => yrs[y].ok).length;
  const dR = cell(60, l, null, true), kR = cell(60, 'Keep', null, true), redSign = dR.n >= MIN && dR.medianExcess < kR.medianExcess;
  return { full, years: yrs, yearsPassed, redOnlyDeepWorseThanKeep: redSign, redOnly: [dR.medianExcess, kR.medianExcess], pass: full.ok && yearsPassed >= 3 && redSign }; };
result.tests = { 'C-42': ['200 only: near (within 1 ATR)', '200 only: mid (1 ATR to 3%)', '200 only: far (beyond both)'].map(c42), 'C-43': c43(), note: 'A calendar year counts only with at least 100 observations in the cell (implementation detail added when the script was written).' };

mkdirSync(OUT, { recursive: true }); mkdirSync('docs/replay', { recursive: true });
writeFileSync(`${OUT}/replay-${ASOF}${TAG}.json`, JSON.stringify(result, null, 1) + '\n');
const f = (x) => (isNaN(x) ? '-' : x);
const T = (H) => `| Group at start date | Obs | Median excess | Mean excess | 10th pct | Red only (median) | Back to Keep |\n| --- | --- | --- | --- | --- | --- | --- |\n` + LABELS.map((l) => { const c = result.replay.byHorizon[H][l]; return `| ${l} | ${c.all.n} | ${f(c.all.medianExcess)} | ${f(c.all.meanExcess)} | ${f(c.all.p10Excess)} | ${f(c.redOnly.medianExcess)} (${c.redOnly.n}) | ${f(c.all.backToKeepPct)}% |`; }).join('\n');
const cs = result.crossSection;
writeFileSync(`docs/replay/BASELINE-${ASOF}${TAG}.md`, `# Replay of the Legacy exit test on stored closes\n\nGenerated by \`scripts/replay-verdicts.mjs\` from the repo's stored prices (${dates[0]} to ${ASOF}, ${N} sessions). Start dates every ${STEP} sessions from ${dates[T0]}. Excess = a stock's forward return minus the median Nifty 500 stock's over the same window (index history before Dec 2025 is not stored, so differences between groups are the readable part, not absolute levels). Observations overlap and cluster in time; no significance test. Delisted stocks drop out of the forward returns. ATR is a close-to-close proxy. Closes are back-adjusted for ${adjustedN} plain splits and bonuses confirmed by the stored prices; the guard now covers only actions that cannot be adjusted. Guard removed ${removed[20]} (20 sessions) and ${removed[60]} (60 sessions) observations; ${kept[20]} and ${kept[60]} kept. Parity with src/pm/verdict.ts at ${ASOF}: ${result.parity.identical} of ${result.parity.symbols} stocks identical.\n\n## Where each group sits on ${cs.date}\n\n| Group | Stocks | of which Nifty 500 | Median % from 200-day | Median RS percentile (63 sessions) |\n| --- | --- | --- | --- | --- |\n${Object.entries(cs.groups).map(([g, v]) => `| ${g} | ${v.stocks} | ${v.nifty500} | ${f(v.medianPctFrom200)} | ${f(v.medianRsPercentile)} |`).join('\n')}\n\nNo verdict: ${cs.noVerdictCorporateAction} with a corporate action in the last 300 sessions, ${cs.noVerdictOther} other (mostly under 200 sessions).\n\n## Forward 20 sessions\n\n${T(20)}\n\n## Forward 60 sessions\n\n${T(60)}\n\n## Pre-registered tests (Engine Rules C-42, C-43)\n\n${result.tests['C-42'].map((b) => `- **C-42, ${b.band}:** ${b.pass ? 'PASS (wait for confirmation)' : 'FAIL (exit at the first close)'}; full sample ${b.full.ok ? 'passes' : 'fails'}, ${b.yearsPassed} of 4 years pass.`).join('\n')}\n- **C-43, deep swing low above the 200-day:** ${result.tests['C-43'].pass ? 'PASS (swing leg stays a rule with the depth condition)' : 'FAIL (swing leg above the 200-day is context only)'}; full sample ${result.tests['C-43'].full.ok ? 'passes' : 'fails'}, ${result.tests['C-43'].yearsPassed} of 4 years pass, Red-only ${result.tests['C-43'].redOnlyDeepWorseThanKeep ? 'same sign' : 'not the same sign'}.\n\n${result.tests.note}\n`);
console.log(`wrote ${OUT}/replay-${ASOF}${TAG}.json and docs/replay/BASELINE-${ASOF}${TAG}.md`);

// ---- notes: what the adjustment did, and whether the group-level conclusions survived it
if (TAG) {
  const blocked = []; for (const s of Object.keys(px)) { if (px[s][N - 1] == null) continue; const v = stockVerdict(s, { dates, px: rawPx }, rows); if (v.label === 'No verdict' && /corporate action/.test(v.reasons[0])) blocked.push(`${s} (${v.reasons[0].match(/\((.*?), ex-date/)?.[1] ?? '?'})`); }
  const basePath = `${OUT}/replay-${ASOF}.json`; let cmp = '';
  if (existsSync(basePath)) { const b = JSON.parse(readFileSync(basePath, 'utf8')); const keys = ['Both', '200 only', 'Swing only', 'Keep'], get = (r, H, g, k) => r.replay.byHorizon[H][g].all[k];
    cmp = `\n| Group | Median excess, 60 sessions: unadjusted | adjusted | Back to Keep after 60: unadjusted | adjusted |\n| --- | --- | --- | --- | --- |\n${keys.map((g) => `| ${g} | ${get(b, 60, g, 'medianExcess')} | ${get(result, 60, g, 'medianExcess')} | ${get(b, 60, g, 'backToKeepPct')}% | ${get(result, 60, g, 'backToKeepPct')}% |`).join('\n')}\n\nThe pre-adjustment baseline is docs/replay/BASELINE-${ASOF}.md.\n`; }
  appendFileSync(`docs/replay/BASELINE-${ASOF}${TAG}.md`, `\n## Adjustment notes\n\n- ${adjustedN} split and bonus actions adjusted; ${rejectedAdj.length} ex-date groups rejected because the stored prices did not show the expected drop, or had no close either side. Actions with the same ex-date are combined (a bonus announced with a split is one price move).\n- Rejected groups: ${rejectedAdj.map((r) => `${r.symbol} ${r.exDate} (${r.subjects.join(' + ').slice(0, 40)}; expected x${(1 / r.factor).toFixed(2)}, observed ${r.observed ?? 'no data'})`).join('; ')}.\n- Still blocked at ${ASOF}: ${blocked.length} stocks: ${blocked.join(', ')}.\n${cmp}`);
}
