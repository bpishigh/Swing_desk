// Per-account FIFO replay (tax view): lots, realised sales with holding period, and breaks (sells with no matching buy).
// Breaks are never filled with an invented cost: the resolver (design 7.3) closes them from dated, sourced records.
import type { Trade } from './reader.ts';

export interface Lot { key: string; date: string; qty: number; unitCost: number; source: Trade }
export interface Realised { key: string; buyDate: string; sellDate: string; qty: number; cost: number; proceeds: number; gain: number; days: number; long: boolean | null }
export interface Break { key: string; instrument: string; date: string; qty: number; proceeds: number }
export interface Replay { open: Lot[]; realised: Realised[]; breaks: Break[]; applied: string[] }

// Corporate events, applied on their ex-date before that day's trades. Each carries the record it rests on.
export type CorpEvent = { date: string; source: string; estimate?: boolean } & (
  | { type: 'split'; key: string; ratio: number }                                   // new shares per old; cost spread, holding period unchanged
  | { type: 'bonus'; key: string; num: number; den: number }                        // num bonus shares per den held; nil cost, holding from `date`
  | { type: 'demerger'; parent: string; child: string; ratio: number; costPct: number } // child shares per parent; costPct of parent cost moves; holding period inherited
  | { type: 'rename'; from: string; to: string }
  | { type: 'grant'; key: string; qty: number; unitCost: number; instrument?: string }  // IPO allotment or rights shares: dated, sourced, cost explicit
);

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const keyOf = (t: Trade) => t.isin || t.instrument.toUpperCase();

// `longAfterDays`: 365 for listed equity and equity funds (design section 7 rules table); null leaves the label unset.
export function replay(trades: Trade[], longAfterDays: number | null = 365, events: CorpEvent[] = []): Replay {
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.side === b.side ? 0 : a.side === 'buy' ? -1 : 1) || a.time.localeCompare(b.time));
  const lots = new Map<string, Lot[]>(); const realised: Realised[] = []; const breaks: Break[] = []; const applied: string[] = [];
  const evs = [...events].sort((a, b) => a.date.localeCompare(b.date)); let ei = 0;
  const Q = (k: string) => lots.get(k) ?? lots.set(k, []).get(k)!;
  const mk = (k: string, date: string, qty: number, unitCost: number, instrument = k): Lot => ({ key: k, date, qty, unitCost, source: { instrument, isin: k, side: 'buy', qty, price: unitCost, value: qty * unitCost, date, time: '', exchange: '', orderId: '', tradeId: '', kind: 'stock' } });
  const apply = (e: CorpEvent) => {
    applied.push(`${e.date} ${e.type} ${JSON.stringify(e)}`);
    if (e.type === 'split') for (const l of Q(e.key)) { l.qty *= e.ratio; l.unitCost /= e.ratio; }
    else if (e.type === 'bonus') { const held = Q(e.key).reduce((a, l) => a + l.qty, 0); const n = Math.floor((held * e.num) / e.den); if (n > 0) Q(e.key).push(mk(e.key, e.date, n, 0)); }
    else if (e.type === 'demerger') { for (const l of [...Q(e.parent)]) { const cq = l.qty * e.ratio; Q(e.child).push(mk(e.child, l.date, cq, (l.unitCost * l.qty * e.costPct) / cq)); l.unitCost *= 1 - e.costPct; } }
    else if (e.type === 'rename') { const from = Q(e.from); lots.set(e.to, [...Q(e.to), ...from.map((l) => ({ ...l, key: e.to }))].sort((a, b) => a.date.localeCompare(b.date))); lots.set(e.from, []); }
    else if (e.type === 'grant') Q(e.key).push(mk(e.key, e.date, e.qty, e.unitCost, e.instrument));
  };
  for (const t of ordered) {
    while (ei < evs.length && evs[ei].date <= t.date) apply(evs[ei++]);
    const k = keyOf(t); const q = Q(k);
    if (t.side === 'buy') { q.push({ key: k, date: t.date, qty: t.qty, unitCost: t.price, source: t }); continue; }
    let left = t.qty;
    while (left > 1e-9 && q.length) {
      const lot = q[0]; const take = Math.min(lot.qty, left);
      const d = days(lot.date, t.date);
      realised.push({ key: k, buyDate: lot.date, sellDate: t.date, qty: take, cost: take * lot.unitCost, proceeds: take * t.price, gain: take * (t.price - lot.unitCost), days: d, long: longAfterDays === null ? null : d > longAfterDays });
      lot.qty -= take; left -= take; if (lot.qty <= 1e-9) q.shift();
    }
    if (left > 1e-9) breaks.push({ key: k, instrument: t.instrument, date: t.date, qty: left, proceeds: left * t.price });
  }
  while (ei < evs.length) apply(evs[ei++]);
  return { open: [...lots.values()].flat(), realised, breaks, applied };
}
