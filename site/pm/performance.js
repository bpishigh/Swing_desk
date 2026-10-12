// Performance: XIRR on dated cash flows (money out at buys, in at sells, dividends, and today's value of what is still held).
// Price-only and with-dividends are both reported, because dividends are computed entitlements and labelled as such.
                                                      
const D = (d        ) => Date.parse(d) / 86400000;

export function xirr(flows        )                {
  const fl = flows.filter((f) => f.amount !== 0).sort((a, b) => a.date.localeCompare(b.date));
  if (fl.length < 2 || !fl.some((f) => f.amount < 0) || !fl.some((f) => f.amount > 0)) return null;
  const t0 = D(fl[0].date), f = (r        ) => fl.reduce((a, c) => a + c.amount / Math.pow(1 + r, (D(c.date) - t0) / 365), 0);
  let lo = -0.9999, hi = 10;                                                 // bisection: f is decreasing in r when the first flow is an outflow
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; (f(lo) * f(mid) <= 0) ? (hi = mid) : (lo = mid); }
  return (lo + hi) / 2;
}

                            
                                                                                    
                                              
                                      
 
                                                                                                                                                                                     

export function performance(i           )       {
  const flows         = i.orders.map((o) => ({ date: o.date, amount: o.side === 'buy' ? -(o.value + (o.charges ?? 0)) : o.value - (o.charges ?? 0) }));
  const end       = { date: i.asOf, amount: i.holdingsValue };
  const divs = (i.dividends ?? []).map((d) => ({ date: d.date, amount: d.net }));
  const invested = i.orders.filter((o) => o.side === 'buy').reduce((a, o) => a + o.value + (o.charges ?? 0), 0);
  const sold = i.orders.filter((o) => o.side === 'sell').reduce((a, o) => a + o.value - (o.charges ?? 0), 0);
  const dsum = divs.reduce((a, d) => a + d.amount, 0);
  return { invested, sold, held: i.holdingsValue, dividends: dsum, gain: sold + i.holdingsValue - invested, xirrPriceOnly: xirr([...flows, end]), xirrWithDividends: xirr([...flows, ...divs, end]), asOf: i.asOf };
}
