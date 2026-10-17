// IND-BASE-1 pieces (C-54): eligibility, 12-1 momentum selection, costs, bootstrap. Pure functions on the as-of history.
import type { Hist } from '../ingest/us-scan.ts';

export const BASE = {
  minPrice: 20, minValue: 5e7 /* Rs 5 crore */, minSessions: 260, universe: 500, lookback: 252, skip: 21, cut: 0.10, valueWindow: 20,
  tiers: [[1e9, 0.0035], [2.5e8, 0.005], [0, 0.008]] as Array<[number, number]>,   // round trip by 20-session median traded value: Rs 100 crore, Rs 25 crore, below
  boot: { block: 3, resamples: 5000, seed: 20261018 },
};
export const tierCost = (v: number, mult = 1): number => { for (const [min, c] of BASE.tiers) if (v >= min) return c * mult; return BASE.tiers[BASE.tiers.length - 1][1] * mult; };
const ok = (x: number): boolean => x === x;
const median = (a: number[]): number => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

export interface Pick { sym: string; value: number; mom: number }
/** Eligible list on night t (top `universe` by median traded value), each with its 12-1 figure (NaN when not computable). */
export function eligible(hist: Hist, t: number, skip = BASE.skip): Pick[] {
  const out: Pick[] = [];
  for (const [sym, s] of hist.series) {
    const c = s.c[t]; if (!ok(c) || c < BASE.minPrice) continue;
    let n = 0; for (let i = 0; i <= t; i++) if (ok(s.c[i])) n++;
    if (n < BASE.minSessions) continue;
    const vals: number[] = []; for (let i = t - BASE.valueWindow + 1; i <= t; i++) { if (i < 0 || !ok(s.c[i]) || !ok(s.v[i])) continue; vals.push(s.c[i] * s.v[i]); }
    if (vals.length < BASE.valueWindow * 0.75) continue;
    const value = median(vals); if (value < BASE.minValue) continue;
    const a = s.c[t - skip], b = s.c[t - BASE.lookback];
    out.push({ sym, value, mom: ok(a) && ok(b) && b > 0 ? a / b - 1 : NaN });
  }
  out.sort((x, y) => y.value - x.value || (x.sym < y.sym ? -1 : 1));
  return out.slice(0, BASE.universe);
}
/** Top share by momentum (ties broken by symbol so a run is reproducible). */
export function topShare(list: Pick[], cut = BASE.cut): Pick[] {
  const withMom = list.filter((p) => ok(p.mom)).sort((x, y) => y.mom - x.mom || (x.sym < y.sym ? -1 : 1));
  return withMom.slice(0, Math.max(1, Math.ceil(withMom.length * cut)));
}

const lcg = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
/** Circular block bootstrap of the mean: [lo5, hi95] of the resampled means. */
export function bootMean(x: number[], block = BASE.boot.block, resamples = BASE.boot.resamples, seed = BASE.boot.seed): [number, number] {
  const n = x.length; if (n < block) return [NaN, NaN];
  const r = lcg(seed), means: number[] = [];
  for (let k = 0; k < resamples; k++) { let sum = 0, cnt = 0; while (cnt < n) { const st = Math.floor(r() * n); for (let j = 0; j < block && cnt < n; j++, cnt++) sum += x[(st + j) % n]; } means.push(sum / n); }
  means.sort((a, b) => a - b); return [means[Math.floor(0.05 * resamples)], means[Math.floor(0.95 * resamples)]];
}
export const mean = (x: number[]): number => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
export const compound = (x: number[]): number => x.reduce((a, b) => a * (1 + b), 1) - 1;
