// Legacy book (India holdings bought before the desk): price, give-back and the per-holding advice text.
// Implements Engine Rules "Legacy book" (own 3% give-back budget, trail to the higher of 10-week average and swing low,
// tighten first and trim second, 20% position cap, sector limit of 3, stops never move down).
// Ported from app v9 (legacyKept, legacyPrice, legacyGiveBack, legacyRow advice). Pure: the caller supplies feed prices.
import { px } from './format.ts';
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export interface LegacyDoc {
  symbol?: string; stock?: string; qty: number; avg: number; price?: number; close?: number; priceDate?: string;
  stop?: number; wk10?: number; swingLow?: number; status?: string; bucket?: string; sector?: string;
}
export interface FeedStock { close?: number; date?: string; sma50?: number; sma200?: number }

export const legacyKept = (docs: LegacyDoc[]): LegacyDoc[] => docs.filter((l) => l.status === 'pass');

/** The feed close if it is newer than the price the user last typed, otherwise the typed price (or the report close). */
export function legacyPrice(l: LegacyDoc, f?: FeedStock | null): number {
  if (f && ok(f.close) && (!l.priceDate || l.priceDate < (f.date as string))) return f.close;
  return l.price || l.close || NaN; // v9: num(price)||num(close); 0 and NaN fall through
}

/** Sum of qty x (price - stop) over kept holdings, floored at 0 each; compare with 3% of capital. */
export function legacyGiveBack(docs: LegacyDoc[], feed: (sym: string) => FeedStock | null | undefined): number {
  return legacyKept(docs).reduce((s, l) => {
    const p = legacyPrice(l, feed(l.symbol as string)); const st = l.stop;
    return s + (ok(p) && ok(st) ? l.qty * Math.max(0, p - st) : 0);
  }, 0);
}

export interface LegacyAdvice {
  price: number; gain: number; s200: number; stopSuggest: number; giveBackPct: number; below200: boolean; todo: string;
}
/** `counts` = kept/open/planned positions per sector (the desk's sector counter). */
export function legacyAdvice(l: LegacyDoc, f: FeedStock | null | undefined, cap: number, sectorCounts: Record<string, number>, market: 'india' | 'us' = 'india'): LegacyAdvice {
  const P = (n: number) => px(market, n);
  const fnew = !!(f && ok(f.close) && (!l.priceDate || l.priceDate < (f.date as string)));
  const p = fnew ? (f!.close as number) : (l.price || l.close || NaN);
  const cost = l.qty * l.avg, val = l.qty * p, gain = val - cost;
  const s200 = f && ok(f.sma200) ? f.sma200 : NaN;
  const st = l.stop;
  const wk = ok(l.wk10) ? l.wk10 : f && ok(f.sma50) ? f.sma50 : NaN;
  const sw = l.swingLow;
  const suggest = Math.max(ok(st) ? st : -Infinity, ok(wk) ? wk : -Infinity, ok(sw) ? sw : -Infinity);
  const gbv = ok(st) ? l.qty * Math.max(0, p - st) : NaN;
  const gbp = ok(gbv) ? (gbv / cap) * 100 : NaN;
  const status = l.status || 'unchecked';
  const below200 = ok(s200) && ok(p) && p < s200;
  let todo = '';
  if (status === 'unchecked') {
    todo = (below200 ? `Close ${P(p)} is below its 200 SMA ${P(s200)}: fails condition 1 of the exit test. ` : ok(s200) ? `Above its 200 SMA ${P(s200)}; check the last swing low on the chart. ` : '')
      + (gain < 0 ? 'At a loss: sell now unless it passes the full entry test.' : 'Run the exit test.');
  } else if (status === 'fail') {
    todo = gain < 0 || l.bucket === 'Sell now' ? 'Sell now.'
      : l.bucket === 'Sell this FY' ? "Sell by 25 Mar 2027 (this FY's exemption)."
      : l.bucket === 'Sell from Apr 2027' ? 'Sell from 1 Apr 2027; meanwhile GTT stop at the last swing low.' : 'Sell.';
  } else if (status === 'exited') todo = 'Exited.';
  else {
    const parts: string[] = [];
    if (!ok(st)) parts.push('Set a GTT stop just under the higher of the swing low and the 200 SMA.');
    if (ok(suggest) && ok(st) && suggest > st) parts.push(`Raise the stop to ${P(suggest)}.`);
    if (ok(gbp) && gbp > 1) { const maxQty = Math.floor((cap * 0.01) / Math.max(0.01, p - (st as number))); parts.push(`Give-back ${gbp.toFixed(2)}% is above 1%: tighten, or trim to ${maxQty} shares.`); }
    if (val > cap * 0.2) parts.push(`Above 20% of capital: trim to ${Math.floor((cap * 0.2) / p)} shares.`);
    const c = sectorCounts[l.sector as string] || 0;
    if (c > 3) parts.push(`${l.sector} has ${c} kept/open positions: keep at most 3.`);
    todo = parts.length ? parts.join(' ') : `Keep. GTT at ${P(st as number)}; trail weekly.`;
  }
  return { price: p, gain, s200, stopSuggest: suggest, giveBackPct: gbp, below200, todo };
}
