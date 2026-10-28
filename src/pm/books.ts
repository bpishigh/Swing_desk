// Book inference (design section 3): every open lot gets a book and the rule that put it there. No hand tagging.
// Liquidity is empty unless the owner enters a buffer (none is assumed). Direct stocks start as Legacy. A lot becomes Swing only by promotion
// or by a buy that matches a saved nightly shortlist (the Swing Desk saves each night's shortlist under data/india/shortlist).
import type { Lot } from './ledger.ts';
import type { AssetType } from './classify.ts';
import { sessionsBetween, type Match } from './shortlist.ts';
export type Book = 'Swing' | 'Legacy' | 'Long-term' | 'Liquidity';
export interface SwingInfo { tier: 'exact' | 'near-confirmed'; setup: string; stop: number; trigger: number; limit: number; signalDate: string }
export interface Tagged { lot: Lot; book: Book; rule: string; swing?: SwingInfo; proposal?: Match }
export interface BookContext {
  typeOf: (key: string) => AssetType;
  isFund: (key: string) => boolean;
  isEtf?: (key: string) => boolean;             // any listed ETF (index, gold, silver, international, sector): Long-term, never under the stock exit test
  promoted?: Set<string>;                       // `${key}|${buyDate}` of lots the system promoted
  shortlistMatch?: (key: string, buyDate: string) => boolean;   // bought on a saved shortlist, inside trigger and limit
  /** Matches a buy against the saved shortlists (src/pm/shortlist.ts). `answer` is the owner's earlier yes or no to a near match. */
  swingMatch?: (lot: Lot) => (Match & { answer?: 'yes' | 'no' }) | null;
  swingGoLive?: string | null;                  // date the Swing Desk began saving shortlists
  buffer?: { amount: number } | null;
  /** A Swing lot older than `sessions` sessions at `today` is shown as Legacy (design section 3, Swing to Legacy). The only trigger: never a hand-entered note. */
  maxHold?: { sessions: number; today: string; cal?: { holidays?: string[]; extra?: string[] } };
}
export function inferBooks(open: Lot[], ctx: BookContext): Tagged[] {
  return open.map((t0) => ageOut(inferOne(t0, ctx), ctx));
}
function ageOut(t: Tagged, ctx: BookContext): Tagged {
  const h = ctx.maxHold; if (!h || t.book !== 'Swing' || !(h.sessions > 0)) return t;
  const n = sessionsBetween(t.lot.date, h.today, h.cal); if (n <= h.sessions) return t;
  return { ...t, book: 'Legacy', rule: `rule 3: held ${n} sessions, past the ${h.sessions}-session maximum hold, so this lot is shown in Legacy (was: ${t.rule.replace(/^rule 4: /, '')})` };
}
function inferOne(lot: Lot, ctx: BookContext): Tagged {
  {
    if (ctx.isFund(lot.key)) return { lot, book: 'Long-term' as Book, rule: 'rule 2: mutual funds and fund-like holdings are Long-term' };
    const t = ctx.typeOf(lot.key);
    if (t === 'gold_silver_etf' || t === 'intl_etf' || ctx.isEtf?.(lot.key)) return { lot, book: 'Long-term' as Book, rule: 'rule 2: ETFs other than direct equity are Long-term' };
    if (ctx.promoted?.has(`${lot.key}|${lot.date}`)) return { lot, book: 'Swing' as Book, rule: 'rule 4: promoted by the system (passed the screen, stop set)' };
    if (ctx.swingGoLive && lot.date >= ctx.swingGoLive && ctx.shortlistMatch?.(lot.key, lot.date)) return { lot, book: 'Swing' as Book, rule: 'rule 4: bought on that night\'s shortlist inside trigger and limit' };
    if (ctx.swingGoLive && lot.date >= ctx.swingGoLive && ctx.swingMatch) {
      const m = ctx.swingMatch(lot);
      if (m) {
        const info = (tier: SwingInfo['tier']): SwingInfo => ({ tier, setup: m.line.setup, stop: m.line.stop, trigger: m.line.trigger, limit: m.line.limit, signalDate: m.line.signalDate });
        if (m.tier === 'exact') return { lot, book: 'Swing' as Book, rule: 'rule 4: ' + m.why, swing: info('exact') };
        if (m.answer === 'yes') return { lot, book: 'Swing' as Book, rule: 'rule 4: near match confirmed by the owner: ' + m.why, swing: info('near-confirmed') };
        if (m.answer !== 'no') return { lot, book: 'Legacy' as Book, rule: 'rule 3: direct stocks start as Legacy (a near Swing match is waiting for your answer)', proposal: m };
      }
    }
    return { lot, book: 'Legacy' as Book, rule: 'rule 3: direct stocks start as Legacy' };
  }
}
export function bookTotals(tagged: Tagged[], price: (key: string) => number | undefined): Record<Book, { cost: number; value: number; lots: number }> {
  const out = { Swing: { cost: 0, value: 0, lots: 0 }, Legacy: { cost: 0, value: 0, lots: 0 }, 'Long-term': { cost: 0, value: 0, lots: 0 }, Liquidity: { cost: 0, value: 0, lots: 0 } };
  for (const t of tagged) { const b = out[t.book]; b.cost += t.lot.qty * t.lot.unitCost; b.value += t.lot.qty * (price(t.lot.key) ?? t.lot.unitCost); b.lots++; }
  return out;
}

export interface SaleGroup { key: string; date: string; qty: number; buyDates: string[]; avgPrice: number }
export interface SaleProposal { key: string; date: string; qty: number; avgPrice: number; swingDate: string; swingQty: number }
/** Which book a sale came from (design section 3). The tax replay sells the oldest lot first, and that stays. But if you sold a stock after opening a Swing trade in it and the oldest-first sale used older lots,
 * the Swing lot still shows open although the sale may have been your Swing exit. Each such sale is put to the owner; "yes" moves that many units of the Swing lot to Legacy (the book view only: tax is untouched),
 * "no" leaves it, no answer leaves it and lists the question. `answers` is keyed `sale:<key>|<sale date>` with 'yes' or 'no'. */
export interface SwingExit { key: string; buyDate: string; date: string; qty: number; price: number }
/** `flag(lot, sale)`: a reason when the Swing Desk's exit (a close at or below the lot's stop) was flagged within the last few sessions before the sale; an unanswered sale with a flag is taken as the Swing exit without asking (design section 3, partial sells). The owner's own 'no' still wins. */
export type ExitFlag = (t: Tagged, g: SaleGroup) => string | null;
export function attributeSales(tagged: Tagged[], sells: SaleGroup[], answers: Record<string, 'yes' | 'no'>, flag?: ExitFlag): { tagged: Tagged[]; proposals: SaleProposal[]; exits: SwingExit[] } {
  const out: Tagged[] = tagged.map((t) => ({ ...t })), proposals: SaleProposal[] = [], exits: SwingExit[] = [];
  const keys = new Set(out.filter((t) => t.book === 'Swing').map((t) => t.lot.key));
  for (const key of keys) {
    const groups = sells.filter((g) => g.key === key).sort((a, b) => a.date.localeCompare(b.date));
    for (const g of groups) {
      const eligible = (): Tagged[] => out.filter((t) => t.book === 'Swing' && t.lot.key === key && t.lot.date < g.date && !g.buyDates.includes(t.lot.date)).sort((a, b) => a.lot.date.localeCompare(b.lot.date));
      if (!eligible().length) continue;                                   // the sale already used the Swing lot, or happened before it
      const ans = answers[`sale:${key}|${g.date}`];
      if (ans === 'no') continue;
      const auto = ans === undefined && flag ? flag(eligible()[0], g) : null;
      if (ans !== 'yes' && !auto) { const e = eligible()[0]; proposals.push({ key, date: g.date, qty: g.qty, avgPrice: g.avgPrice, swingDate: e.lot.date, swingQty: e.lot.qty }); continue; }
      let left = g.qty;
      for (const t of eligible()) {
        if (left <= 1e-9) break;
        const take = Math.min(t.lot.qty, left); left -= take; exits.push({ key, buyDate: t.lot.date, date: g.date, qty: take, price: g.avgPrice });
        const idx = out.indexOf(t), moved: Tagged = { lot: { ...t.lot, qty: take }, book: 'Legacy', rule: `rule 3: ${take} of these units were your Swing trade, sold on ${g.date} ${auto ? `(${auto})` : '(you said so)'}; the tax view still sells the oldest lot first` };
        if (take >= t.lot.qty - 1e-9) out[idx] = moved;
        else { out[idx] = { ...t, lot: { ...t.lot, qty: t.lot.qty - take } }; out.push(moved); }
      }
    }
  }
  return { tagged: out, proposals, exits };
}
