// Automatic tax view: per person, financial year and tax type. Realised gains from the FIFO replay, after deductible charges,
// then same-year set-off, the equity exemption and estimated tax (before surcharge and cess). Breaks stay out of totals and raise a banner.
                                                    
                                               
                                                        

export const fy = (d        )         => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; };
                                                                                                                           
                                                                                                                                                                                                                                                                                                                                                         

// `typeOf(key)` gives the asset type of a replay key; `expense(r)` gives deductible charges attributable to a realised row (buy plus sell side).
export function taxView(rep        , typeOf                            , expense                         , rules       )            {
  const byFy = new Map                                 ();
  for (const r of rep.realised) {
    const type = typeOf(r.key), rule = rules.types[type];
    const f = fy(r.sellDate); const m = byFy.get(f) ?? byFy.set(f, new Map()).get(f) ;
    const line = m.get(type) ?? m.set(type, { fy: f, type, stcg: 0, ltcg: 0, confidence: rule.confidence, unlabeled: 0 }).get(type) ;
    const gain = r.gain - expense(r);
    const rr0 = rule                                                                                   ;
    const longAfter = rr0.deemed_short_if_bought_on_or_after && r.buyDate >= rr0.deemed_short_if_bought_on_or_after ? 1e9 : rr0.long_after_days;
    if (longAfter === null) { line.unlabeled += gain; continue; }
    if (r.days > longAfter) line.ltcg += gain; else line.stcg += gain;
  }
  const out            = []; let carryS = 0, carryL = 0; const ys = [...byFy.keys()].sort();
  for (const f of ys) {
    const lines = [...byFy.get(f) .values()];
    const pool = lines.filter((l) => rules.types[l.type].exemption);                      // listed equity and equity funds share set-off and the exemption
    const eq = { stcg: pool.reduce((a, l) => a + l.stcg, 0), ltcg: pool.reduce((a, l) => a + l.ltcg, 0) };
    const ruleRows = rules.types.listed_equity.rules.filter((x) => x.transfer_from <= `${f.slice(0, 4)}-10-01`).sort((a, b) => b.transfer_from.localeCompare(a.transfer_from));
    const rr = ruleRows[0] ?? rules.types.listed_equity.rules[0];
    let s = eq.stcg - carryS, l = eq.ltcg - carryL; // earlier carried losses first (unconfirmed)
    // same-year set-off: a short-term loss offsets short and long gains; a long-term loss only long gains
    if (s < 0 && l > 0) { const use = Math.min(-s, l); l -= use; s += use; }
    const stcl = s < 0 ? -s : 0, ltcl = l < 0 ? -l : 0;
    const taxS = Math.max(0, s), afterSetoff = Math.max(0, l);
    const used = Math.min(afterSetoff, rr.exemption), taxL = afterSetoff - used;
    const tax = taxS * (rr.stcg          ) + taxL * (rr.ltcg          );
    carryS = stcl; carryL = ltcl;
    const slab = lines.filter((x) => !rules.types[x.type].exemption).reduce((a, x) => a + x.stcg + x.ltcg, 0);
    out.push({ fy: f, lines, equity: { stcg: eq.stcg, ltcg: eq.ltcg, ltcgAfterSetoff: afterSetoff, exemption: rr.exemption, exemptionUsed: used, taxable: { stcg: taxS, ltcg: taxL }, tax: Math.round(tax) }, slabGains: Math.round(slab), carryForward: { stcl, ltcl, unconfirmed: true }, openBreaks: rep.breaks.length, banner: rep.breaks.length ? `${rep.breaks.length} sell(s) with no buy are left out of these totals until resolved` : null });
  }
  return out;
}
