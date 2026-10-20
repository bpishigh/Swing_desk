// Every trade in an account, as the broker statements show it: a transaction list, one summary per stock, and monthly totals. Display only; no rule uses it.
// Realised gain on a sale comes from the tax replay (oldest lot first), so it matches the Tax tab. Nothing here is stored anywhere.
import type { Realised } from './ledger.ts';

export interface RawTxn { key: string; date: string; side: 'buy' | 'sell'; qty: number; price: number }
export interface Txn { key: string; name: string; kind: 'Stock' | 'ETF' | 'Fund'; book: string; date: string; side: 'buy' | 'sell'; qty: number; price: number; value: number; gain: number | null }
export interface StockHist {
  key: string; name: string; kind: Txn['kind']; book: string; status: 'Open' | 'Partly sold' | 'Closed';
  boughtQty: number; soldQty: number; heldQty: number; avgBuy: number; avgSell: number | null; invested: number; proceeds: number; realised: number;
  firstBuy: string; lastSell: string | null; buys: number; sells: number; held: boolean; days: number;
  /** True when the statements hold no buy of this stock (shares that arrived by demerger, bonus, grant or an earlier statement): its cost and first date are then unknown. */
  noBuy: boolean;
  /** False when any sale has no cost basis from the replay (so the realised figure is incomplete). */
  gainKnown: boolean;
  /** Trading symbol for a stock (to find its stored prices); empty for a fund. */
  sym: string;
}
export interface Month { ym: string; bought: number; sold: number; realised: number; txns: number }
export interface History { txns: Txn[]; stocks: StockHist[]; months: Month[]; summary: { txns: number; stocks: number; closed: number; open: number; realised: number; wins: number; losses: number } }

const EPS = 1e-6;
const days = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
/** `bookOf` and `kindOf` and `nameOf` come from the pipeline (the book a stock sits in now, its type, its full name). `today` closes the holding period of an open stock. */
export function tradeHistory(raw: RawTxn[], realised: Realised[], nameOf: (k: string) => string, kindOf: (k: string) => Txn['kind'], bookOf: (k: string) => string, today: string, openQty?: Map<string, number>, symOf?: (k: string) => string): History {
  // Units still held come from the tax replay (it knows splits, bonuses and demergers); a stock the replay never saw falls back to buys minus sells.
  const replayKeys = new Set<string>([...(openQty?.keys() ?? []), ...realised.map((r) => r.key)]);
  // realised gain per sale day and stock, shared across that day's sell lines by quantity
  const rg = new Map<string, { gain: number; qty: number }>();
  for (const r of realised) { const k = `${r.key}|${r.sellDate}`, g = rg.get(k) ?? { gain: 0, qty: 0 }; g.gain += r.gain; g.qty += r.qty; rg.set(k, g); }
  const dayQty = new Map<string, number>(), dayVal = new Map<string, number>();
  for (const t of raw) if (t.side === 'sell') { const k = `${t.key}|${t.date}`; dayQty.set(k, (dayQty.get(k) ?? 0) + t.qty); dayVal.set(k, (dayVal.get(k) ?? 0) + t.qty * t.price); }
  const txns: Txn[] = raw.filter((t) => t.qty > 0 && Number.isFinite(t.price)).map((t) => {
    let gain: number | null = null;
    // Sales of one stock on one day share the replay's figure: cost is spread by units, so each line's gain follows its own price.
    if (t.side === 'sell') { const k = `${t.key}|${t.date}`, g = rg.get(k), dq = dayQty.get(k) ?? 0, dv = dayVal.get(k) ?? 0; gain = g && dq > 0 ? t.qty * t.price - (dv - g.gain) * (t.qty / dq) : null; }
    return { key: t.key, name: nameOf(t.key), kind: kindOf(t.key), book: bookOf(t.key), date: t.date, side: t.side, qty: t.qty, price: t.price, value: t.qty * t.price, gain };
  }).sort((a, b) => a.date.localeCompare(b.date) || (a.side === b.side ? 0 : a.side === 'buy' ? -1 : 1));
  const by = new Map<string, Txn[]>(); for (const t of txns) (by.get(t.key) ?? by.set(t.key, []).get(t.key)!).push(t);
  const stocks: StockHist[] = [...by].map(([key, ts]) => {
    const buys = ts.filter((t) => t.side === 'buy'), sells = ts.filter((t) => t.side === 'sell');
    const bq = buys.reduce((s, t) => s + t.qty, 0), sq = sells.reduce((s, t) => s + t.qty, 0), inv = buys.reduce((s, t) => s + t.value, 0), pro = sells.reduce((s, t) => s + t.value, 0);
    const held = replayKeys.has(key) ? (openQty?.get(key) ?? 0) : Math.max(0, bq - sq), closed = held <= EPS, first = ts[0].date, lastSell = sells.length ? sells[sells.length - 1].date : null;
    return { key, name: ts[0].name, kind: ts[0].kind, book: ts[0].book, status: closed ? 'Closed' as const : sq > 0 ? 'Partly sold' as const : 'Open' as const, boughtQty: bq, soldQty: sq, heldQty: held, avgBuy: bq > 0 ? inv / bq : 0, avgSell: sq > 0 ? pro / sq : null, invested: inv, proceeds: pro, realised: sells.reduce((s, t) => s + (t.gain ?? 0), 0), firstBuy: first, lastSell, noBuy: buys.length === 0, gainKnown: sells.every((t) => t.gain !== null), sym: symOf?.(key) ?? '', buys: buys.length, sells: sells.length, held: held > EPS, days: days(first, closed && lastSell ? lastSell : today) };
  }).sort((a, b) => (b.lastSell ?? b.firstBuy).localeCompare(a.lastSell ?? a.firstBuy));
  const mm = new Map<string, Month>();
  for (const t of txns) { const ym = t.date.slice(0, 7), m = mm.get(ym) ?? { ym, bought: 0, sold: 0, realised: 0, txns: 0 }; if (t.side === 'buy') m.bought += t.value; else { m.sold += t.value; m.realised += t.gain ?? 0; } m.txns++; mm.set(ym, m); }
  const closedList = stocks.filter((s) => s.status === 'Closed' && s.sells > 0);
  return { txns, stocks, months: [...mm.values()].sort((a, b) => a.ym.localeCompare(b.ym)),
    summary: { txns: txns.length, stocks: stocks.length, closed: closedList.length, open: stocks.length - closedList.length, realised: stocks.reduce((s, x) => s + x.realised, 0), wins: closedList.filter((s) => s.realised > 0).length, losses: closedList.filter((s) => s.realised <= 0).length } };
}
