// C-118: the regime index for 2010 to 2019. The Nifty 500 where NSE has a close; the BSE 500 scaled onto it where it has not (before 21 Feb 2012 and on the odd missing session).
// Scale = Nifty 500 / BSE 500 on the nearest EARLIER session where both exist (for sessions before the first common one, the first common session): a ratio known at the time,
// so no later value is used. The proxy was checked in advance: data/replay/c118-index-proxy.json.
export interface Spliced { values: Float64Array; fromNifty: number; fromBse: number; missing: number }
export function spliceIndex(dates: string[], nifty: Record<string, number>, bse: Record<string, number>): Spliced {
  const values = new Float64Array(dates.length).fill(NaN);
  let firstK = NaN; for (const d of dates) if (d in nifty && d in bse) { firstK = nifty[d] / bse[d]; break; }
  let k = firstK, fromNifty = 0, fromBse = 0, missing = 0;
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i], n = nifty[d], b = bse[d];
    if (n > 0 && b > 0) k = n / b;
    if (n > 0) { values[i] = n; fromNifty++; }
    else if (b > 0 && k === k) { values[i] = b * k; fromBse++; }
    else missing++;
  }
  return { values, fromNifty, fromBse, missing };
}
/** True when the index close is at or above its 200-session average (needs 200 sessions; false otherwise, as C-54). */
export function above200(v: ArrayLike<number>, t: number): boolean {
  if (t < 199) return false; let s = 0; for (let i = t - 199; i <= t; i++) { if (!(v[i] > 0)) return false; s += v[i]; } return v[t] >= s / 200;
}
