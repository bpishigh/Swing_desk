// Which fund to buy inside an asset class (Engine Rules C-87). Pure. Uses the published FUND-3 rows (site/data/funds.json).
// Only Strong or Average funds, ranked by score then lower expense ratio; a fund already held that is on the list is preferred; the fund being sold is never the pick.
import type { TargetClass } from './allocation.ts';
import { looseKey } from './fundverdict.ts';
import { assetClassOf } from './assetclass.ts';

export interface PickRow { n: string; i?: string; c: string; s?: number | null; b?: string | null; t?: number | null; g: string; r1?: number | null; r3?: number | null; r5?: number | null }
export interface Pick { group: string; row: PickRow; held: boolean; headline: boolean; why: string }
export interface HeldFund { isin?: string; name: string; value?: number }

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
/** Closed-ended or unbuyable products are never picked: fixed maturity and fixed term plans, interval funds, numbered series (closed ELSS and tax series), segregated portfolios, and the Income group, which is made of those. */
const eligible = (r: PickRow): boolean => (r.b === 'Strong' || r.b === 'Average') && typeof r.s === 'number' && !/fixed maturity|fixed term|\bfmp\b|interval|segregated|existing number of|\bseries\b/i.test(r.n) && r.c !== 'Income';
const ALL_CAP = new Set(['Flexi Cap', 'Multi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield']);
/** The comparison group of a row: scores are percentile ranks inside one category or index, so they are only ever compared inside the group. */
export function groupOf(r: PickRow): string { return r.g === 'mf' && ALL_CAP.has(r.c) ? 'All-cap' : r.c; }
/** The order used for the headline pick when the person holds none of any group (C-87). */
export const CORE_ORDER: Partial<Record<TargetClass, string[]>> = {
  active_equity_fund: ['All-cap', 'Large Cap', 'Large & Mid Cap', 'Mid Cap', 'Small Cap'],
  index: ['Nifty 50', 'Nifty Next 50', 'Nifty Midcap 150', 'Nifty Smallcap 250'],
  international: ['Nasdaq 100 and US tech giants', 'Other US', 'Emerging markets', 'Europe', 'China and Hong Kong', 'Global and other'],
};
const pc = (v: number | null | undefined) => (typeof v === 'number' ? `${v.toFixed(1)}%` : 'n/a');
/** The best fund in each group of a class, headline group first. Debt and liquid have no headline (maturity and credit risk are not scored): every group is listed and none is chosen. A held fund that is in the group's top 3 is preferred; funds in `selling` are never picked. */
export function pickFunds(cls: TargetClass, rows: PickRow[], held: HeldFund[] = [], selling: string[] = []): Pick[] {
  const hi = new Map(held.filter((h) => h.isin).map((h) => [h.isin as string, h])), hn = new Map(held.map((h) => [looseKey(h.name), h])), sell = new Set(selling.map(looseKey));
  const heldOf = (r: PickRow) => (r.i ? hi.get(r.i) : undefined) ?? hn.get(looseKey(r.n));
  const inClass = rows.filter((r) => classOfRow(r) === cls);
  const heldValue = new Map<string, number>(); for (const r of inClass) { const h = heldOf(r); if (h) heldValue.set(groupOf(r), (heldValue.get(groupOf(r)) ?? 0) + (h.value ?? 0)); }
  const groups = new Map<string, PickRow[]>();
  for (const r of inClass.filter((x) => eligible(x) && !sell.has(looseKey(x.n)))) { const g = groupOf(r); groups.set(g, [...(groups.get(g) ?? []), r]); }
  const out: Pick[] = [];
  for (const [g, list] of groups) {
    list.sort((a, b) => (b.s as number) - (a.s as number) || (a.t ?? 9) - (b.t ?? 9) || a.n.localeCompare(b.n));
    const top = list.slice(0, 3), row = top.find((r) => heldOf(r)) ?? top[0], isH = !!heldOf(row);
    out.push({ group: g, row, held: isH, headline: false, why: `${g}: ${row.b}, score ${Math.round(row.s as number)}, 1y ${pc(row.r1)}, 3y ${pc(row.r3)}, 5y ${pc(row.r5)}${row.t != null ? `, expense ratio ${row.t}%` : ''}${isH ? ', you already hold it' : ''}` });
  }
  const core = CORE_ORDER[cls] ?? [], rank = (g: string) => (core.includes(g) ? core.indexOf(g) : 99);
  out.sort((a, b) => (heldValue.get(a.group) ?? 0) - (heldValue.get(b.group) ?? 0) || rank(a.group) - rank(b.group) || a.group.localeCompare(b.group));
  if (out.length && cls !== 'debt' && cls !== 'liquid') out[0].headline = true;
  return out;
}
