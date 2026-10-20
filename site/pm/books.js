// Book inference (design section 3): every open lot gets a book and the rule that put it there. No hand tagging.
// Liquidity is empty unless the owner enters a buffer (none is assumed). Direct stocks start as Legacy. A lot becomes Swing only by promotion
// or by a buy that matches a saved nightly shortlist (needs the Swing Desk to save shortlists; none is stored yet, so no lot is Swing today).
                                       
                                               
                                            
                                                                  
                                                                                                                                                
                                                                                                   
                              
                                     
                                   
                                                                                                                                                          
                                                                                                  
                                                                                                                        
                                                                                                                                     
                                                                        
                                                                                              
                                     
 
export function inferBooks(open       , ctx             )           {
  return open.map((lot) => {
    if (ctx.isFund(lot.key)) return { lot, book: 'Long-term'        , rule: 'rule 2: mutual funds and fund-like holdings are Long-term' };
    const t = ctx.typeOf(lot.key);
    if (t === 'gold_silver_etf' || t === 'intl_etf' || ctx.isEtf?.(lot.key)) return { lot, book: 'Long-term'        , rule: 'rule 2: ETFs other than direct equity are Long-term' };
    if (ctx.promoted?.has(`${lot.key}|${lot.date}`)) return { lot, book: 'Swing'        , rule: 'rule 4: promoted by the system (passed the screen, stop set)' };
    if (ctx.swingGoLive && lot.date >= ctx.swingGoLive && ctx.shortlistMatch?.(lot.key, lot.date)) return { lot, book: 'Swing'        , rule: 'rule 4: bought on that night\'s shortlist inside trigger and limit' };
    if (ctx.swingGoLive && lot.date >= ctx.swingGoLive && ctx.swingMatch) {
      const m = ctx.swingMatch(lot);
      if (m) {
        const info = (tier                   )            => ({ tier, setup: m.line.setup, stop: m.line.stop, trigger: m.line.trigger, limit: m.line.limit, signalDate: m.line.signalDate });
        if (m.tier === 'exact') return { lot, book: 'Swing'        , rule: 'rule 4: ' + m.why, swing: info('exact') };
        if (m.answer === 'yes') return { lot, book: 'Swing'        , rule: 'rule 4: near match confirmed by the owner: ' + m.why, swing: info('near-confirmed') };
        if (m.answer !== 'no') return { lot, book: 'Legacy'        , rule: 'rule 3: direct stocks start as Legacy (a near Swing match is waiting for your answer)', proposal: m };
      }
    }
    return { lot, book: 'Legacy'        , rule: 'rule 3: direct stocks start as Legacy' };
  });
}
export function bookTotals(tagged          , price                                     )                                                              {
  const out = { Swing: { cost: 0, value: 0, lots: 0 }, Legacy: { cost: 0, value: 0, lots: 0 }, 'Long-term': { cost: 0, value: 0, lots: 0 }, Liquidity: { cost: 0, value: 0, lots: 0 } };
  for (const t of tagged) { const b = out[t.book]; b.cost += t.lot.qty * t.lot.unitCost; b.value += t.lot.qty * (price(t.lot.key) ?? t.lot.unitCost); b.lots++; }
  return out;
}

                                                                                                           
                                                                                                                               
/** Which book a sale came from (design section 3). The tax replay sells the oldest lot first, and that stays. But if you sold a stock after opening a Swing trade in it and the oldest-first sale used older lots,
 * the Swing lot still shows open although the sale may have been your Swing exit. Each such sale is put to the owner; "yes" moves that many units of the Swing lot to Legacy (the book view only: tax is untouched),
 * "no" leaves it, no answer leaves it and lists the question. `answers` is keyed `sale:<key>|<sale date>` with 'yes' or 'no'. */
export function attributeSales(tagged          , sells             , answers                              )                                                  {
  const out           = tagged.map((t) => ({ ...t })), proposals                 = [];
  const keys = new Set(out.filter((t) => t.book === 'Swing').map((t) => t.lot.key));
  for (const key of keys) {
    const groups = sells.filter((g) => g.key === key).sort((a, b) => a.date.localeCompare(b.date));
    for (const g of groups) {
      const eligible = ()           => out.filter((t) => t.book === 'Swing' && t.lot.key === key && t.lot.date < g.date && !g.buyDates.includes(t.lot.date)).sort((a, b) => a.lot.date.localeCompare(b.lot.date));
      if (!eligible().length) continue;                                   // the sale already used the Swing lot, or happened before it
      const ans = answers[`sale:${key}|${g.date}`];
      if (ans === 'no') continue;
      if (ans !== 'yes') { const e = eligible()[0]; proposals.push({ key, date: g.date, qty: g.qty, avgPrice: g.avgPrice, swingDate: e.lot.date, swingQty: e.lot.qty }); continue; }
      let left = g.qty;
      for (const t of eligible()) {
        if (left <= 1e-9) break;
        const take = Math.min(t.lot.qty, left); left -= take;
        const idx = out.indexOf(t), moved         = { lot: { ...t.lot, qty: take }, book: 'Legacy', rule: `rule 3: ${take} of these units were your Swing trade, sold on ${g.date} (you said so); the tax view still sells the oldest lot first` };
        if (take >= t.lot.qty - 1e-9) out[idx] = moved;
        else { out[idx] = { ...t, lot: { ...t.lot, qty: t.lot.qty - take } }; out.push(moved); }
      }
    }
  }
  return { tagged: out, proposals };
}
