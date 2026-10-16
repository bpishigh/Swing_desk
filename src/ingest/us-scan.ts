// US whole-market nightly scan (C-20a). Pure functions, no I/O. The order is the design's order:
//   regime light -> universe (pinned top 1,500) -> relative strength (gate, first sort) -> trend template (filter) -> group strength
//   -> base quality and extension -> setups and room -> ordered output. Qualification (universe..group) carries hysteresis.
// C-20a changes no rule: the output is a wider candidate list shown beside the weekly screen. Results dates are NOT checked here (every candidate says so).
import { SCAN, SCAN_VERSION, sicGroup } from './us-scan-settings.ts';
import { LIMITS, SETUPS, type Light, type SetupId } from '../engine/setups.ts';

export interface Day { date: string; rows: Array<[string, number, number, number, number]> }   // [ticker, close, high, low, volume], unadjusted
export interface Series { c: Float64Array; h: Float64Array; l: Float64Array; v: Float64Array }
export interface Hist { dates: string[]; series: Map<string, Series> }
export type SplitRow = [string, string, number, number];   // ticker, execution date, split_from, split_to (Massive)
export interface QualState { [ticker: string]: { in: boolean; fails: number } }

const nan = (n: number) => new Float64Array(n).fill(NaN);
const ok = (x: number) => x === x;

/** Daily bars -> one aligned series per allowed ticker, back-adjusted for splits, with a history break at long gaps (stand-in for FIGI keys). */
export function buildHistories(days: Day[], splits: SplitRow[], allowed: Set<string>): Hist {
  const dates = days.map((d) => d.date), N = days.length, series = new Map<string, Series>();
  for (let i = 0; i < N; i++) for (const [t, c, h, l, v] of days[i].rows) {
    if (!allowed.has(t)) continue;
    let s = series.get(t); if (!s) { s = { c: nan(N), h: nan(N), l: nan(N), v: nan(N) }; series.set(t, s); }
    s.c[i] = c; s.h[i] = h; s.l[i] = l; s.v[i] = v;
  }
  for (const [t, d, from, to] of splits) {
    const s = series.get(t); if (!s || !(from > 0 && to > 0)) continue;
    const ex = dates.findIndex((x) => x >= d); if (ex <= 0) continue;
    const f = from / to;
    for (let i = 0; i < ex; i++) { s.c[i] *= f; s.h[i] *= f; s.l[i] *= f; s.v[i] /= f; }
  }
  for (const s of series.values()) {     // break the history at a long gap: whatever came before belongs to another company or an old listing
    let prev = -1, start = 0;
    for (let i = 0; i < N; i++) if (ok(s.c[i])) { if (prev >= 0 && i - prev > SCAN.historyBreakGap) start = i; prev = i; }
    if (start > 0) for (let i = 0; i < start; i++) { s.c[i] = s.h[i] = s.l[i] = s.v[i] = NaN; }
  }
  return { dates, series };
}

const meanOf = (a: Float64Array, from: number, to: number): number => { let s = 0, n = 0; for (let i = from; i <= to; i++) if (ok(a[i])) { s += a[i]; n++; } return n ? s / n : NaN; };
const smaAt = (c: Float64Array, t: number, n: number): number => { if (t - n + 1 < 0) return NaN; let s = 0; for (let i = t - n + 1; i <= t; i++) { if (!ok(c[i])) return NaN; s += c[i]; } return s / n; };
const maxOf = (a: Float64Array, from: number, to: number): number => { let m = -Infinity; for (let i = Math.max(0, from); i <= to; i++) if (ok(a[i]) && a[i] > m) m = a[i]; return m === -Infinity ? NaN : m; };
const minOf = (a: Float64Array, from: number, to: number): number => { let m = Infinity; for (let i = Math.max(0, from); i <= to; i++) if (ok(a[i]) && a[i] < m) m = a[i]; return m === Infinity ? NaN : m; };
function emaAt(c: Float64Array, t: number, n: number): number {
  const first = t - 60; if (first < 0) return NaN; let e = NaN;
  for (let i = first; i <= t; i++) { if (!ok(c[i])) return NaN; e = i === first ? c[i] : e + (2 / (n + 1)) * (c[i] - e); }
  return e;
}
function atrAt(s: Series, t: number, n: number): number {     // simple mean of true range over n sessions
  let sum = 0; for (let i = t - n + 1; i <= t; i++) { if (i < 1 || !ok(s.h[i]) || !ok(s.l[i]) || !ok(s.c[i - 1])) return NaN; sum += Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - s.c[i - 1]), Math.abs(s.l[i] - s.c[i - 1])); }
  return sum / n;
}
const median = (a: number[]): number => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const r2 = (x: number): number => (ok(x) ? Math.round(x * 100) / 100 : NaN);
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export interface Member { sym: string; type: string; sessions: number; price: number; dv20: number; first: string }
export interface Candidate {
  sym: string; type: string; group: string | null; path: 'main' | 'ipo'; rsPct: number; close: number;
  tags: string[]; clears50M: boolean; composite: number; tightness: number; distPivot: number;
  setup: null | { id: SetupId; short: string; basis: number; trigger: number; limit: number; stop: number; stopWidthPct: number; roomR: number | null };
  diag: { rs121: number | null; rs6m2w: number | null; atr14: number | null; sma50: number | null; sma200: number | null; high52: number | null; low52: number | null; failingNights: number };
}
/** noTightGate: US-SCAN-2 change 1 (C-52). Off by default, so the live US-SCAN-1 scan is unchanged. */
export interface ScanInput { hist: Hist; types: Map<string, string>; sic: Map<string, number>; light: Light; prev: QualState; noTightGate?: boolean; diag?: Record<string, number> }
export interface ScanOutput {
  version: string; asOf: string; light: Light; funnel: Record<string, number>; groups: Array<{ group: string; members: number; medianRs: number; passes: boolean }>;
  ready: Candidate[]; watch: Candidate[]; noGroup: { qualified: number }; thinGroup: { qualified: number }; qualifiedTotal: number; state: QualState;
  notes: string[];
}

export function runScan(inp: ScanInput): ScanOutput {
  const { hist, types, sic, light } = inp, N = hist.dates.length, t = N - 1, asOf = hist.dates[t];
  const funnel: Record<string, number> = { tickers: hist.series.size };
  // 2. Universe
  const members: Member[] = [];
  for (const [sym, s] of hist.series) {
    if (!ok(s.c[t])) continue;
    let sessions = 0, first = -1; for (let i = 0; i <= t; i++) if (ok(s.c[i])) { sessions++; if (first < 0) first = i; }
    if (sessions < SCAN.minSessions) continue;
    const dvs: number[] = []; for (let i = t - SCAN.liqSessions + 1; i <= t; i++) if (ok(s.c[i]) && ok(s.v[i])) dvs.push(s.c[i] * s.v[i]);
    if (dvs.length < 15) continue;
    const dv20 = dvs.reduce((a, b) => a + b, 0) / dvs.length;
    if (s.c[t] < SCAN.minPrice || dv20 < SCAN.minDollarVol) continue;
    members.push({ sym, type: types.get(sym) ?? 'CS', sessions, price: s.c[t], dv20, first: hist.dates[first] });
  }
  funnel.passFloors = members.length;
  members.sort((a, b) => b.dv20 - a.dv20 || (a.sym < b.sym ? -1 : 1));
  const universe = members.slice(0, SCAN.universeSize);
  funnel.universe = universe.length;
  if (universe.length) funnel.universeFloorDollarVolumeM = Math.round(universe[universe.length - 1].dv20 / 1e5) / 10;   // the last name's 20-day dollar volume, $ million, reported each night
  // 3. Relative strength
  const q = SCAN.quarter, W = SCAN.rsWeights;
  const rs = new Map<string, number>(), ret3m = new Map<string, number>(), rs121 = new Map<string, number>(), rs6m2w = new Map<string, number>();
  for (const m of universe) {
    const c = hist.series.get(m.sym)!.c;
    const p = [0, 1, 2, 3, 4].map((k) => c[t - k * q]);
    if (t - 4 * q >= 0 && p.every(ok)) rs.set(m.sym, W[0] * (p[0] / p[1] - 1) + W[1] * (p[1] / p[2] - 1) + W[2] * (p[2] / p[3] - 1) + W[3] * (p[3] / p[4] - 1));
    if (t - q >= 0 && ok(c[t - q])) ret3m.set(m.sym, c[t] / c[t - q] - 1);
    if (t - 252 >= 0 && ok(c[t - 252]) && ok(c[t - 21])) rs121.set(m.sym, c[t - 21] / c[t - 252] - 1);
    if (t - 136 >= 0 && ok(c[t - 136]) && ok(c[t - 10])) rs6m2w.set(m.sym, c[t - 10] / c[t - 136] - 1);
  }
  const pctOf = (map: Map<string, number>): Map<string, number> => {
    const vals = [...map.values()].sort((a, b) => a - b), n = vals.length, out = new Map<string, number>();
    for (const [k, v] of map) { let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (vals[mid] < v) lo = mid + 1; else hi = mid; } out.set(k, n > 1 ? (100 * lo) / (n - 1) : 100); }
    return out;
  };
  const rsPct = pctOf(rs), ret3Pct = pctOf(ret3m);
  funnel.withRs = rs.size;
  const cut = 100 * (1 - SCAN.rsTop);
  // 4. Trend template (main path) / IPO path
  interface Row { m: Member; path: 'main' | 'ipo'; rsp: number; gate: boolean; tpl: boolean; sma50: number; sma200: number; hi52: number; lo52: number }
  const rows: Row[] = [];
  for (const m of universe) {
    const s = hist.series.get(m.sym)!, c = s.c;
    const sma50 = smaAt(c, t, 50), sma150 = smaAt(c, t, 150), sma200 = smaAt(c, t, 200), sma200ago = smaAt(c, t - SCAN.tplRisingLag, 200);
    if (rs.has(m.sym)) {
      const hi52 = maxOf(s.h, t - SCAN.yearSessions + 1, t), lo52 = minOf(s.l, t - SCAN.yearSessions + 1, t);
      const rsp = rsPct.get(m.sym)!;
      const tpl = [sma50, sma150, sma200, sma200ago].every(ok) && c[t] > sma50 && c[t] > sma150 && c[t] > sma200 && sma150 > sma200 && sma200 > sma200ago && sma50 > sma150
        && c[t] >= lo52 * (1 + SCAN.tplLowPct) && c[t] >= hi52 * (1 - SCAN.tplHighPct);
      rows.push({ m, path: 'main', rsp, gate: rsp >= cut, tpl, sma50, sma200, hi52, lo52 });
    } else if (ret3Pct.has(m.sym) && Date.parse(asOf) - Date.parse(m.first) >= SCAN.ipoMinCalendarDays * 86400000) {
      // IPO path: no four-quarter score. 3-month return ranked against the universe at the same horizon; shorter template: close above the 50-day, a formed base
      const n = SCAN.ipoBaseMinSessions, bh = maxOf(s.h, t - n + 1, t), bl = minOf(s.l, t - n + 1, t);
      const rsp = ret3Pct.get(m.sym)!;
      const tpl = ok(sma50) && c[t] > sma50 && (bh - bl) / bh <= SCAN.ipoBaseMaxDepth && (bh - c[t]) / bh <= SCAN.ipoPivotWithin;
      rows.push({ m, path: 'ipo', rsp, gate: rsp >= cut, tpl, sma50, sma200: NaN, hi52: maxOf(s.h, 0, t), lo52: minOf(s.l, 0, t) });
    }
  }
  funnel.rsGate = rows.filter((r) => r.gate).length;
  funnel.template = rows.filter((r) => r.gate && r.tpl).length;
  // 5. Group strength: median RS percentile of liquid members, at least five members
  const grp = (sym: string): string | null => sicGroup(sic.get(sym));
  const byGroup = new Map<string, number[]>();
  for (const m of universe) { const g = grp(m.sym); const p = rsPct.get(m.sym); if (g && p !== undefined) (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(p); }
  const ranked = [...byGroup].filter(([, a]) => a.length >= SCAN.groupMinMembers).map(([group, a]) => ({ group, members: a.length, medianRs: r2(median(a)) })).sort((a, b) => b.medianRs - a.medianRs);
  const nTop = SCAN.groupsPerLight[light] ?? 4;
  const topGroups = new Set(ranked.slice(0, nTop).map((g) => g.group));
  const groups = ranked.map((g) => ({ ...g, passes: topGroups.has(g.group) }));
  // Qualification with hysteresis
  const state: QualState = {}; let noGroupQ = 0, thinQ = 0;
  const qualified: Array<{ r: Row; fails: number }> = [];
  for (const r of rows) {
    const g = grp(r.m.sym), thin = g !== null && !byGroup.has(g) ? true : g !== null && (byGroup.get(g)!.length < SCAN.groupMinMembers);
    const passes = r.gate && r.tpl && g !== null && !thin && topGroups.has(g);
    if (r.gate && r.tpl && g === null) noGroupQ++;
    if (r.gate && r.tpl && g !== null && thin) thinQ++;
    const prev = inp.prev[r.m.sym];
    let isIn: boolean, fails: number;
    if (passes) { isIn = true; fails = 0; } else if (prev?.in) { fails = prev.fails + 1; isIn = fails < SCAN.failsToLeave; } else { isIn = false; fails = 0; }
    if (isIn) { state[r.m.sym] = { in: true, fails }; qualified.push({ r, fails }); }
  }
  funnel.qualified = qualified.length;
  // 6. Base quality and extension, 7. Setups and room, 8. Ordered output
  const allowed = new Set<SetupId>(LIMITS.us[light].setups);
  const ready: Candidate[] = [], watch: Candidate[] = [];
  let baseOk = 0;
  for (const { r, fails } of qualified) {
    const s = hist.series.get(r.m.sym)!, c = s.c, close = c[t];
    const a14 = atrAt(s, t, 14), aS = atrAt(s, t, SCAN.atrShort), aL = atrAt(s, t, SCAN.atrLong);
    const ratio = aS / aL, pivot = maxOf(s.h, t - SCAN.pivotSessions + 1, t), dist = (pivot - close) / pivot;
    const extended = close > r.sma50 * (1 + SCAN.extendedAbove50);
    const tight = ok(ratio) && ratio < SCAN.atrTightRatio;
    const ema20 = emaAt(c, t, 20), lowN = minOf(s.l, t - SCAN.pullbackLookback + 1, t), low10 = minOf(s.l, t - SCAN.stopLookback + 1, t);
    const overhead = maxOf(s.h, t - SCAN.roomSessions + 1, t);
    const tags: string[] = ['results date not checked'];
    if (r.m.type === 'ADRC') tags.push('ADR: delisting risk not in the price; results dates less reliable');
    if (r.m.dv20 < SCAN.clears50M) tags.push('below $50M a day');
    if (fails > 0) tags.push(`failed qualification ${fails} night(s)`);
    if (r.path === 'ipo') tags.push('IPO path: 3-month return rank, shorter template');
    if (extended) tags.push('extended: more than 25% above the 50-day');
    let sawGeometry = false, sawWidthPass = false;
    const buildSetup = (id: SetupId, basis: number, stopRaw: number, roomRef: number) => {
      sawGeometry = true;
      const sp = SETUPS[id], trigger = basis * (1 + sp.trig / 100), limit = trigger * (1 + sp.lim / 100);
      let stop = stopRaw; if (ok(a14) && stop > trigger - SCAN.atrStopMult * a14) stop = trigger - SCAN.atrStopMult * a14;
      const width = (trigger - stop) / trigger; if (!(width > 0) || width * 100 > sp.maxStop) return null;
      sawWidthPass = true;
      let roomR: number | null = null;
      if (ok(overhead) && overhead > roomRef) { roomR = (overhead - trigger) / (trigger - stop); if (roomR < SCAN.roomR) return null; }
      return { id, short: sp.short, basis: r2(basis), trigger: r2(trigger), limit: r2(limit), stop: r2(stop), stopWidthPct: r2(width * 100), roomR: roomR === null ? null : r2(roomR) };
    };
    let setup: Candidate['setup'] = null;
    if (!extended) {
      const sid: SetupId = r.path === 'ipo' ? '1ipo' : '1';
      if (allowed.has(sid) && (r.path === 'ipo' || tight || inp.noTightGate) && dist <= SCAN.pivotWithin) setup = buildSetup(sid, pivot, low10, pivot);
      if (!setup && r.path === 'main' && allowed.has('2') && ok(ema20) && close >= ema20 && lowN <= ema20 && close > r.sma50) setup = buildSetup('2', s.h[t], lowN, s.h[t]);
      if (!setup && r.path === 'main' && allowed.has('4') && close >= r.sma50 && lowN <= r.sma50) setup = buildSetup('4', s.h[t], lowN, s.h[t]);
    }
    if (inp.diag) { const d = inp.diag, bump = (k: string) => { d[k] = (d[k] ?? 0) + 1; }; bump('qualified'); if (extended) bump('extended'); else if (setup) bump('setup'); else if (!sawGeometry) bump('noGeometry'); else if (!sawWidthPass) bump('failStopWidth'); else bump('failRoom'); }
    if (tight && dist <= SCAN.pivotWithin && !extended) baseOk++;
    const tightScore = ok(ratio) ? 100 * clamp01(1 - ratio / SCAN.atrTightRatio) : 0, pivotScore = 100 * clamp01(1 - dist / SCAN.pivotWithin);
    const composite = (SCAN.weights.rs * r.rsp + SCAN.weights.tightness * tightScore + SCAN.weights.pivot * pivotScore) / (SCAN.weights.rs + SCAN.weights.tightness + SCAN.weights.pivot);
    const cand: Candidate = {
      sym: r.m.sym, type: r.m.type, group: grp(r.m.sym), path: r.path, rsPct: r2(r.rsp), close: r2(close), tags, clears50M: r.m.dv20 >= SCAN.clears50M,
      composite: r2(composite), tightness: r2(ratio), distPivot: r2(dist * 100), setup,
      diag: { rs121: ok(rs121.get(r.m.sym) ?? NaN) ? r2((rs121.get(r.m.sym) as number) * 100) : null, rs6m2w: ok(rs6m2w.get(r.m.sym) ?? NaN) ? r2((rs6m2w.get(r.m.sym) as number) * 100) : null,
        atr14: ok(a14) ? r2(a14) : null, sma50: ok(r.sma50) ? r2(r.sma50) : null, sma200: ok(r.sma200) ? r2(r.sma200) : null, high52: ok(r.hi52) ? r2(r.hi52) : null, low52: ok(r.lo52) ? r2(r.lo52) : null, failingNights: fails },
    };
    (setup ? ready : watch).push(cand);
  }
  funnel.baseQuality = baseOk;
  funnel.withSetup = ready.length;
  const order = (a: Candidate, b: Candidate) => b.composite - a.composite || b.rsPct - a.rsPct || (a.sym < b.sym ? -1 : 1);
  const cap = (list: Candidate[]): Candidate[] => { const n = new Map<string, number>(); const out: Candidate[] = []; for (const x of [...list].sort(order)) { const g = x.group ?? x.sym; const k = n.get(g) ?? 0; if (k >= SCAN.maxPerIndustry) continue; n.set(g, k + 1); out.push(x); if (out.length >= SCAN.top) break; } return out; };
  const notes = ['C-20a: no rule change. Results dates are not checked here; the weekly screen and the checklist still apply.', 'Setup detection definitions are provisional (see us-scan-settings.ts).'];
  notes.push('Composite weights 60/25/15 signed off 16 Oct 2026; settings frozen (US-SCAN-1), forward-test clock running.');
  if (!sic.size) notes.push('No SIC file: the group step cannot run, so no stock is shortlisted. Run the backfill-us-sic workflow.');
  return { version: SCAN_VERSION, asOf, light, funnel, groups, ready: cap(ready), watch: cap(watch), noGroup: { qualified: noGroupQ }, thinGroup: { qualified: thinQ }, qualifiedTotal: qualified.length, state, notes };
}
