// Chart data for the scan's Ready and Watch names: the last bars, moving averages, auto-drawn trendlines and the setup's levels. Output only: changes no scan result.
import type { Hist } from './us-scan.ts';

export const BARS = 260, PIVOT_SIDE = 5, WARMUP = 200;
export interface Line { i1: number; p1: number; i2: number; p2: number }
export interface ChartData {
  sym: string; dates: string[]; h: number[]; l: number[]; c: number[];
  sma50: (number | null)[]; sma150: (number | null)[]; sma200: (number | null)[];
  resistance: Line | null; support: Line | null; high52: number | null; trigger: number | null; stop: number | null; base: { i1: number; i2: number; hi: number; lo: number } | null;
}
const r2 = (x: number) => Math.round(x * 100) / 100;
const smaAt = (c: ArrayLike<number>, t: number, n: number): number | null => { if (t < n - 1) return null; let s = 0; for (let i = t - n + 1; i <= t; i++) { if (!(c[i] === c[i])) return null; s += c[i]; } return r2(s / n); };

/** Confirmed pivots: a high (low) that is the highest (lowest) of PIVOT_SIDE bars either side. Indexes into the given window. */
export function pivots(h: ArrayLike<number>, l: ArrayLike<number>, side = PIVOT_SIDE): { hi: number[]; lo: number[] } {
  const hi: number[] = [], lo: number[] = [];
  for (let i = side; i < h.length - side; i++) {
    let isH = h[i] === h[i], isL = l[i] === l[i];
    for (let k = 1; k <= side && (isH || isL); k++) { if (!(h[i] >= h[i - k] && h[i] > h[i + k])) isH = false; if (!(l[i] <= l[i - k] && l[i] < l[i + k])) isL = false; }
    if (isH) hi.push(i); if (isL) lo.push(i);
  }
  return { hi, lo };
}
/** Resistance: through the last two pivot highs when the later one is lower (a falling line price must clear); support: through the last two pivot lows when the later one is higher (a rising line price should hold). Otherwise none. */
export function trendlines(h: ArrayLike<number>, l: ArrayLike<number>): { resistance: Line | null; support: Line | null } {
  const p = pivots(h, l); let resistance: Line | null = null, support: Line | null = null;
  if (p.hi.length >= 2) { const a = p.hi[p.hi.length - 2], b = p.hi[p.hi.length - 1]; if (h[b] < h[a]) resistance = { i1: a, p1: r2(h[a]), i2: b, p2: r2(h[b]) }; }
  if (p.lo.length >= 2) { const a = p.lo[p.lo.length - 2], b = p.lo[p.lo.length - 1]; if (l[b] > l[a]) support = { i1: a, p1: r2(l[a]), i2: b, p2: r2(l[b]) }; }
  return { resistance, support };
}
export function chartFor(hist: Hist, sym: string, setup: { trigger: number; stop: number } | null, bars = BARS): ChartData | null {
  const s = hist.series.get(sym); if (!s) return null;
  const N = hist.dates.length, from = Math.max(0, N - bars);
  const h: number[] = [], l: number[] = [], c: number[] = [], dates: string[] = [];
  for (let t = from; t < N; t++) { if (!(s.c[t] === s.c[t])) continue; dates.push(hist.dates[t]); c.push(r2(s.c[t])); h.push(r2(s.h[t] === s.h[t] ? s.h[t] : s.c[t])); l.push(r2(s.l[t] === s.l[t] ? s.l[t] : s.c[t])); }
  if (c.length < 60) return null;
  // moving averages use the full history (aligned to the shown window)
  const sma = (n: number) => { const o: (number | null)[] = []; for (let t = from; t < N; t++) { if (!(s.c[t] === s.c[t])) continue; o.push(smaAt(s.c, t, n)); } return o; };
  const win = Math.min(c.length, 180), off = c.length - win;
  const tl = trendlines(h.slice(off), l.slice(off));
  const shift = (x: Line | null): Line | null => (x ? { ...x, i1: x.i1 + off, i2: x.i2 + off } : null);
  const base = (() => { const k = Math.min(c.length, 30), i1 = c.length - k; let hi = -Infinity, lo = Infinity; for (let i = i1; i < c.length; i++) { hi = Math.max(hi, h[i]); lo = Math.min(lo, l[i]); } return { i1, i2: c.length - 1, hi, lo }; })();
  const yr = Math.min(c.length, 252); let high52 = -Infinity; for (let i = c.length - yr; i < c.length; i++) high52 = Math.max(high52, h[i]);
  return { sym, dates, h, l, c, sma50: sma(50), sma150: sma(150), sma200: sma(200), resistance: shift(tl.resistance), support: shift(tl.support), high52: r2(high52), trigger: setup ? r2(setup.trigger) : null, stop: setup ? r2(setup.stop) : null, base };
}
