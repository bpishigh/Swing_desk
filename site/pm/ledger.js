// Per-account FIFO replay (tax view): lots, realised sales with holding period, and breaks (sells with no matching buy).
// Breaks are never filled with an invented cost: the resolver (design 7.3) closes them from dated, sourced records.
                                         

                                                                                                
                                                                                                                                                                           
                                                                                                       
                                                                                                 

// Corporate events, applied on their ex-date before that day's trades. Each carries the record it rests on.
                                                                                
                                                                                                                                                
                                                                                                                                                   
                                                                                                                                                                                                
                                                
                                                                                                                                                        
  

const days = (a        , b        ) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const keyOf = (t       ) => t.isin || t.instrument.toUpperCase();

// `longAfterDays`: 365 for listed equity and equity funds (design section 7 rules table); null leaves the label unset.
export function replay(trades         , longAfterDays                = 365, events              = [])         {
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.side === b.side ? 0 : a.side === 'buy' ? -1 : 1) || a.time.localeCompare(b.time));
  const lots = new Map               (); const realised             = []; const breaks          = []; const applied           = [];
  const evs = [...events].sort((a, b) => a.date.localeCompare(b.date)); let ei = 0;
  const Q = (k        ) => lots.get(k) ?? lots.set(k, []).get(k) ;
  const mk = (k        , date        , qty        , unitCost        , instrument = k)      => ({ key: k, date, qty, unitCost, source: { instrument, isin: k, side: 'buy', qty, price: unitCost, value: qty * unitCost, date, time: '', exchange: '', orderId: '', tradeId: '', kind: 'stock' } });
  const apply = (e           ) => {
    applied.push(`${e.date} ${e.type} ${JSON.stringify(e)}`);
    if (e.type === 'split') for (const l of Q(e.key)) { l.qty *= e.ratio; l.unitCost /= e.ratio; }
    else if (e.type === 'bonus') { const held = Q(e.key).reduce((a, l) => a + l.qty, 0); const n = Math.floor((held * e.num) / e.den); if (n > 0) Q(e.key).push(mk(e.key, e.date, n, 0)); }
    else if (e.type === 'demerger') {
      const ls = [...Q(e.parent)]; let frac = ls.map((l) => l.qty * e.ratio);
      if (e.floorTotal) { // swap with fractions paid in cash: whole shares on the holder's total, given to the oldest lots first by largest remainder
        let units = Math.floor(frac.reduce((a, x) => a + x, 0) + 1e-9); const base = frac.map(Math.floor); units -= base.reduce((a, x) => a + x, 0);
        const order = frac.map((x, i) => [x - Math.floor(x), i]         ).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
        for (const [, i] of order) { if (units <= 0) break; base[i]++; units--; }
        frac = base;
      }
      ls.forEach((l, i) => { const cq = frac[i]; if (cq > 0) Q(e.child).push(mk(e.child, l.date, cq, (l.unitCost * l.qty * e.costPct) / cq)); l.unitCost *= 1 - e.costPct; if (e.costPct >= 1) l.qty = 0; });
      lots.set(e.parent, Q(e.parent).filter((l) => l.qty > 1e-9));
    }
    else if (e.type === 'rename') { const from = Q(e.from); lots.set(e.to, [...Q(e.to), ...from.map((l) => ({ ...l, key: e.to }))].sort((a, b) => a.date.localeCompare(b.date))); lots.set(e.from, []); }
    else if (e.type === 'grant') Q(e.key).push(mk(e.key, e.date, e.qty, e.unitCost, e.instrument));
  };
  for (const t of ordered) {
    while (ei < evs.length && evs[ei].date <= t.date) apply(evs[ei++]);
    const k = keyOf(t); const q = Q(k);
    if (t.side === 'buy') { q.push({ key: k, date: t.date, qty: t.qty, unitCost: t.price, source: t }); continue; }
    let left = t.qty;
    while (left > 1e-9 && q.length) {
      const lot = q[0]; const take = Math.min(lot.qty, left);
      const d = days(lot.date, t.date);
      realised.push({ key: k, buyDate: lot.date, sellDate: t.date, qty: take, cost: take * lot.unitCost, proceeds: take * t.price, gain: take * (t.price - lot.unitCost), days: d, long: longAfterDays === null ? null : d > longAfterDays });
      lot.qty -= take; left -= take; if (lot.qty <= 1e-9) q.shift();
    }
    if (left > 1e-9) breaks.push({ key: k, instrument: t.instrument, date: t.date, qty: left, proceeds: left * t.price });
  }
  while (ei < evs.length) apply(evs[ei++]);
  return { open: [...lots.values()].flat(), realised, breaks, applied };
}
