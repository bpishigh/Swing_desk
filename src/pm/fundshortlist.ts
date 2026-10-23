// Which fund to buy inside an asset class (Engine Rules C-87). Pure. Uses the published FUND-3 rows (site/data/funds.json).
// Only Strong or Average funds, ranked by score then lower expense ratio; a fund already held that is on the list is preferred; the fund being sold is never the pick.
import type { TargetClass } from './allocation.ts';
import { looseKey } from './fundverdict.ts';
import { assetClassOf } from './assetclass.ts';

export interface PickRow { n: string; i?: string; c: string; s?: number | null; b?: string | null; t?: number | null; g: string; r3?: number | null }
export interface Pick { row: PickRow; held: boolean; why: string }

/** The categories the C-81 back-test counted as plain active equity. */
export const PLAIN_EQUITY = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
/** Not picked for new money: ELSS (3-year lock-in, so it cannot be moved later) global thematic funds and overseas debt funds (a bet on one theme, not an allocation to a market). They can still be held and scored. */
const LIQUID = /liquid|overnight|money market/i;
/** The asset class a score row belongs to, or null when the class gets no fund pick (sector, hybrid, gold, silver, US stocks). */
export function classOfRow(r: PickRow): TargetClass | null {
  if (r.g === 'mf') return PLAIN_EQUITY.has(r.c) && r.c !== 'ELSS' ? 'active_equity_fund' : null;
  if (r.g === 'idx') return assetClassOf('ETF', r.n, r.c) === 'index' ? 'index' : null;
  if (r.g === 'intl') return r.c === 'Global thematic' || r.c === 'Overseas debt' ? null : 'international';   // for these rows c is already the market group
  if (r.g === 'debt') return LIQUID.test(r.c) || LIQUID.test(r.n) ? 'liquid' : 'debt';
  return null;
}
export const PICK_CLASSES: TargetClass[] = ['active_equity_fund', 'index', 'international', 'debt', 'liquid'];
const eligible = (r: PickRow): boolean => (r.b === 'Strong' || r.b === 'Average') && typeof r.s === 'number';
/** Top `n` funds for a class. `held` = ISINs or names held; `selling` = names being sold in this plan (never picked). One fund per index (index funds) or per market (international). */
export function pickFunds(cls: TargetClass, rows: PickRow[], held: { isin?: string; name: string }[] = [], selling: string[] = [], n = 3): Pick[] {
  const hi = new Set(held.map((h) => h.isin).filter(Boolean)), hn = new Set(held.map((h) => looseKey(h.name))), sell = new Set(selling.map(looseKey));
  const isHeld = (r: PickRow) => (!!r.i && hi.has(r.i)) || hn.has(looseKey(r.n));
  let c = rows.filter((r) => classOfRow(r) === cls && eligible(r) && !sell.has(looseKey(r.n)));
  c.sort((a, b) => (b.s as number) - (a.s as number) || (a.t ?? 9) - (b.t ?? 9) || a.n.localeCompare(b.n));
  if (cls === 'index' || cls === 'international') { const seen = new Set<string>(), key = (r: PickRow) => r.c; c = c.filter((r) => (seen.has(key(r)) ? false : (seen.add(key(r)), true))); }
  const top = c.slice(0, n), heldTop = top.filter(isHeld);
  const ordered = [...heldTop, ...top.filter((r) => !isHeld(r))];
  return ordered.map((row) => ({ row, held: isHeld(row), why: `${row.b}, score ${Math.round(row.s as number)}${row.t != null ? `, expense ratio ${row.t}%` : ''}${isHeld(row) ? ', you already hold it' : ''}` }));
}
