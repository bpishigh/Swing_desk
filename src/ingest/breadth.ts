// Breadth = share of a stock universe whose close is above its own 50-day average (Engine Rules, "Breadth").
// India: Nifty 500 (NSE's list). US: S&P 500 (the S5FI definition). Pure functions; the scripts do the fetching.
// Checked against the figures typed into the Claude Desk: US 29 Sep 24.6 (typed 24.65), 1 Oct 22.8 (typed 22.86); India 29 Sep 20.2 (typed 18).

export const BREAK_PCT = 22;   // a one-day move beyond this inside the window is treated as an unadjusted split/bonus: the stock is left out

export interface Series { dates: string[]; closes: number[] }

/** Share of stocks (percent, 1 decimal) above their 50-day average on `date`, and how many were counted. Window includes `date`. */
export function pctAbove50(all: Record<string, Series>, date: string): { pct: number; n: number; skipped: number } | null {
  let up = 0, n = 0, skipped = 0;
  for (const s of Object.values(all)) {
    const i = s.dates.indexOf(date);
    if (i < 49) { if (i >= 0) skipped++; continue; }
    const w = s.closes.slice(i - 49, i + 1);
    let broken = false;
    for (let k = 1; k < w.length; k++) if (Math.abs(w[k] / w[k - 1] - 1) * 100 > BREAK_PCT) { broken = true; break; }
    if (broken) { skipped++; continue; }
    n++; if (w[49] > w.reduce((a, b) => a + b, 0) / 50) up++;
  }
  return n ? { pct: Math.round((1000 * up) / n) / 10, n, skipped } : null;
}
