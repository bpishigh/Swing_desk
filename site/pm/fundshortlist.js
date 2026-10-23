// Which fund to buy inside an asset class (Engine Rules C-87). Pure. Uses the published FUND-3 rows (site/data/funds.json).
// Only Strong or Average funds, ranked by score then lower expense ratio; a fund already held that is on the list is preferred; the fund being sold is never the pick.
                                                   
import { looseKey } from './fundverdict.js';
import { assetClassOf } from './assetclass.js';

                                                                                                                                                     
                                                                  

/** The categories the C-81 back-test counted as plain active equity. */
export const PLAIN_EQUITY = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
/** Not picked for new money: ELSS (3-year lock-in, so it cannot be moved later) global thematic funds and overseas debt funds (a bet on one theme, not an allocation to a market). They can still be held and scored. */
const LIQUID = /liquid|overnight|money market/i;
/** The asset class a score row belongs to, or null when the class gets no fund pick (sector, hybrid, gold, silver, US stocks). */
export function classOfRow(r         )                     {
  if (r.g === 'mf') return PLAIN_EQUITY.has(r.c) && r.c !== 'ELSS' ? 'active_equity_fund' : null;
  if (r.g === 'idx') return assetClassOf('ETF', r.n, r.c) === 'index' ? 'index' : null;
  if (r.g === 'intl') return r.c === 'Global thematic' || r.c === 'Overseas debt' ? null : 'international';   // for these rows c is already the market group
  if (r.g === 'debt') return LIQUID.test(r.c) || LIQUID.test(r.n) ? 'liquid' : 'debt';
  return null;
}
export const PICK_CLASSES                = ['active_equity_fund', 'index', 'international', 'debt', 'liquid'];
const eligible = (r         )          => (r.b === 'Strong' || r.b === 'Average') && typeof r.s === 'number';
/** Top `n` funds for a class. `held` = ISINs or names held; `selling` = names being sold in this plan (never picked). One fund per index (index funds) or per market (international). */
export function pickFunds(cls             , rows           , held                                    = [], selling           = [], n = 3)         {
  const hi = new Set(held.map((h) => h.isin).filter(Boolean)), hn = new Set(held.map((h) => looseKey(h.name))), sell = new Set(selling.map(looseKey));
  const isHeld = (r         ) => (!!r.i && hi.has(r.i)) || hn.has(looseKey(r.n));
  let c = rows.filter((r) => classOfRow(r) === cls && eligible(r) && !sell.has(looseKey(r.n)));
  c.sort((a, b) => (b.s          ) - (a.s          ) || (a.t ?? 9) - (b.t ?? 9) || a.n.localeCompare(b.n));
  if (cls === 'index' || cls === 'international') { const seen = new Set        (), key = (r         ) => r.c; c = c.filter((r) => (seen.has(key(r)) ? false : (seen.add(key(r)), true))); }
  const top = c.slice(0, n), heldTop = top.filter(isHeld);
  const ordered = [...heldTop, ...top.filter((r) => !isHeld(r))];
  return ordered.map((row) => ({ row, held: isHeld(row), why: `${row.b}, score ${Math.round(row.s          )}${row.t != null ? `, expense ratio ${row.t}%` : ''}${isHeld(row) ? ', you already hold it' : ''}` }));
}
