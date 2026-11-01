// Backtester helpers for the C-133 to C-136 tests: monthly signal sessions, a group-difference block bootstrap, and a yearly comparison.
// Same circular block bootstrap and seed style as ind-base.ts bootMean, so the tests read alike.
const lcg = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
export const mean = (x: number[]): number => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
export const compound = (x: number[]): number => x.reduce((a, b) => a * (1 + b), 1) - 1;

/** Indices of the first session of each calendar month between `from` and `to` (inclusive dates), month 0 skipped when it has no earlier session. */
export function firstSessions(dates: string[], from: string, to: string): number[] {
  const out: number[] = [];
  for (let i = 1; i < dates.length; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= from && dates[i] <= to) out.push(i);
  return out;
}

/** Circular block bootstrap of mean(x | flag) - mean(x | not flag): [lo5, hi95]. Months keep their order and labels; resamples with an empty group are dropped. */
export function bootDiff(x: number[], flag: boolean[], block = 6, resamples = 5000, seed = 20261101): [number, number] {
  const n = x.length; if (n < block) return [NaN, NaN];
  const r = lcg(seed), diffs: number[] = [];
  for (let k = 0; k < resamples; k++) {
    let s1 = 0, n1 = 0, s0 = 0, n0 = 0, cnt = 0;
    while (cnt < n) { const st = Math.floor(r() * n); for (let j = 0; j < block && cnt < n; j++, cnt++) { const i = (st + j) % n; if (flag[i]) { s1 += x[i]; n1++; } else { s0 += x[i]; n0++; } } }
    if (n1 && n0) diffs.push(s1 / n1 - s0 / n0);
  }
  if (diffs.length < resamples / 2) return [NaN, NaN];
  diffs.sort((a, b) => a - b); return [diffs[Math.floor(0.05 * diffs.length)], diffs[Math.floor(0.95 * diffs.length)]];
}

/** Circular block bootstrap of the mean of x: [lo5, hi95]. */
export function bootMeanOf(x: number[], block = 6, resamples = 5000, seed = 20261101): [number, number] {
  const n = x.length; if (n < block) return [NaN, NaN];
  const r = lcg(seed), means: number[] = [];
  for (let k = 0; k < resamples; k++) { let sum = 0, cnt = 0; while (cnt < n) { const st = Math.floor(r() * n); for (let j = 0; j < block && cnt < n; j++, cnt++) sum += x[(st + j) % n]; } means.push(sum / n); }
  means.sort((a, b) => a - b); return [means[Math.floor(0.05 * resamples)], means[Math.floor(0.95 * resamples)]];
}

/** Per calendar year, does group A beat group B? Years where either group has fewer than minMonths months are left out. */
export function yearsAbove(years: string[], x: number[], flag: boolean[], minMonths = 2): { counted: number; wins: number; byYear: Record<string, { a: number; b: number; nA: number; nB: number }> } {
  const by: Record<string, { a: number[]; b: number[] }> = {};
  years.forEach((y, i) => { (by[y] ??= { a: [], b: [] })[flag[i] ? 'a' : 'b'].push(x[i]); });
  const byYear: Record<string, { a: number; b: number; nA: number; nB: number }> = {}; let counted = 0, wins = 0;
  for (const [y, g] of Object.entries(by)) { if (g.a.length >= minMonths && g.b.length >= minMonths) { counted++; if (mean(g.a) > mean(g.b)) wins++; } byYear[y] = { a: mean(g.a), b: mean(g.b), nA: g.a.length, nB: g.b.length }; }
  return { counted, wins, byYear };
}

/** Paired yearly comparison: compounded return of series A against series B in each calendar year (months of that year). */
export function yearsCompound(years: string[], a: number[], b: number[]): { counted: number; wins: number; byYear: Record<string, { a: number; b: number }> } {
  const ya: Record<string, number> = {}, yb: Record<string, number> = {};
  years.forEach((y, i) => { ya[y] = (ya[y] ?? 1) * (1 + a[i]); yb[y] = (yb[y] ?? 1) * (1 + b[i]); });
  const byYear: Record<string, { a: number; b: number }> = {}; let wins = 0; const ys = Object.keys(ya);
  for (const y of ys) { byYear[y] = { a: ya[y] - 1, b: yb[y] - 1 }; if (ya[y] > yb[y]) wins++; }
  return { counted: ys.length, wins, byYear };
}
