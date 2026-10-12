// Daily valuation series: for each trading day, units held (from the order replay up to that day) times that day's price.
// Prices come from a lookup the caller supplies (public price files); a missing price carries the last known one and is counted, never invented.
import { replay,                } from './ledger.js';
                                         
                                                                                                  
export function valuationSeries(trades         , events             , dates          , price                                                   )             {
  const last = new Map                (); const out             = [];
  for (const d of dates) {
    const rep = replay(trades.filter((t) => t.date <= d), 365, events.filter((e) => e.date <= d));
    let value = 0, invested = 0, missing = 0;
    for (const l of rep.open) {
      let p = price(l.key, d); if (p === undefined) { p = last.get(l.key); if (p === undefined) { missing++; p = l.unitCost; } else missing++; } else last.set(l.key, p);
      value += l.qty * p; invested += l.qty * l.unitCost;
    }
    out.push({ date: d, value: Math.round(value * 100) / 100, invested: Math.round(invested * 100) / 100, missingPrices: missing });
  }
  return out;
}
