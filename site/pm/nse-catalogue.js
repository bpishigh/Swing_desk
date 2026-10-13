// Turns the NSE corporate-actions history into dated, sourced events for the resolver. Bonus and split subjects carry their ratio;
// demergers carry none, so the ratio and the company's published cost percent come from data/rules/demergers.json (a typed, sourced record).
                                             
                                               
                                            
                                                                                                                                      
                                                                                                                                                                                                                                                                               
const num = (s        ) => Number(s.replace(/,/g, ''));

export function buildCatalogue(rows           , lin         , demergers                   = [], held              )                                                                                                        {
  const facts              = [], skipped                                                                     = [];
  for (const r of rows) {
    const key = lin.key(r.symbol, r.isin); if (held && !held.has(key)) continue;
    const s = r.subject.trim(); const src = `NSE corporate actions: ${r.symbol} ${r.exDate} "${s}"`;
    let m = /Bonus\s+(\d+):(\d+)/i.exec(s);
    if (m) { facts.push({ type: 'bonus', key, num: num(m[1]), den: num(m[2]), date: r.exDate, source: src }); continue; }
    m = /From R[se]\.? ?([\d.]+)\/?-? Per Share To R[se]\.? ?([\d.]+)/i.exec(s);
    if (m && /split|sub-?division/i.test(s)) { facts.push({ type: 'split', key, ratio: num(m[1]) / num(m[2]), date: r.exDate, source: src }); continue; }
    if (/demerger/i.test(s)) {
      const d = demergers.filter((x) => x.feed !== false).find((x) => x.exDate === r.exDate && (x.parentIsin === key || lin.key(x.parent) === key || x.parent.toUpperCase() === r.symbol));
      if (d) facts.push({ type: 'demerger', parent: key, child: d.childIsin ?? lin.key(d.child), ratio: d.ratio, costPct: d.costPct, floorTotal: d.floorTotal, date: r.exDate, source: d.source });
      else skipped.push({ symbol: r.symbol, exDate: r.exDate, subject: s, why: 'demerger without a ratio and cost percent record' });
    }
  }
  for (const d of demergers.filter((x) => x.feed === false)) { // scheme mergers the feed does not list: a typed, sourced record
    const parent = d.parentIsin ?? lin.key(d.parent); if (held && !held.has(parent)) continue;
    facts.push({ type: 'demerger', parent, child: d.childIsin ?? lin.key(d.child), ratio: d.ratio, costPct: d.costPct, floorTotal: d.floorTotal, date: d.exDate, source: d.source });
  }
  return { catalogue: { facts, candidates: [] }, skipped };
}

                                                                                                                                                              
/** IPO allotments are not in a tradebook; the record is only a candidate, accepted by the resolver if it closes the break to the unit. */
export function ipoCandidates(records             , lin         , held              ) {
  return records.map((r) => ({ kind: 'ipo'         , key: lin.key(r.symbol), date: r.allotDate, unitCost: r.issuePrice, lotSize: r.lotSize, windowDays: 14, source: r.source, estimate: r.estimate, instrument: r.symbol })).filter((c) => !held || held.has(c.key));
}
