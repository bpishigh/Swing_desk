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
