// Which fund to buy inside an asset class (Engine Rules C-87, amended by C-89). Pure. Uses the published FUND-3 rows (site/data/funds.json).
// Groups are single categories or indices: a score is a percentile rank inside one category, so it is never compared across categories.
// Active equity and index classes: the suggested group is the one that leaves the class's large/mid/small exposure closest to the market's own split.
                                                   
import { looseKey } from './fundverdict.js';
import { assetClassOf } from './assetclass.js';
import { normCategory, indexKey } from './fundscore.js';

                                                                                                                                                                                                                 
                                                                                                    
                                                                                            
                                              // large, mid, small
/** NSE Nifty 500 white paper (30 Sep 2025): free-float market cap of the Nifty 100, Midcap 150 and Smallcap 250 (66, 17, 10) over their 93% coverage of the Nifty 500, rounded. Overridable in settings/allocation.json (marketCapMix). */
export const MARKET_MIX      = [0.71, 0.18, 0.11];

/** The categories the C-81 back-test counted as plain active equity. */
export const PLAIN_EQUITY = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
const LIQUID = /liquid|overnight|money market/i;
/** The asset class a score row belongs to, or null when the class gets no fund pick (sector, hybrid, gold, silver, US stocks, ELSS and thematic or debt funds that are not a market). */
export function classOfRow(r         )                     {
  if (r.g === 'mf') return PLAIN_EQUITY.has(r.c) && r.c !== 'ELSS' ? 'active_equity_fund' : null;
  if (r.g === 'idx') return assetClassOf('ETF', r.n, r.c) === 'index' ? 'index' : null;
  if (r.g === 'intl') return r.c === 'Global thematic' || r.c === 'Overseas debt' ? null : 'international';   // for these rows c is already the market group
  if (r.g === 'debt') return LIQUID.test(r.c) || LIQUID.test(r.n) ? 'liquid' : 'debt';
  return null;
}
export const PICK_CLASSES                = ['active_equity_fund', 'index', 'international', 'debt', 'liquid'];
/** Closed-ended or unbuyable products are never picked: fixed maturity and fixed term plans, interval funds, numbered series (closed ELSS and tax series), segregated portfolios, and the Income group, which is made of those. */
const buyable = (r         )          => !/fixed maturity|fixed term|\bfmp\b|interval|segregated|existing number of|\bseries\b/i.test(r.n) && r.c !== 'Income';
const good = (b                           ) => b === 'Strong' || b === 'Average';
/** Pickable: Strong or Average now and, once a previous monthly entry exists, in it too (two reviews); active equity also needs a 5-year record. */
export function pickable(r         , hasPrev         , cls             )          {
  if (!good(r.b) || typeof r.s !== 'number' || !buyable(r)) return false;
  if (cls === 'active_equity_fund' && (r.r5 == null)) return false;
  if (hasPrev && !good(r.pb)) return false;
  return true;
}
const DIVERSIFIED = new Set(['Flexi Cap', 'Multi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield']);
/** Large/mid/small exposure of a group, or null when the group is not used for the exposure mix (not picked). */
export function exposure(cls             , group        , mix      = MARKET_MIX)             {
  if (cls === 'active_equity_fund') {
    if (group === 'Large Cap') return [1, 0, 0]; if (group === 'Large & Mid Cap') return [0.5, 0.5, 0]; if (group === 'Mid Cap') return [0, 1, 0]; if (group === 'Small Cap') return [0, 0, 1];
    return DIVERSIFIED.has(group) ? mix : null;
  }
  if (cls === 'index') {
    if (group === 'Nifty 50' || group === 'Nifty Next 50') return [1, 0, 0]; if (group === 'Nifty Midcap 150') return [0, 1, 0]; if (group === 'Nifty Smallcap 250') return [0, 0, 1]; if (group === 'Nifty 500') return mix;
    return null;
  }
  return null;
}
/** The order used for ties and for classes with no exposure mix. */
export const CORE_ORDER                                         = {
  active_equity_fund: ['Flexi Cap', 'Multi Cap', 'Focused', 'Value', 'Large Cap', 'Large & Mid Cap', 'Mid Cap', 'Small Cap'],
  index: ['Nifty 50', 'Nifty Next 50', 'Nifty Midcap 150', 'Nifty Smallcap 250', 'Nifty 500'],
  international: ['Nasdaq 100 and US tech giants', 'Other US', 'Emerging markets', 'Europe', 'China and Hong Kong', 'Global and other'],
};
const pc = (v                           ) => (typeof v === 'number' ? `${v.toFixed(1)}%` : 'n/a');
                                                                                                                                          
/** The suggested fund in each group of a class, headline group first. Debt and liquid have no headline (maturity and credit risk are not scored): every group is listed and none is chosen. */
export function pickFunds(cls             , rows           , o           = {})         {
  const held = o.held ?? [], amount = o.amount ?? 0, mix = o.mix ?? MARKET_MIX, hasPrev = !!o.hasPrev;
  const hi = new Map(held.filter((h) => h.isin).map((h) => [h.isin          , h])), hn = new Map(held.map((h) => [looseKey(h.name), h])), sell = new Set((o.selling ?? []).map(looseKey));
  const heldOf = (r         ) => (r.i ? hi.get(r.i) : undefined) ?? hn.get(looseKey(r.n));
  const inClass = rows.filter((r) => classOfRow(r) === cls);
  const groupOf = (r         ) => r.c;
  // what is held in this class, by exposure: scored funds by their group, unscored funds by the category or index their name or category gives
  const rowByKey = new Map                 (); for (const r of inClass) { if (r.i) rowByKey.set(r.i, r); rowByKey.set(looseKey(r.n), r); }
  const heldGroup = (h          )                => { const r = (h.isin ? rowByKey.get(h.isin) : undefined) ?? rowByKey.get(looseKey(h.name)); if (r) return groupOf(r); return cls === 'index' ? indexKey(h.name) : normCategory(h.category ?? ''); };
  const heldValue = new Map                (), E      = [0, 0, 0]; let T = 0;
  for (const h of held) { const g = heldGroup(h); if (!g) continue; heldValue.set(g, (heldValue.get(g) ?? 0) + (h.value ?? 0)); const x = exposure(cls, g, mix); if (x) { for (let k = 0; k < 3; k++) E[k] += (h.value ?? 0) * x[k]; T += h.value ?? 0; } }
  const groups = new Map                   ();
  for (const r of inClass.filter((x) => pickable(x, hasPrev, cls) && !sell.has(looseKey(x.n)))) { const g = groupOf(r); if ((cls === 'active_equity_fund' || cls === 'index') && !exposure(cls, g, mix)) continue; groups.set(g, [...(groups.get(g) ?? []), r]); }
  const out                              = [];
  const capRoom = (r         ) => { const h = heldOf(r); return o.fundCapAmount == null || !h || (h.value ?? 0) < o.fundCapAmount; };
  for (const [g, list] of groups) {
    if (cls === 'index') list.sort((a, b) => (a.t ?? 9) - (b.t ?? 9) || (b.s          ) - (a.s          ) || a.n.localeCompare(b.n));   // cost decides among funds that match the index
    else list.sort((a, b) => (b.s          ) - (a.s          ) || (a.t ?? 9) - (b.t ?? 9) || a.n.localeCompare(b.n));
    const usable = list.filter(capRoom); if (!usable.length) continue;
    const top = cls === 'index' ? usable : usable.slice(0, 3), row = top.find((r) => heldOf(r)) ?? top[0], isH = !!heldOf(row);
    let dist = 0; const x = exposure(cls, g, mix);
    if (x) { const tot = T + amount; for (let k = 0; k < 3; k++) { const d = (E[k] + amount * x[k]) / (tot || 1) - mix[k]; dist += d * d; } }
    out.push({ group: g, row, held: isH, headline: false, dist, why: `${g}: ${row.b}, score ${Math.round(row.s          )}, 1y ${pc(row.r1)}, 3y ${pc(row.r3)}, 5y ${pc(row.r5)}${row.t != null ? `, expense ratio ${row.t}%` : ''}${isH ? ', you already hold it' : ''}` });
  }
  const core = CORE_ORDER[cls] ?? [], rank = (g        ) => (core.includes(g) ? core.indexOf(g) : 99), usesMix = cls === 'active_equity_fund' || cls === 'index';
  out.sort((a, b) => (usesMix ? a.dist - b.dist : (heldValue.get(a.group) ?? 0) - (heldValue.get(b.group) ?? 0)) || rank(a.group) - rank(b.group) || a.group.localeCompare(b.group));
  if (out.length && cls !== 'debt' && cls !== 'liquid') out[0].headline = true;
  return out.map(({ dist, ...p }) => p);
}
