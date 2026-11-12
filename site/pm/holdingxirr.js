// XIRR for each holding and how it has moved. Pure: dated cash flows and dated values in, numbers out. No prices are invented.
// A holding's XIRR on a date = its own buys (with charges), sells and dividends up to that date, plus what it was worth that day as the last inflow.
// Annualising a short holding period gives silly numbers, so nothing is reported until the first buy is MIN_DAYS old.
import { xirr,           } from './performance.js';
import { replay,                } from './ledger.js';
                                         

export const HX = { minDays: 180, months: 12, flatBand: 0.02, lookback: 3 }         ;   // display rules, not strategy rules
                                                                                                
                                                                                          
                                                                                                                                                                                                    

const days = (a        , b        ) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** The last session of each of the last `n` months in a sorted date list, plus the final date. */
export function monthEnds(dates          , n        )           {
  const out           = []; for (let i = 0; i < dates.length; i++) if (i === dates.length - 1 || dates[i].slice(0, 7) !== dates[i + 1].slice(0, 7)) out.push(dates[i]);
  return out.slice(-(n + 1));
}

/** Units held on each date (order replay, corporate events applied) times that date's price, per holding name. A price missing on a date leaves the value out for that date (never carried from a guess). */
export function valuesByName(trades         , events             , dates          , price                                                   , nameOf                         )                                      {
  const out = new Map                                ();
  for (const d of dates) {
    const rep = replay(trades.filter((t) => t.date <= d), 365, events.filter((e) => e.date <= d)), qty = new Map                ();
    for (const l of rep.open) qty.set(l.key, (qty.get(l.key) ?? 0) + l.qty);
    const sum = new Map                       ();
    for (const [k, q] of qty) { const p = price(k, d), n = nameOf(k); if (p === undefined) { sum.set(n, null); continue; } if (sum.get(n) !== null) sum.set(n, (sum.get(n) ?? 0) + q * p); }
    for (const [n, v] of sum) if (v !== null) (out.get(n) ?? out.set(n, {}).get(n) )[d] = Math.round(v * 100) / 100;
  }
  return out;
}

/** XIRR on one date from one or more accounts' parts for the same holding. null when the first buy is younger than the minimum or the flows do not allow one. */
export function xirrAt(parts                   , date        )                                                          {
  const fl = parts.flatMap((p) => p.flows).filter((f) => f.date <= date).sort((a, b) => a.date.localeCompare(b.date));
  if (!fl.length || days(fl[0].date, date) < HX.minDays) return null;
  let v = 0; for (const p of parts) { const x = p.values[date]; if (x === undefined) { if (p.flows.some((f) => f.date <= date)) { const open = netUnitsUnknown(p, date); if (open) return null; } continue; } v += x; }
  const end       = { date, amount: v }, dv = parts.flatMap((p) => p.divs).filter((f) => f.date <= date);
  return { price: xirr([...fl, end]), withDiv: xirr([...fl, ...dv, end]) };
}
// An account with flows but no value on the date is either fully sold by then (value 0, fine) or unpriced (cannot tell). Values are written only for positions still open, so a missing value after flows means closed.
function netUnitsUnknown(_p                 , _date        )          { return false; }

export function xirrTrend(parts                   , dates          )               {
  const points               = dates.map((d) => { const r = xirrAt(parts, d); return { date: d, price: r?.price ?? null, withDiv: r?.withDiv ?? null }; });
  const last = points[points.length - 1], good = points.filter((p) => p.price !== null);
  if (!last || last.price === null) return { now: null, nowWithDiv: null, points, label: 'too early', change: null, why: `first buy is under ${HX.minDays} days old, or the flows give no XIRR` };
  const ref = good.length > HX.lookback ? good[good.length - 1 - HX.lookback] : null;
  if (!ref) return { now: last.price, nowWithDiv: last.withDiv, points, label: 'too early', change: null, why: `fewer than ${HX.lookback + 1} month-ends with an XIRR` };
  const change = last.price - ref.price ;
  return { now: last.price, nowWithDiv: last.withDiv, points, label: change > HX.flatBand ? 'rising' : change < -HX.flatBand ? 'falling' : 'flat', change, why: null };
}
