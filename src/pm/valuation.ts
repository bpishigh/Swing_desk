// Daily valuation series: for each trading day, units held (from the order replay up to that day) times that day's price.
// Prices come from a lookup the caller supplies (public price files); a missing price carries the last known one and is counted, never invented.
import { replay, type CorpEvent } from './ledger.ts';
import type { Trade } from './reader.ts';
export interface DayValue { date: string; value: number; invested: number; missingPrices: number }
export function valuationSeries(trades: Trade[], events: CorpEvent[], dates: string[], price: (key: string, date: string) => number | undefined): DayValue[] {
  const last = new Map<string, number>(); const out: DayValue[] = [];
  const tDates = trades.map((t) => t.date).sort(), eDates = events.map((e) => e.date).sort();
  const countLe = (a: string[], d: string) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= d) lo = m + 1; else hi = m; } return lo; };
  let memoKey = '', rep: ReturnType<typeof replay> | null = null;      // the holdings only change when a trade or event falls between two days, so reuse the replay until then
  for (const d of dates) {
    const k = countLe(tDates, d) + '|' + countLe(eDates, d);
    if (k !== memoKey || !rep) { rep = replay(trades.filter((t) => t.date <= d), 365, events.filter((e) => e.date <= d)); memoKey = k; }
    let value = 0, invested = 0, missing = 0;
    for (const l of rep.open) {
      let p = price(l.key, d); if (p === undefined) { p = last.get(l.key); if (p === undefined) { missing++; p = l.unitCost; } else missing++; } else last.set(l.key, p);
      value += l.qty * p; invested += l.qty * l.unitCost;
    }
    out.push({ date: d, value: Math.round(value * 100) / 100, invested: Math.round(invested * 100) / 100, missingPrices: missing });
  }
  return out;
}
