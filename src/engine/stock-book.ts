// Paper book mechanics for the first-wave stock books (Engine Rules C-139, C-159, C-175, C-178). Pure: no files, no network, no clock.
// One night = stepBook(): (1) fill what was decided on an earlier close at tonight's open, (2) credit cash and mark at tonight's close,
// check stops on tonight's close (the sale is filled at a LATER session's open), (3) ask the strategy for tomorrow's orders.
// Costs are the registered tier costs (half each way); a second running total carries the C-178 slippage sensitivity (0.1% each way, never a decision input).
export const BOOK = { startValue: 100, weight: 0.05, maxNames: 20, shortStopCap: 0.08, atrMult: 3, longStop: 0.25, slipEachWay: 0.001 };

export interface Pos { sh: number; entry: number; entryDate: string; high: number; stop: number }
export interface Closed { sym: string; entryDate: string; exitDate: string; entry: number; exit: number; ret: number; why: 'stop' | 'rule' }
export interface Buy { sym: string; value: number; stop: number }
export interface Pending { signalDate: string; buys: Buy[]; sells: string[] }
export interface BookState {
  id: string; startAfter: string; cash: number; pos: Record<string, Pos>; lastValue: Record<string, number>;
  pending: Pending | null; stopQueue: Array<{ sym: string; on: string }>; closed: Closed[];
  daily: Array<{ d: string; v: number; vs: number }>; skipped: Array<{ date: string; sym: string; width: number }>;
  slipCum: number; cashDays: { credited: number; missing: number }; started: string | null; lastSignal: string | null; lastStep: string | null;
}
export const newBook = (id: string, startAfter: string): BookState => ({ id, startAfter, cash: BOOK.startValue, pos: {}, lastValue: {}, pending: null, stopQueue: [], closed: [], daily: [], skipped: [], slipCum: 0, cashDays: { credited: 0, missing: 0 }, started: null, lastSignal: null, lastStep: null });

/** Stop width for a short-hold entry (C-159): 3 x ATR(20) over the signal close, 8% at most. null = the signal is skipped (3 x ATR is wider than 8%). */
export function shortStop(atr20: number, close: number): number | null {
  if (!(atr20 > 0) || !(close > 0)) return null;
  const w = BOOK.atrMult * atr20 / close;
  return w <= BOOK.shortStopCap ? w : null;
}

export interface Env {
  D: string;
  open: (sym: string) => number;            // tonight's open, NaN when none stored
  close: (sym: string) => number;           // latest close at or before tonight, NaN when none
  cashRet: number | null;                   // liquid-fund daily return for tonight, null when the NAV series has no figure
  tier: (value: number) => number;          // round-trip cost fraction by traded-value tier (registered costs)
  signal: (held: Set<string>, st: BookState) => { buys: Buy[]; sells: string[] } | null;
}
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;

export function stepBook(st: BookState, e: Env): BookState {
  const D = e.D; if (st.lastStep === D) return st;
  const px = (s: string): number => { const o = e.open(s); return o > 0 ? o : e.close(s); };
  // 1) fills at tonight's open: stop sales queued on an earlier close, rule sales and buys decided on an earlier close
  const dueStops = st.stopQueue.filter((q) => q.on < D).map((q) => q.sym), pend = st.pending && st.pending.signalDate < D ? st.pending : null;
  if (dueStops.length || pend) {
    const sells = new Map<string, 'stop' | 'rule'>(); for (const s of dueStops) sells.set(s, 'stop'); for (const s of pend?.sells ?? []) if (!sells.has(s)) sells.set(s, 'rule');
    let traded = 0;
    for (const [sym, why] of sells) {
      const p = st.pos[sym], x = px(sym); if (!p || !(x > 0)) continue;
      const gross = p.sh * x; st.cash += gross - gross * e.tier(st.lastValue[sym] ?? 0) / 2; traded += gross; st.slipCum += gross * BOOK.slipEachWay;
      st.closed.push({ sym, entryDate: p.entryDate, exitDate: D, entry: p.entry, exit: r4(x), ret: r4(x / p.entry - 1), why }); delete st.pos[sym];
    }
    st.stopQueue = st.stopQueue.filter((q) => q.on >= D);
    if (pend) {
      let V = st.cash; for (const [s, p] of Object.entries(st.pos)) { const x = px(s); V += p.sh * (x > 0 ? x : 0); }
      for (const b of pend.buys) {
        const x = px(b.sym); if (!(x > 0) || st.pos[b.sym]) continue;
        const amt = Math.min(BOOK.weight * V, st.cash / (1 - e.tier(b.value) / 2)); if (!(amt > 0)) continue;
        const cost = amt * e.tier(b.value) / 2; st.cash -= amt; traded += amt; st.slipCum += amt * BOOK.slipEachWay; st.lastValue[b.sym] = b.value;
        st.pos[b.sym] = { sh: (amt - cost) / x, entry: x, entryDate: D, high: x, stop: b.stop };
      }
      st.started ??= D; st.pending = null;
    }
  }
  // 2) credit cash at the liquid-fund rate, mark at the close, check stops on the close
  if (st.started) {
    if (e.cashRet === null) st.cashDays.missing++; else { st.cash *= 1 + e.cashRet; st.cashDays.credited++; }
    let v = st.cash; for (const [s, p] of Object.entries(st.pos)) { const c = e.close(s); v += p.sh * (c > 0 ? c : p.entry); }
    st.daily.push({ d: D, v: r4(v), vs: r4(v - st.slipCum) });
    for (const [s, p] of Object.entries(st.pos)) {
      const c = e.close(s); if (!(c > 0)) continue; p.high = Math.max(p.high, c);
      if (c <= (1 - p.stop) * p.high && !st.stopQueue.some((q) => q.sym === s)) st.stopQueue.push({ sym: s, on: D });
    }
  }
  // 3) tomorrow's orders; a name already queued for a stop sale is not sold twice
  if (!st.pending && D > st.startAfter) {
    const out = e.signal(new Set(Object.keys(st.pos)), st);
    if (out && (out.buys.length || out.sells.length)) { st.pending = { signalDate: D, buys: out.buys, sells: out.sells }; st.lastSignal = D; }
  }
  st.lastStep = D; return st;
}

/** Month-end values of the registered line and the sensitivity line, for the scorecard. */
export const monthlyValues = (st: BookState): Array<{ m: string; d: string; v: number; vs: number }> => {
  const out = new Map<string, { m: string; d: string; v: number; vs: number }>();
  for (const x of st.daily) out.set(x.d.slice(0, 7), { m: x.d.slice(0, 7), d: x.d, v: x.v, vs: x.vs });
  return [...out.values()];
};
