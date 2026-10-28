// Promote (design section 4). A direct Legacy stock that passes the exit test AND is on the latest nightly Swing Desk shortlist is a Promote candidate:
// the lot becomes Swing with the line's stop. Only the latest night counts ("today's screen"). Pure; a verdict, not an order.
                                                

                                                                            
                                                                                                                                                                         

/** `lines`: the shortlist file's lines. `latest`: the newest night the nightly job ran. `riskBudget`: rupees of risk one Swing position may carry (optional); when given the quantity is capped to fit. */
export function promoteOf(input              , lines             , latest                    , riskBudget         )                       {
  if (!latest || !(input.price > 0) || !(input.qty > 0)) return null;
  const hits = lines.filter((l) => l.sym === input.symbol && l.signalDate === latest && l.stop > 0 && l.stop < input.price);
  if (!hits.length) return null;
  const line = hits.find((l) => l.stream === 'capwaived') ?? hits[0];
  const perShare = input.price - line.stop, riskRs = perShare * input.qty;
  const qtyCapped = riskBudget && riskBudget > 0 && riskRs > riskBudget ? Math.max(0, Math.floor(riskBudget / perShare)) : null;
  return { symbol: input.symbol, line, stop: line.stop, riskPct: perShare / input.price * 100, riskRs, qtyFull: input.qty, qtyCapped,
    why: `On the ${latest} Swing Desk shortlist (setup ${line.setup}, trigger ${line.trigger}, stop ${line.stop}). Promoting gives the lot that stop: ${(perShare / input.price * 100).toFixed(1)}% below the price.` };
}
