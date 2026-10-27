// Automatic tax view: per person, financial year and tax type. Realised gains from the FIFO replay, after deductible charges,
// then same-year set-off, the equity exemption and estimated tax (before surcharge and cess). Breaks stay out of totals and raise a banner.
                                                    
                                               
                                                        

export const fy = (d        )         => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; };
                                                                                                                           
/** Gold, debt, international, hybrid and overseas gains: long-term at a flat rate, short-term at the person's slab rate (null while no slab rate is set). Set-off inside this group only; no carry-forward. */
                                                                                                                                                               
                                                                                                                                                                                                                                                                                                                                                                          

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
  return taxFromLines(new Map([...byFy].map(([f, m]) => [f, [...m.values()]])), rules, rep.breaks.length);
}

/** The second half of the tax view, on gains already split by type: pooling, set-off, carry, exemption, tax. Also used to combine several accounts of one person. */
export function taxFromLines(byFy                        , rules       , breaks = 0, slabRate = 0)            {
  const out            = []; let carryS = 0, carryL = 0; const ys = [...byFy.keys()].sort();
  for (const f of ys) {
    const lines = byFy.get(f) ;
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
    const oth = lines.filter((x) => !rules.types[x.type].exemption);
    let oS = oth.reduce((a, x) => a + x.stcg, 0), oL = oth.reduce((a, x) => a + x.ltcg, 0);
    const oS0 = oS, oL0 = oL;
    if (oS < 0 && oL > 0) { const u = Math.min(-oS, oL); oL -= u; oS += u; }
    const lrow = rules.types.gold_silver_etf.rules.filter((x) => x.transfer_from <= `${f.slice(0, 4)}-10-01`).sort((a, b) => b.transfer_from.localeCompare(a.transfer_from))[0] ?? rules.types.gold_silver_etf.rules[0];
    const ltRate = typeof lrow.ltcg === 'number' ? lrow.ltcg : 0.125, ltT = Math.max(0, oL), stT = Math.max(0, oS);
    const stTax = slabRate > 0 ? Math.round(stT * slabRate) : null, ltTax = Math.round(ltT * ltRate);
    const other           = { stcg: Math.round(oS0), ltcg: Math.round(oL0), ltcgTaxable: Math.round(ltT), ltcgTax: ltTax, stcgTaxable: Math.round(stT), stcgTax: stTax, tax: stTax === null && stT > 0 ? null : ltTax + (stTax ?? 0) };
    out.push({ fy: f, lines, equity: { stcg: eq.stcg, ltcg: eq.ltcg, ltcgAfterSetoff: afterSetoff, exemption: rr.exemption, exemptionUsed: used, taxable: { stcg: taxS, ltcg: taxL }, tax: Math.round(tax) }, slabGains: Math.round(slab), other, carryForward: { stcl, ltcl, unconfirmed: true }, openBreaks: breaks, banner: breaks ? `${breaks} sell(s) with no buy are left out of these totals until resolved` : null });
  }
  return out;
}

/** One person's tax across their accounts: gains of the same type add up before set-off, exemption and tax (the exemption and the loss set-off belong to the person, not the account). */
export function mergeTax(sets             , rules       , slabRate = 0)            {
  const by = new Map                                 ();
  for (const set of sets) for (const y of set) {
    const m = by.get(y.fy) ?? by.set(y.fy, new Map()).get(y.fy) ;
    for (const l of y.lines) { const e = m.get(l.type) ?? m.set(l.type, { ...l, stcg: 0, ltcg: 0, unlabeled: 0 }).get(l.type) ; e.stcg += l.stcg; e.ltcg += l.ltcg; e.unlabeled += l.unlabeled; }
  }
  const breaks = sets.reduce((a, s) => a + (s[0]?.openBreaks ?? 0), 0);
  return taxFromLines(new Map([...by].map(([f, m]) => [f, [...m.values()]])), rules, breaks, slabRate);
}
