// Pool filters for the stopped-parent variants (Engine Rules C-162 low-turnover stand-in, C-168 MAX exclusion, C-165 trend-template filter). Pure.
// Each takes the sleeve's eligible list (already the top 200 by traded value) and returns the names that stay in the pool; the sleeve rule then runs unchanged.
export interface N { sym: string; value: number }
export interface S { c: ArrayLike<number>; v?: ArrayLike<number> }
const ok = (x: number): boolean => x > 0;
const avg = (c: ArrayLike<number>, t: number, n: number): number => { if (t - n + 1 < 0) return NaN; let s = 0; for (let i = t - n + 1; i <= t; i++) { if (!ok(c[i])) return NaN; s += c[i]; } return s / n; };

/** C-165 / C-135 trend template: close above the 150 and 200-day averages; 150 above 200; 200 above its level 21 sessions ago; 50 above 150 and 200; close above 50; at least 30% above the 52-week low and within 25% of the 52-week high. null when history is incomplete. */
export function trendTemplate(c: ArrayLike<number>, t: number): boolean | null {
  if (t < 252 + 21 || !ok(c[t])) return null; const p = c[t];
  const s50 = avg(c, t, 50), s150 = avg(c, t, 150), s200 = avg(c, t, 200), s200b = avg(c, t - 21, 200); if (![s50, s150, s200, s200b].every(Number.isFinite)) return null;
  let lo = Infinity, hi = -Infinity; for (let k = t - 251; k <= t; k++) { const v = c[k]; if (!ok(v)) return null; if (v < lo) lo = v; if (v > hi) hi = v; }
  return p > s150 && p > s200 && s150 > s200 && s200 > s200b && s50 > s150 && s50 > s200 && p > s50 && p >= 1.3 * lo && p >= 0.75 * hi;
}
/** Mean traded value (close x volume) over the last n sessions; NaN when fewer than 0.75 n sessions have both. */
export function avgValue(s: S, t: number, n = 60): number {
  if (!s.v) return NaN; let sum = 0, k = 0; for (let i = t - n + 1; i <= t; i++) if (i >= 0 && ok(s.c[i]) && s.v[i] >= 0) { sum += s.c[i] * s.v[i]; k++; }
  return k >= 0.75 * n ? sum / k : NaN;
}
/** Largest one-day return over the last w sessions; NaN when no pair of closes exists. */
export function maxDaily(c: ArrayLike<number>, t: number, w = 21): number {
  let m = NaN; for (let i = Math.max(1, t - w + 1); i <= t; i++) if (ok(c[i]) && ok(c[i - 1])) { const r = c[i] / c[i - 1] - 1; if (!(r <= m)) m = r; } return m;
}
/** C-162: drop the top fifth of the list by 60-session average traded value (price-only stand-in for turnover). Names with no figure stay. */
export function lowTurnover(list: N[], series: Map<string, S>, t: number, drop = 0.2): N[] {
  const v = list.map((n) => ({ sym: n.sym, a: avgValue(series.get(n.sym) ?? { c: [] }, t) })).filter((x) => Number.isFinite(x.a)).sort((a, b) => b.a - a.a || (a.sym < b.sym ? -1 : 1));
  const cut = new Set(v.slice(0, Math.floor(list.length * drop)).map((x) => x.sym)); return list.filter((n) => !cut.has(n.sym));
}
/** C-168: remove the MAX names, those whose largest one-day return in the last 21 sessions is in the top tenth of the list. Names with no figure stay. */
export function maxExclude(list: N[], series: Map<string, S>, t: number, frac = 0.1, w = 21): N[] {
  const v = list.map((n) => ({ sym: n.sym, m: maxDaily(series.get(n.sym)?.c ?? [], t, w) })).filter((x) => Number.isFinite(x.m)).sort((a, b) => b.m - a.m || (a.sym < b.sym ? -1 : 1));
  const cut = new Set(v.slice(0, Math.floor(list.length * frac)).map((x) => x.sym)); return list.filter((n) => !cut.has(n.sym));
}
/** C-165: keep only names passing the trend template. */
export const templateOnly = (list: N[], series: Map<string, S>, t: number): N[] => list.filter((n) => trendTemplate(series.get(n.sym)?.c ?? [], t) === true);
export type FilterName = 'lowturn' | 'max' | 'template';
export const applyFilter = (name: string | undefined, list: N[], series: Map<string, S>, t: number): N[] => (name === 'lowturn' ? lowTurnover(list, series, t) : name === 'max' ? maxExclude(list, series, t) : name === 'template' ? templateOnly(list, series, t) : list);
