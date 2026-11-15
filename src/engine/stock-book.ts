// Paper book mechanics for the first-wave stock books (Engine Rules C-139, C-159, C-175, C-178). Pure: no files, no network, no clock.
// One night = stepBook(): (1) fill what was decided on an earlier close at tonight's open, (2) credit cash and mark at tonight's close,
// check stops on tonight's close (the sale is filled at a LATER session's open), (3) ask the strategy for tomorrow's orders.
// Costs are the registered tier costs (half each way); a second running total carries the C-178 slippage sensitivity (0.1% each way, never a decision input).
export const BOOK = { goneSessions: 5, startValue: 100, weight: 0.05, maxNames: 20, shortStopCap: 0.08, atrMult: 3, longStop: 0.25, slipEachWay: 0.001 };

export interface Pos { sh: number; entry: number; entryDate: string; high: number; stop: number; fixStop?: number; stop0?: number; half?: boolean; m50?: number }   // fixStop..m50: only for SEPA-mode books (st.risk set): a fixed stop price, the first stop, the half-sale flag, last night's 50-day average
export interface Closed { sym: string; entryDate: string; exitDate: string; entry: number; exit: number; ret: number; why: 'stop' | 'rule' | 'gone'; part?: boolean }
export interface Buy { sym: string; value: number; stop: number; stopPx?: number }   // stopPx: absolute stop price (SEPA mode)
export interface Pending { signalDate: string; buys: Buy[]; sells: string[] }
export interface BookState {
  id: string; startAfter: string; cash: number; pos: Record<string, Pos>; lastValue: Record<string, number>;
  pending: Pending | null; stopQueue: Array<{ sym: string; on: string }>; closed: Closed[];
  daily: Array<{ d: string; v: number; vs: number; x?: number }>; skipped: Array<{ date: string; sym: string; width: number; why?: string }>;
  weight?: number; risk?: number; posCap?: number; mvFail?: Record<string, number>; sepaLast?: Record<string, number>; sepaCounts?: Record<string, Record<string, number>>; slipCum: number; costs?: Record<string, number>; distCredit?: number; cashDays: { credited: number; missing: number }; started: string | null; lastSignal: string | null; lastStep: string | null;
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
  age?: (sym: string) => number;            // sessions since the name last had a close; a name with none for goneSessions is closed at its last close (delisted, acquired, suspended)
  dist?: (sym: string) => number;           // confirmed spin-off or special-dividend value per share with ex-date tonight (C-179 item 9a); credited to cash and taken off the trailing high BEFORE the stop is tested
  blocked?: (sym: string) => boolean;       // split-guard (C-179 item 9c): no buy, no sale at a doubtful price, no stop test while the move is unresolved
  bar?: (sym: string) => { o: number; h: number; l: number } | null;   // tonight's open, high and low (SEPA-mode books: intraday stop and half sale)
  sma50?: (sym: string) => number;   // tonight's 50-day average of closes
  bigFall?: (sym: string) => boolean;   // tonight's one-day fall is the largest since the stock's 52-week low
  tier: (value: number) => number;          // round-trip cost fraction by traded-value tier (registered costs)
  signal: (held: Set<string>, st: BookState) => { buys: Buy[]; sells: string[] } | null;
}
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;

export function stepBook(st: BookState, e: Env): BookState {
  const D = e.D; if (st.lastStep === D) return st;
  const px = (s: string): number => { const o = e.open(s); return o > 0 ? o : e.close(s); };
  // 1) fills at tonight's open: stop sales queued on an earlier close, rule sales and buys decided on an earlier close
  const gone = Object.keys(st.pos).filter((s) => (e.age?.(s) ?? 0) >= BOOK.goneSessions), dueStops = st.stopQueue.filter((q) => q.on < D).map((q) => q.sym), pend = st.pending && st.pending.signalDate < D ? st.pending : null;
  if (gone.length || dueStops.length || pend) {
    const sells = new Map<string, 'stop' | 'rule' | 'gone'>(); for (const s of gone) sells.set(s, 'gone'); for (const s of dueStops) if (!sells.has(s) && !e.blocked?.(s)) sells.set(s, 'stop'); for (const s of pend?.sells ?? []) if (!sells.has(s) && !e.blocked?.(s)) sells.set(s, 'rule');
    let traded = 0;
    for (const [sym, why] of sells) {
      const p = st.pos[sym], x = px(sym); if (!p || !(x > 0)) continue;
      const gross = p.sh * x; const c = gross * e.tier(st.lastValue[sym] ?? 0) / 2; st.cash += gross - c; (st.costs ??= {})[D.slice(0, 7)] = ((st.costs ??= {})[D.slice(0, 7)] ?? 0) + c; traded += gross; st.slipCum += gross * BOOK.slipEachWay;
      st.closed.push({ sym, entryDate: p.entryDate, exitDate: D, entry: p.entry, exit: r4(x), ret: r4(x / p.entry - 1), why }); delete st.pos[sym];
    }
    st.stopQueue = st.stopQueue.filter((q) => q.on >= D || e.blocked?.(q.sym));
    if (pend) {
      let V = st.cash; for (const [s, p] of Object.entries(st.pos)) { const x = px(s); V += p.sh * (x > 0 ? x : 0); }
      for (const b of pend.buys) {
        const x = px(b.sym); if (!(x > 0) || st.pos[b.sym] || e.blocked?.(b.sym)) continue;
        let stopPx: number | undefined, width = 0, amt: number;
        if (st.risk) {   // SEPA mode: size = risk / stop width, capped; a signal that finds too little cash is skipped and logged, never cut down
          stopPx = Math.max(b.stopPx ?? 0, 0.9 * x); width = (x - stopPx) / x; if (!(width > 0)) continue;
          amt = Math.min(st.risk * V / width, (st.posCap ?? 0.25) * V); if (st.cash / (1 - e.tier(b.value) / 2) < amt * 0.999) { st.skipped.push({ date: D, sym: b.sym, width, why: 'no cash' }); continue; }
        } else amt = Math.min((st.weight ?? BOOK.weight) * V, st.cash / (1 - e.tier(b.value) / 2));
        if (!(amt > 0)) continue;
        const cost = amt * e.tier(b.value) / 2; (st.costs ??= {})[D.slice(0, 7)] = ((st.costs ??= {})[D.slice(0, 7)] ?? 0) + cost; st.cash -= amt; traded += amt; st.slipCum += amt * BOOK.slipEachWay; st.lastValue[b.sym] = b.value;
        st.pos[b.sym] = { sh: (amt - cost) / x, entry: x, entryDate: D, high: x, stop: st.risk ? width : b.stop, ...(st.risk ? { fixStop: stopPx, stop0: stopPx } : {}) };
      }
      st.started ??= D; st.pending = null;
    }
  }
  // 1b) SEPA mode: tonight's stop and half sale from the stored daily bar. The stop is tested first (the low may come before the high); a gap below the stop fills at the open.
  if (st.risk && e.bar) for (const [s, p] of Object.entries(st.pos)) {
    if (p.fixStop == null || e.blocked?.(s)) continue; const b = e.bar(s); if (!b || !(b.l > 0)) continue;
    const sell = (x: number, sh: number, part: boolean, why: 'stop' | 'rule'): void => { const gross = sh * x, c = gross * e.tier(st.lastValue[s] ?? 0) / 2; st.cash += gross - c; (st.costs ??= {})[D.slice(0, 7)] = ((st.costs ??= {})[D.slice(0, 7)] ?? 0) + c; st.slipCum += gross * BOOK.slipEachWay; st.closed.push({ sym: s, entryDate: p.entryDate, exitDate: D, entry: p.entry, exit: r4(x), ret: r4(x / p.entry - 1), why, ...(part ? { part: true } : {}) }); };
    if (b.l <= p.fixStop && p.entryDate <= D) { const x = p.entryDate < D && b.o > 0 && b.o <= p.fixStop ? b.o : p.fixStop; sell(x, p.sh, false, 'stop'); delete st.pos[s]; st.stopQueue = st.stopQueue.filter((q) => q.sym !== s); continue; }
    const tgt = p.entry + 2 * (p.entry - (p.stop0 ?? p.fixStop)); if (!p.half && b.h >= tgt) { sell(b.o >= tgt && p.entryDate < D ? b.o : tgt, p.sh / 2, true, 'rule'); p.sh /= 2; p.half = true; p.fixStop = Math.max(p.fixStop, p.entry); }
  }
  // 2) credit cash at the liquid-fund rate, mark at the close, check stops on the close
  if (st.started) {
    for (const [s, p] of Object.entries(st.pos)) { const d = e.dist?.(s) ?? 0; if (d > 0) { st.cash += p.sh * d; p.high = Math.max(0, p.high - d); st.distCredit = (st.distCredit ?? 0) + p.sh * d; } }
    if (e.cashRet === null) st.cashDays.missing++; else { st.cash *= 1 + e.cashRet; st.cashDays.credited++; }
    let v = st.cash; for (const [s, p] of Object.entries(st.pos)) { const c = e.close(s); v += p.sh * (c > 0 ? c : p.entry); }
    st.daily.push({ d: D, v: r4(v), vs: r4(v - st.slipCum), x: v > 0 ? r4(1 - st.cash / v) : 0 });
    for (const [s, p] of Object.entries(st.pos)) {
      if (e.blocked?.(s)) continue;
      const c = e.close(s); if (!(c > 0)) continue; p.high = Math.max(p.high, c);
      if (p.fixStop != null) {   // SEPA mode: no trailing percent stop. 50-day rule: once the rising 50-day average is at or above the entry price it becomes the stop. Largest one-day fall since the 52-week low: sale at the next open.
        const m = e.sma50?.(s); if (m && m > 0) { if (m >= p.entry && p.m50 != null && m > p.m50) p.fixStop = Math.max(p.fixStop, m); p.m50 = m; }
        if (e.bigFall?.(s) && !st.stopQueue.some((q) => q.sym === s)) st.stopQueue.push({ sym: s, on: D });
        continue;
      }
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
