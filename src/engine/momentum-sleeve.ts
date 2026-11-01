// MOM-30 v1: the momentum sleeve (Engine Rules C-129 build, C-130 stream). Pure functions: no files, no network.
// The same arithmetic as scripts/backtest-momentum30.mjs (C-129 replay), written once here so the live job and any later replay can share it.
// C-130 pass condition 1 compares the live book with a replay of this code on every review date.
export const MOM30 = { version: 'MOM-30 v1', UNI: 200, HOLD: 30, KEEP: 45, W6: 126, W12: 252, CAPW: 0.05, CAPX: 5, reviewMonths: ['06', '12'] };

export interface Closes { c: ArrayLike<number> }
export interface Eligible { sym: string; value: number }
export interface Ranked { sym: string; value: number; a6: number; a12: number; s: number; mult: number; rank: number }
export interface Selection { picks: Ranked[]; ranked: Ranked[]; total: number; universe: number }

const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
/** Return over w sessions divided by the daily-return standard deviation over the same window; null when the window is incomplete. */
export function volAdj(c: ArrayLike<number>, t: number, w: number): number | null {
  if (t - w < 0) return null;
  if (!(c[t] > 0) || !(c[t - w] > 0)) return null;
  const r: number[] = [];
  for (let i = t - w + 1; i <= t; i++) { if (!(c[i] > 0) || !(c[i - 1] > 0)) continue; r.push(c[i] / c[i - 1] - 1); }
  if (r.length < 0.9 * w) return null;
  const m = mean(r), sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1));
  return sd > 0 ? (c[t] / c[t - w] - 1) / sd : null;
}
export const zscores = (a: number[]): number[] => { const m = mean(a), sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); return a.map((v) => (v - m) / sd); };
/** Pro-rata weights with a per-name cap, redistributing the excess. */
export function capped(raw: number[], cap: number[]): number[] {
  let w = raw.map((x) => x / raw.reduce((a, b) => a + b, 0)); const fixed = new Array(w.length).fill(false);
  for (let it = 0; it < 40; it++) {
    let over = false, free = 0, used = 0;
    w.forEach((x, i) => { if (!fixed[i] && x > cap[i] + 1e-12) { w[i] = cap[i]; fixed[i] = true; over = true; } });
    if (!over) break;
    w.forEach((x, i) => { if (fixed[i]) used += x; else free += raw[i]; });
    w = w.map((x, i) => (fixed[i] ? x : (raw[i] / free) * (1 - used)));
  }
  return w;
}
/** Rank the universe on night t and choose the 30: blend of the 6 and 12 month volatility-adjusted z-scores; names already held stay while ranked 45 or better. */
export function selectSleeve(eligible: Eligible[], series: Map<string, Closes>, t: number, prev: Set<string>): Selection {
  const uni = eligible.slice(0, MOM30.UNI), rows: Ranked[] = [];
  for (const p of uni) {
    const s = series.get(p.sym); if (!s) continue;
    const a6 = volAdj(s.c, t, MOM30.W6), a12 = volAdj(s.c, t, MOM30.W12); if (a6 === null || a12 === null) continue;
    rows.push({ sym: p.sym, value: p.value, a6, a12, s: 0, mult: 1, rank: 0 });
  }
  const z6 = zscores(rows.map((r) => r.a6)), z12 = zscores(rows.map((r) => r.a12));
  rows.forEach((r, i) => { r.s = (z6[i] + z12[i]) / 2; r.mult = r.s >= 0 ? 1 + r.s : 1 / (1 - r.s); });
  rows.sort((a, b) => b.s - a.s || (a.sym < b.sym ? -1 : 1)); rows.forEach((r, i) => { r.rank = i + 1; });
  const keep = rows.filter((r) => prev.has(r.sym) && r.rank <= MOM30.KEEP), chosen = new Set(keep.map((r) => r.sym));
  for (const r of rows) { if (chosen.size >= MOM30.HOLD) break; if (!chosen.has(r.sym)) chosen.add(r.sym); }
  return { picks: rows.filter((r) => chosen.has(r.sym)), ranked: rows, total: uni.reduce((a, b) => a + b.value, 0), universe: rows.length };
}
/** Target weights: traded value times the score multiplier, each name capped at the lower of 5% or 5 times its share of the universe's traded value. */
export function sleeveWeights(sel: Selection): number[] {
  const raw = sel.picks.map((r) => r.value * r.mult), cap = sel.picks.map((r) => Math.min(MOM30.CAPW, MOM30.CAPX * r.value / sel.total));
  let w = capped(raw, cap);
  if (w.reduce((a, b) => a + b, 0) < 1 - 1e-9) w = capped(raw, sel.picks.map(() => MOM30.CAPW));   // fallback: the 5% cap alone, when the lower caps cannot hold the whole portfolio
  return w;
}
/** First session of a calendar month in a review month (June, December). `dates` ascending, t the night index. */
export const isReviewSession = (dates: string[], t: number): boolean => t > 0 && dates[t].slice(0, 7) !== dates[t - 1].slice(0, 7) && MOM30.reviewMonths.includes(dates[t].slice(5, 7));

/** US universe on night t (as the C-131 replay): listed companies, price at least 5 dollars, 260 sessions of history, 20-session median dollar volume at least 20 million; most traded first. */
export const US_UNI = { minPrice: 5, minValue: 20e6, minSessions: 260 };
export function eligibleUs(series: Map<string, { c: ArrayLike<number>; v: ArrayLike<number> }>, t: number): Eligible[] {
  const out: Eligible[] = [];
  for (const [sym, s] of series) {
    if (!(s.c[t] >= US_UNI.minPrice)) continue;
    let n = 0; for (let i = 0; i <= t; i++) if (s.c[i] > 0) n++; if (n < US_UNI.minSessions) continue;
    const vals: number[] = []; for (let i = t - 19; i <= t; i++) if (i >= 0 && s.c[i] > 0 && s.v[i] >= 0) vals.push(s.c[i] * s.v[i]);
    if (vals.length < 15) continue;
    vals.sort((a, b) => a - b); const m = vals.length >> 1, value = vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
    if (value >= US_UNI.minValue) out.push({ sym, value });
  }
  return out.sort((a, b) => b.value - a.value || (a.sym < b.sym ? -1 : 1));
}
