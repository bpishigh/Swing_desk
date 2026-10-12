// Book inference (design section 3): every open lot gets a book and the rule that put it there. No hand tagging.
// Liquidity is empty unless the owner enters a buffer (none is assumed). Direct stocks start as Legacy. A lot becomes Swing only by promotion
// or by a buy that matches a saved nightly shortlist (needs the Swing Desk to save shortlists; none is stored yet, so no lot is Swing today).
import type { Lot } from './ledger.ts';
import type { AssetType } from './classify.ts';
export type Book = 'Swing' | 'Legacy' | 'Long-term' | 'Liquidity';
export interface Tagged { lot: Lot; book: Book; rule: string }
export interface BookContext {
  typeOf: (key: string) => AssetType;
  isFund: (key: string) => boolean;
  promoted?: Set<string>;                       // `${key}|${buyDate}` of lots the system promoted
  shortlistMatch?: (key: string, buyDate: string) => boolean;   // bought on a saved shortlist, inside trigger and limit
  swingGoLive?: string | null;                  // date the Swing Desk began saving shortlists
  buffer?: { amount: number } | null;
}
export function inferBooks(open: Lot[], ctx: BookContext): Tagged[] {
  return open.map((lot) => {
    if (ctx.isFund(lot.key)) return { lot, book: 'Long-term' as Book, rule: 'rule 2: mutual funds and fund-like holdings are Long-term' };
    const t = ctx.typeOf(lot.key);
    if (t === 'gold_silver_etf' || t === 'intl_etf') return { lot, book: 'Long-term' as Book, rule: 'rule 2: ETFs other than direct equity are Long-term' };
    if (ctx.promoted?.has(`${lot.key}|${lot.date}`)) return { lot, book: 'Swing' as Book, rule: 'rule 4: promoted by the system (passed the screen, stop set)' };
    if (ctx.swingGoLive && lot.date >= ctx.swingGoLive && ctx.shortlistMatch?.(lot.key, lot.date)) return { lot, book: 'Swing' as Book, rule: 'rule 4: bought on that night\'s shortlist inside trigger and limit' };
    return { lot, book: 'Legacy' as Book, rule: 'rule 3: direct stocks start as Legacy' };
  });
}
export function bookTotals(tagged: Tagged[], price: (key: string) => number | undefined): Record<Book, { cost: number; value: number; lots: number }> {
  const out = { Swing: { cost: 0, value: 0, lots: 0 }, Legacy: { cost: 0, value: 0, lots: 0 }, 'Long-term': { cost: 0, value: 0, lots: 0 }, Liquidity: { cost: 0, value: 0, lots: 0 } };
  for (const t of tagged) { const b = out[t.book]; b.cost += t.lot.qty * t.lot.unitCost; b.value += t.lot.qty * (price(t.lot.key) ?? t.lot.unitCost); b.lots++; }
  return out;
}
