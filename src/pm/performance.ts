// Performance: XIRR on dated cash flows (money out at buys, in at sells, dividends, and today's value of what is still held).
// Price-only and with-dividends are both reported, because dividends are computed entitlements and labelled as such.
export interface Flow { date: string; amount: number }
const D = (d: string) => Date.parse(d) / 86400000;

export function xirr(flows: Flow[]): number | null {
  const fl = flows.filter((f) => f.amount !== 0).sort((a, b) => a.date.localeCompare(b.date));
  if (fl.length < 2 || !fl.some((f) => f.amount < 0) || !fl.some((f) => f.amount > 0)) return null;
  const t0 = D(fl[0].date), n = fl.length, amt = new Float64Array(n), yrs = new Float64Array(n);       // year fractions once, not on every step
  for (let i = 0; i < n; i++) { amt[i] = fl[i].amount; yrs[i] = (D(fl[i].date) - t0) / 365; }
  const f = (r: number) => { const l = Math.log1p(r); let s = 0; for (let i = 0; i < n; i++) s += amt[i] * Math.exp(-yrs[i] * l); return s; };
  let lo = -0.9999, hi = 10, flo = f(lo);                                    // bisection: f is decreasing in r when the first flow is an outflow
  if (flo * f(hi) > 0) return null;
  for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2, fm = f(mid); if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; } }
  return (lo + hi) / 2;
}

export interface PerfInput {
  orders: { date: string; side: 'buy' | 'sell'; value: number; charges?: number }[];
  dividends?: { date: string; net: number }[];
  holdingsValue: number; asOf: string;
}
export interface Perf { invested: number; sold: number; held: number; dividends: number; gain: number; xirrPriceOnly: number | null; xirrWithDividends: number | null; asOf: string }

export function performance(i: PerfInput): Perf {
  const flows: Flow[] = i.orders.map((o) => ({ date: o.date, amount: o.side === 'buy' ? -(o.value + (o.charges ?? 0)) : o.value - (o.charges ?? 0) }));
  const end: Flow = { date: i.asOf, amount: i.holdingsValue };
  const divs = (i.dividends ?? []).map((d) => ({ date: d.date, amount: d.net }));
  const invested = i.orders.filter((o) => o.side === 'buy').reduce((a, o) => a + o.value + (o.charges ?? 0), 0);
  const sold = i.orders.filter((o) => o.side === 'sell').reduce((a, o) => a + o.value - (o.charges ?? 0), 0);
  const dsum = divs.reduce((a, d) => a + d.amount, 0);
  return { invested, sold, held: i.holdingsValue, dividends: dsum, gain: sold + i.holdingsValue - invested, xirrPriceOnly: xirr([...flows, end]), xirrWithDividends: xirr([...flows, ...divs, end]), asOf: i.asOf };
}
