// Corporate-event guard for the US first-wave books (Engine Rules C-179 item 9). Pure.
// The US bars are split-adjusted only: a split after the base files were cut looks like a fall of half or more, a spin-off or special dividend looks like a fall.
export const GAP = { fall: 0.15, tol: 0.03, ratios: [1.5, 2, 3, 4, 5, 10, 20] };

/** The split ratio k (3 for 2 = 1.5) a one-day close ratio matches within 3%, up or down (a reverse split is the same ratio the other way); null when it matches none. */
export function splitLike(ratio: number): number | null {
  if (!(ratio > 0) || !Number.isFinite(ratio)) return null;
  for (const k of GAP.ratios) if (Math.abs(ratio * k - 1) <= GAP.tol || Math.abs(ratio / k - 1) <= GAP.tol) return k;
  return null;
}

/** One-day move on night t from the latest earlier close (within 5 sessions). */
export function dayMove(c: ArrayLike<number>, t: number): { ratio: number; prev: number } | null {
  if (!(c[t] > 0)) return null;
  for (let k = t - 1; k >= Math.max(0, t - 5); k--) if (c[k] > 0) return { ratio: c[t] / c[k], prev: k };
  return null;
}

export interface GapEntry { date: string; sym: string; kind: 'stop-out after fall' | 'distribution credited' | 'blocked'; move: number | null; state: string }
export interface ConfirmedEvent { sym: string; date: string; kind: 'distribution' | 'real'; perShare?: number }

/** A fall of 15% or more in one day (ratio at or below 0.85). */
export const bigFall = (ratio: number): boolean => ratio <= 1 - GAP.fall;
