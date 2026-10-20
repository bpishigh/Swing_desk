// Every trade in an account, as the broker statements show it: a transaction list, one summary per stock, and monthly totals. Display only; no rule uses it.
// Realised gain on a sale comes from the tax replay (oldest lot first), so it matches the Tax tab. Nothing here is stored anywhere.
                                            

                                                                                                       
                                                                                                                                                                                                    
                            
                                                                                                        
                                                                                                                                                    
                                                                                                      
                                                                                                                                                                              
                 
 
                                                                                                   
                                                                                                                                                                                                       

const EPS = 1e-6;
const days = (a        , b        ) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
/** `bookOf` and `kindOf` and `nameOf` come from the pipeline (the book a stock sits in now, its type, its full name). `today` closes the holding period of an open stock. */
export function tradeHistory(raw          , realised            , nameOf                       , kindOf                            , bookOf                       , today        , openQty                      )          {
  // Units still held come from the tax replay (it knows splits, bonuses and demergers); a stock the replay never saw falls back to buys minus sells.
  const replayKeys = new Set        ([...(openQty?.keys() ?? []), ...realised.map((r) => r.key)]);
  // realised gain per sale day and stock, shared across that day's sell lines by quantity
  const rg = new Map                                       ();
  for (const r of realised) { const k = `${r.key}|${r.sellDate}`, g = rg.get(k) ?? { gain: 0, qty: 0 }; g.gain += r.gain; g.qty += r.qty; rg.set(k, g); }
  const dayQty = new Map                (), dayVal = new Map                ();
  for (const t of raw) if (t.side === 'sell') { const k = `${t.key}|${t.date}`; dayQty.set(k, (dayQty.get(k) ?? 0) + t.qty); dayVal.set(k, (dayVal.get(k) ?? 0) + t.qty * t.price); }
  const txns        = raw.filter((t) => t.qty > 0 && Number.isFinite(t.price)).map((t) => {
    let gain                = null;
    // Sales of one stock on one day share the replay's figure: cost is spread by units, so each line's gain follows its own price.
    if (t.side === 'sell') { const k = `${t.key}|${t.date}`, g = rg.get(k), dq = dayQty.get(k) ?? 0, dv = dayVal.get(k) ?? 0; gain = g && dq > 0 ? t.qty * t.price - (dv - g.gain) * (t.qty / dq) : null; }
    return { key: t.key, name: nameOf(t.key), kind: kindOf(t.key), book: bookOf(t.key), date: t.date, side: t.side, qty: t.qty, price: t.price, value: t.qty * t.price, gain };
  }).sort((a, b) => a.date.localeCompare(b.date) || (a.side === b.side ? 0 : a.side === 'buy' ? -1 : 1));
  const by = new Map               (); for (const t of txns) (by.get(t.key) ?? by.set(t.key, []).get(t.key) ).push(t);
  const stocks              = [...by].map(([key, ts]) => {
    const buys = ts.filter((t) => t.side === 'buy'), sells = ts.filter((t) => t.side === 'sell');
    const bq = buys.reduce((s, t) => s + t.qty, 0), sq = sells.reduce((s, t) => s + t.qty, 0), inv = buys.reduce((s, t) => s + t.value, 0), pro = sells.reduce((s, t) => s + t.value, 0);
    const held = replayKeys.has(key) ? (openQty?.get(key) ?? 0) : Math.max(0, bq - sq), closed = held <= EPS, first = ts[0].date, lastSell = sells.length ? sells[sells.length - 1].date : null;
    return { key, name: ts[0].name, kind: ts[0].kind, book: ts[0].book, status: closed ? 'Closed'          : sq > 0 ? 'Partly sold'          : 'Open'         , boughtQty: bq, soldQty: sq, heldQty: held, avgBuy: bq > 0 ? inv / bq : 0, avgSell: sq > 0 ? pro / sq : null, invested: inv, proceeds: pro, realised: sells.reduce((s, t) => s + (t.gain ?? 0), 0), firstBuy: first, lastSell, noBuy: buys.length === 0, buys: buys.length, sells: sells.length, held: held > EPS, days: days(first, closed && lastSell ? lastSell : today) };
  }).sort((a, b) => (b.lastSell ?? b.firstBuy).localeCompare(a.lastSell ?? a.firstBuy));
  const mm = new Map               ();
  for (const t of txns) { const ym = t.date.slice(0, 7), m = mm.get(ym) ?? { ym, bought: 0, sold: 0, realised: 0, txns: 0 }; if (t.side === 'buy') m.bought += t.value; else { m.sold += t.value; m.realised += t.gain ?? 0; } m.txns++; mm.set(ym, m); }
  const closedList = stocks.filter((s) => s.status === 'Closed' && s.sells > 0);
  return { txns, stocks, months: [...mm.values()].sort((a, b) => a.ym.localeCompare(b.ym)),
    summary: { txns: txns.length, stocks: stocks.length, closed: closedList.length, open: stocks.length - closedList.length, realised: stocks.reduce((s, x) => s + x.realised, 0), wins: closedList.filter((s) => s.realised > 0).length, losses: closedList.filter((s) => s.realised <= 0).length } };
}
