// Break resolver (design section 7.3). Nothing is guessed. Dated, sourced exchange records are applied; candidates for what the
// records cannot say (IPO allotments, rights) are accepted automatically only if they close the break to the unit and rest on a
// sourced, non-estimated record; anything else is proposed (one confirmation) or queued as unexplained (one tap, answer kept in overrides).
import { replay, keyOf,                                         } from './ledger.js';
                                         

                                                                                                                                                                                                      
                                                                               
                                                                                                         
                                                                                                                                                     

const dayDiff = (a        , b        ) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const remaining = (r        , k        ) => r.breaks.filter((b) => b.key === k).reduce((a, b) => a + b.qty, 0);

export function resolve(trades         , cat           , overrides              = [], longAfterDays                = 365)             {
  // Facts and typed overrides first: splits, bonuses, renames, demergers with a published cost percent are dated records, not guesses.
  let events              = [...cat.facts, ...overrides];
  const base = replay(trades, longAfterDays, events);
  const applied             = [], proposed             = [];
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  // Breaks are handled per company: a shortfall may arrive as several sells (ABC: 5 and 10 against a lot of 15).
  const byKey = new Map                 ();
  for (const b of base.breaks) (byKey.get(b.key) ?? byKey.set(b.key, []).get(b.key) ).push(b);
  for (const [key, brks] of byKey) {
    const total = brks.reduce((a, b) => a + b.qty, 0), firstBreak = brks[0];
    const first = sorted.find((t) => keyOf(t) === key)?.date ?? firstBreak.date;
    let resolved = false;
    for (const c of cat.candidates.filter((x) => x.key === key)) {
      const lead = dayDiff(c.date, first);
      if (lead < -2) continue;                                                          // the allotment must precede the first trade
      if (c.lotSize && Math.round(total) % c.lotSize !== 0) continue;                    // IPO: a whole number of lots
      const ev            = { type: 'grant', key, date: c.date, qty: total, unitCost: c.unitCost, source: c.source, estimate: c.estimate, instrument: c.instrument };
      const trial = replay(trades, longAfterDays, [...events, ev]);
      if (remaining(trial, key) > 1e-9) continue;                                         // must close the break to the unit
      const p           = { break: firstBreak, event: ev, why: `${c.kind} record ${c.source}: ${total} units at ${c.unitCost}`, status: c.estimate || !c.source ? 'proposed' : 'applied' };
      (p.status === 'applied' ? applied : proposed).push(p);
      events = [...events, ev]; resolved = true; break;                                  // proposed events still show in the provisional replay
    }
    if (resolved) continue;
    // Rights entitlement (-RE symbols): credited free to holders of the parent, nil cost. The ratio is not in the feed for every issue,
    // so the quantity cannot always be checked: proposed for one confirmation, never applied silently.
    const sym = firstBreak.instrument.toUpperCase();
    if (/-RE\d?$/.test(sym)) {
      const parent = sym.replace(/-RE\d?$/, '');
      const heldParent = sorted.some((t) => (t.symbol ?? t.instrument).toUpperCase().startsWith(parent) && t.side === 'buy' && t.date < firstBreak.date);
      if (heldParent) {
        const ev            = { type: 'grant', key, date: sorted.find((t) => keyOf(t) === key) .date, qty: total, unitCost: 0, source: `rights entitlement credited to holders of ${parent}; nil cost (quantity not checked against the issue ratio)`, estimate: true };
        proposed.push({ break: firstBreak, event: ev, why: `${sym} is a rights entitlement and ${parent} was held`, status: 'proposed' });
        events = [...events, ev];
      }
    }
  }
  const final = replay(trades, longAfterDays, events);
  const open = new Set(proposed.map((p) => p.event.type === 'grant' ? p.event.key : ''));
  return { events, replay: final, applied, proposed, unexplained: final.breaks.filter((b) => !open.has(b.key) || remaining(final, b.key) > 0), facts: final.applied };
}
