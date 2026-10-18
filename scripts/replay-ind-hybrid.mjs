// C-65 India momentum x desk hybrid. Pre-registered in the Engine Rules change log (18 Oct 2026) before running.
// H1: the C-54 momentum list bought at the next close with an ATR stop and the desk's exits, paired against a 20-session hold of the same names. H2: momentum membership inside the C-64 desk trades.
// Usage: node --max-old-space-size=8000 scripts/replay-ind-hybrid.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { runScan, buildHistories } from '../src/ingest/us-scan.ts';
import { INDIA_SCAN, INDIA_SCAN_VERSION, INDIA_SETUPS } from '../src/ingest/india-scan-settings.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { tierCost, eligible, topShare, BASE } from '../src/backtest/ind-base.ts';
import { SETUPS } from '../src/engine/setups.ts';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const LIMIT = +arg('limit', 0), FROM = arg('from', '2021-01-04'), HOLD = 20, MAXHOLD = 60;
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const sel = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date);
const actions = [...R('data/india/corp-actions-history.json'), ...(existsSync('data/india/corp-actions.json') ? R('data/india/corp-actions.json') : [])];
const ov = { ...(existsSync('data/india/corp-action-overrides-hist.json') ? R('data/india/corp-action-overrides-hist.json') : {}), ...(existsSync('data/india/corp-action-overrides.json') ? R('data/india/corp-action-overrides.json') : {}) };
const res = resolveHistory(sel, actions, ov);
const industry = R('data/india/segments.json').industry ?? {}, allowed = new Set(Object.keys(industry)), types = new Map([...allowed].map((s) => [s, 'CS']));
const days = toDays(sel), dates = days.map((d) => d.date), T = days.length;
const FH = buildHistories(days, res.splits, allowed);       // fully adjusted: realised returns only
const RD = R('data/india/results-dates.json'), syms = [...allowed].filter((s) => FH.series.has(s));
const first = (d) => { let lo = 0, hi = T; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] < d) lo = m + 1; else hi = m; } return lo; };
const cc = (s, i) => { const v = FH.series.get(s)?.c[i]; return v > 0 ? v : NaN; }, ret = (s, a, b) => cc(s, b) / cc(s, a) - 1;
const mc = new Map(); const mkt = (a, b) => { const k = a + ':' + b; if (mc.has(k)) return mc.get(k); let s = 0, n = 0; for (const x of syms) { let r = ret(x, a, b); if (r === r) { r = Math.max(-0.5, Math.min(0.5, r)); s += r; n++; } } const v = n > 30 ? s / n : NaN; mc.set(k, v); return v; };
const mk = new Float64Array(T).fill(NaN); mk[0] = 100; for (let i = 1; i < T; i++) { const m = mkt(i - 1, i); mk[i] = mk[i - 1] * (1 + (m === m ? m : 0)); }
const sma = (a, i, n) => { let s = 0, k = 0; for (let j = i - n + 1; j <= i; j++) if (a[j] > 0) { s += a[j]; k++; } return k >= 0.8 * n ? s / k : NaN; };
const EV = {}; for (const s of syms) EV[s] = (RD.dates[s] || []).map((d) => ({ E: first(d), d })).filter((e) => Math.abs(new Date(dates[e.E] ?? '2100-01-01') - new Date(e.d)) <= 4 * 864e5 || e.E >= T);
const dv20 = (s, t) => { const x = FH.series.get(s); let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (x.c[i] > 0 && x.v[i] === x.v[i]) { a += x.c[i] * x.v[i]; n++; } return n ? a / n : 0; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const wkKey = (d) => { const t = new Date(d + 'T00:00:00Z'); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const y = t.getUTCFullYear(); const j = new Date(Date.UTC(y, 0, 4)); return y * 100 + 1 + Math.round(((t - j) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7); };
const lastOfWeek = dates.map((d, i) => i === T - 1 || wkKey(dates[i + 1]) !== wkKey(d));
// regime as in C-54: Nifty 500 above its 200-day average to 16 Oct 2025 (index carried over missing days), the equal-weight proxy after
const idxRaw = {}; for (let y = 2020; y <= 2025; y++) Object.assign(idxRaw, Object.fromEntries(Object.entries(R(`data/india/idx-hist/idx-${y}.json`)['Nifty 500'] || {}).map(([d, v]) => [d, v[3]])));
const idx = new Float64Array(T).fill(NaN); { let last = NaN; for (let i = 0; i < T; i++) { if (dates[i] in idxRaw) last = idxRaw[dates[i]]; idx[i] = dates[i] <= '2025-10-16' ? last : NaN; } }
const proxy = mk;
const regimeOn = (t) => (dates[t] <= '2025-10-16' ? idx[t] >= sma(idx, t, 200) : proxy[t] >= sma(proxy, t, 200));
// hybrid trade: entry at close of e, ATR stop, desk exits at daily-close resolution (stops filled at the stop price)
function hybrid(sym, e, thirds = true) {
  const s = FH.series.get(sym); if (!s || !(s.c[e] > 0)) return null;
  let a = 0, n = 0; for (let i = e - 13; i <= e; i++) { const pc = s.c[i - 1]; if (s.h[i] > 0 && s.l[i] > 0 && pc > 0) { a += Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - pc), Math.abs(s.l[i] - pc)); n++; } }
  if (n < 10) return null; const atr = a / n, E = s.c[e], Rk = 1.5 * atr; if (!(Rk > 0) || Rk >= E) return null;
  const ema = new Float64Array(T).fill(NaN); { let v = NaN; for (let i = Math.max(0, e - 60); i < T; i++) { if (!(s.c[i] > 0)) continue; v = v !== v ? s.c[i] : v + (2 / 21) * (s.c[i] - v); ema[i] = v; } }
  let stop = E - Rk, left = 1, pnl = 0, maxClose = E, thirdSold = false, extSold = false, pending = null, exitIdx = e, reason = 'end';
  const sell = (frac, price) => { pnl += frac * (price / E - 1); left -= frac; };
  for (let i = e + 1; i < T && i <= e + MAXHOLD; i++) {
    if (!(s.c[i] > 0)) continue;
    if (pending) { const p = pending; pending = null; if (p.kind === 'all') { sell(left, s.c[i]); reason = p.why; exitIdx = i; break; } sell(Math.min(left, 1 / 3), s.c[i]); if (p.why === 'r5') { thirdSold = true; stop = Math.max(stop, E); } else extSold = true; }
    if (s.l[i] <= stop) { sell(left, stop); reason = stop >= E ? 'stop-at-entry' : 'stop'; exitIdx = i; break; }
    const c = s.c[i], gain = (c - E) / Rk, sessions = i - e; maxClose = Math.max(maxClose, c); exitIdx = i;
    if (sessions >= 10 && maxClose < E + Rk) { pending = { kind: 'all', why: 'r4-time-stop' }; continue; }
    if (sessions < 35) { if (ema[i] === ema[i] && c < ema[i]) { pending = { kind: 'all', why: 'r6-trail-20ema' }; continue; } }
    else if (lastOfWeek[i]) { const wc = []; for (let j = i; j >= 0 && wc.length < 10; j--) if (lastOfWeek[j] && s.c[j] > 0) wc.push(s.c[j]); if (wc.length === 10 && c < mean(wc)) { pending = { kind: 'all', why: 'r6-trail-10wk' }; continue; } }
    if (thirds && !thirdSold && gain >= 2) { pending = { kind: 'third', why: 'r5' }; continue; }
    if (thirds && !extSold && ema[i] === ema[i] && c >= 1.2 * ema[i]) { pending = { kind: 'third', why: 'r7' }; continue; }
  }
  if (left > 1e-9) { let last = -1; for (let i = Math.min(T - 1, e + MAXHOLD); i > e; i--) if (s.c[i] > 0) { last = i; break; } if (last < 0) return null; sell(left, s.c[last]); exitIdx = last; reason = 'max-hold'; }
  return { ret: pnl, held: exitIdx - e, reason, risk: Rk / E };
}
// ---- monthly momentum lists
const sig = []; for (let i = 1; i < T; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= '2021-01-01' && i + 1 + MAXHOLD + 1 < T) sig.push(i);
const lists = [], H1 = []; const t0 = Date.now();
for (const t of sig) {
  const hist = asOfHistories(days, t, res, allowed), el = eligible(hist, t), top = topShare(el), on = regimeOn(t); lists.push({ t, date: dates[t], names: new Set(top.map((p) => p.sym)), on });
  if (!on) continue; const e = t + 1;
  for (const p of top) {
    const s = FH.series.get(p.sym); if (!s || !(s.c[e] > 0)) continue; const cost = tierCost(p.value), hold = s.c[e + 20] > 0 ? s.c[e + 20] / s.c[e] - 1 : NaN, h = hybrid(p.sym, e), hn = hybrid(p.sym, e, false); if (!h || !(hold === hold)) continue;
    H1.push({ s: p.sym, d: dates[t], y: dates[t].slice(0, 4), ym: dates[t].slice(0, 7), w: dates[t] <= '2023-12-31' ? 'fit' : dates[t] <= '2025-09-30' ? 'holdout' : 'fresh', hold: hold - cost, hy: h.ret - cost, hn: hn ? hn.ret - cost : NaN, held: h.held, reason: h.reason, risk: h.risk });
  }
  if (lists.length % 12 === 0) console.error(`${dates[t]} lists ${lists.length}/${sig.length} trades ${H1.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
const pct = (v) => (v * 100).toFixed(2) + '%', f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const clusterT = (rows, f) => { const m = {}; for (const r of rows) (m[r.ym] ||= []).push(f(r)); const v = Object.values(m).map(mean); return v.length > 2 ? mean(v) / (sd(v) / Math.sqrt(v.length)) : NaN; };
console.log(`monthly lists ${lists.length}, invested months ${lists.filter((l) => l.on).length}, H1 paired trades ${H1.length}`);
console.log('\nH1 MOMENTUM NAMES: desk-style exits vs 20-session hold (same entries, net of cost)');
const rep = { H1: {} };
for (const w of ['all', 'fit', 'holdout', 'fresh']) { const a = w === 'all' ? H1 : H1.filter((x) => x.w === w); if (!a.length) continue;
  const S = (k) => ({ mean: mean(a.map((x) => x[k])), win: a.filter((x) => x[k] > 0).length / a.length, p10: q(a.map((x) => x[k]), 0.1), sd: sd(a.map((x) => x[k])) });
  const h = S('hold'), y = S('hy'), d = a.map((x) => x.hy - x.hold), t = clusterT(a, (x) => x.hy - x.hold);
  console.log(`${w.padEnd(8)} n=${String(a.length).padStart(5)} | hold20 mean ${pct(h.mean)} win ${(h.win * 100).toFixed(0)}% p10 ${pct(h.p10)} sd ${pct(h.sd)} | desk-exits mean ${pct(y.mean)} win ${(y.win * 100).toFixed(0)}% p10 ${pct(y.p10)} sd ${pct(y.sd)} held ${mean(a.map((x) => x.held)).toFixed(1)}d | diff ${pct(mean(d))} t ${t.toFixed(2)}`);
  rep.H1[w] = { n: a.length, hold: h, desk: y, diff: mean(d), t, heldDays: mean(a.map((x) => x.held)) }; }
const yrs = [...new Set(H1.map((x) => x.y))].sort(); console.log('by year (desk minus hold, mean):', yrs.map((y) => `${y}: ${pct(mean(H1.filter((x) => x.y === y).map((x) => x.hy - x.hold)))} (hold ${pct(mean(H1.filter((x) => x.y === y).map((x) => x.hold)))}, n${H1.filter((x) => x.y === y).length})`).join(' | '));
{ const hn = H1.filter((x) => x.hn === x.hn); console.log('without profit-taking thirds:', pct(mean(hn.map((x) => x.hn))), 'vs with', pct(mean(hn.map((x) => x.hy))), 'vs hold', pct(mean(hn.map((x) => x.hold)))); const rs = {}; for (const x of H1) rs[x.reason] = (rs[x.reason] || 0) + 1; console.log('exit reasons', JSON.stringify(rs)); }
const wins = ['fit', 'holdout', 'fresh'], betterWin = wins.filter((w) => rep.H1[w] && rep.H1[w].diff > 0).length, A = rep.H1.all;
const profit = A.diff >= 0.005 && A.t > 2 && betterWin >= 2, risk = A.desk.p10 - A.hold.p10 >= 0.02 && A.desk.mean - A.hold.mean >= -0.0025;
console.log(`H1 PROFIT RULE (diff>=0.5pp, t>2, 2 of 3 windows): ${profit ? 'PASS' : 'FAIL'} (diff ${pct(A.diff)}, t ${A.t.toFixed(2)}, windows better ${betterWin}/3) | RISK RULE (p10 +2pp, mean not lower by >0.25pp): ${risk ? 'PASS' : 'FAIL'} (p10 ${pct(A.desk.p10 - A.hold.p10)}, mean ${pct(A.desk.mean - A.hold.mean)})`);
// ---- H2: momentum membership inside the C-64 trades
const TR = JSON.parse(readFileSync('data/replay/ind-setups-trades.json', 'utf8')), listAt = (d) => { let best = null; for (const l of lists) if (l.date <= d) best = l; else break; return best; };
const tagged = TR.map((x) => { const l = listAt(x.d); return { ...x, mom: l ? l.names.has(x.s) : false, R: x.v.desk.R, pc: x.v.desk.pct }; }).filter((x) => x.d >= '2021-02-01');
console.log('\nH2 MOMENTUM MEMBERSHIP inside the C-64 desk trades (desk exits)');
rep.H2 = {}; for (const cls of ['valid', 'lowRoom', 'tooWide', 'all']) { const a = tagged.filter((x) => cls === 'all' || x.cls === cls), m = a.filter((x) => x.mom), o = a.filter((x) => !x.mom);
  const dR = mean(m.map((x) => x.R)) - mean(o.map((x) => x.R)), dP = mean(m.map((x) => x.pc)) - mean(o.map((x) => x.pc));
  const mm = {}, oo = {}; for (const x of m) (mm[x.ym] ||= []).push(x.R); for (const x of o) (oo[x.ym] ||= []).push(x.R); const dl = Object.keys(mm).filter((k) => oo[k]).map((k) => mean(mm[k]) - mean(oo[k])), t = dl.length > 2 ? mean(dl) / (sd(dl) / Math.sqrt(dl.length)) : NaN;
  const ok = m.length >= 100 && o.length >= 100 && dR >= 0.15 && dP >= 0.01 && t > 2;
  console.log(`${cls.padEnd(8)} momentum n=${String(m.length).padStart(4)} meanR ${f2(mean(m.map((x) => x.R)))} ret ${pct(mean(m.map((x) => x.pc)))} | others n=${String(o.length).padStart(4)} meanR ${f2(mean(o.map((x) => x.R)))} ret ${pct(mean(o.map((x) => x.pc)))} | dR ${f2(dR)} dRet ${pct(dP)} t ${t.toFixed(2)} -> ${ok ? 'SUPPORTED' : 'no'}`);
  rep.H2[cls] = { mom: m.length, others: o.length, dR, dP, t, ok }; }
// comparators
const mom20 = H1.filter((x) => x.hold === x.hold); console.log('\nCOMPARATORS: momentum held 20 sessions net', pct(mean(mom20.map((x) => x.hold))), 'per trade, wins', (100 * mom20.filter((x) => x.hold > 0).length / mom20.length).toFixed(0) + '%; desk valid trades alone', pct(mean(tagged.filter((x) => x.cls === 'valid').map((x) => x.pc))), 'per trade (n', tagged.filter((x) => x.cls === 'valid').length + ')');
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/ind-hybrid.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), lists: lists.length, rep }, null, 1));
