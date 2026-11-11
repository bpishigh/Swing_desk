// Volatility-targeted sleeve (Engine Rules C-167, US C-187). Pure. An overlay on the stopped parent's daily value series: at each review (the first session of a month) exposure is set to the target divided by the parent's
// annualised volatility over its last 60 daily returns, capped at 100%; the rest is cash at the cash rate. The parent's returns are used, not the overlay's own, as in volatility-managed portfolios (Moreira and Muir, 2017).
// Until 20 daily returns exist exposure is 100% (a build reading of the rule: it names a 60-session window and the parent is new). Scaling trades are charged at a stated one-way cost on the change in exposure.
export const VT = { target: 0.15, window: 60, minReturns: 20, days: 252 };
export interface VtState {
  id: string; startAfter: string; exposure: number | null; lastD: string | null; prevParent: number | null; rets: number[]; value: number;
  daily: Array<{ d: string; v: number; e: number }>; monthly: Record<string, { d: string; v: number }>; costs: Record<string, number>; cashDays: { credited: number; missing: number }; started: string | null; reviews: Array<{ d: string; e: number; vol: number | null }>;
}
export const newVt = (id: string, startAfter: string): VtState => ({ id, startAfter, exposure: null, lastD: null, prevParent: null, rets: [], value: 100, daily: [], monthly: {}, costs: {}, cashDays: { credited: 0, missing: 0 }, started: null, reviews: [] });
export function exposureFor(rets: number[], target = VT.target): { e: number; vol: number | null } {
  const r = rets.slice(-VT.window); if (r.length < VT.minReturns) return { e: 1, vol: null };
  const m = r.reduce((a, x) => a + x, 0) / r.length, sd = Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / (r.length - 1)), vol = sd * Math.sqrt(VT.days);
  return { e: vol > 0 ? Math.min(1, target / vol) : 1, vol };
}
/** Process every parent daily entry after the last one done. cashRetOn(d, prevD): the cash return for that session or null when there is no figure. oneWay: cost on the traded fraction of the book. */
export function stepVt(st: VtState, parent: Array<{ d: string; v: number }>, cashRetOn: (d: string, prev: string | null) => number | null, oneWay: number, target = VT.target): VtState {
  for (const p of parent) {
    if (st.lastD && p.d <= st.lastD) continue; if (p.d <= st.startAfter) continue;
    if (st.prevParent === null) { st.started = p.d; st.prevParent = p.v; st.lastD = p.d; st.exposure = 1; st.reviews.push({ d: p.d, e: 1, vol: null }); st.daily.push({ d: p.d, v: 100, e: 1 }); st.monthly[p.d.slice(0, 7)] = { d: p.d, v: 100 }; continue; }
    const r = p.v / st.prevParent - 1, newMonth = st.lastD !== null && p.d.slice(0, 7) !== st.lastD.slice(0, 7);
    if (newMonth) { const x = exposureFor(st.rets, target); const c = Math.abs(x.e - (st.exposure ?? 1)) * oneWay; if (c > 0) { st.value *= 1 - c; st.costs[p.d.slice(0, 7)] = (st.costs[p.d.slice(0, 7)] ?? 0) + c * 100; } st.exposure = x.e; st.reviews.push({ d: p.d, e: Math.round(x.e * 1e4) / 1e4, vol: x.vol === null ? null : Math.round(x.vol * 1e4) / 1e4 }); }
    const rc = cashRetOn(p.d, st.lastD); if (rc === null) st.cashDays.missing++; else st.cashDays.credited++;
    const e = st.exposure ?? 1; st.value *= 1 + e * r + (1 - e) * (rc ?? 0);
    st.rets.push(r); st.prevParent = p.v; st.lastD = p.d; st.daily.push({ d: p.d, v: Math.round(st.value * 1e4) / 1e4, e: Math.round(e * 1e4) / 1e4 }); st.monthly[p.d.slice(0, 7)] = { d: p.d, v: Math.round(st.value * 1e4) / 1e4 };
  }
  return st;
}
