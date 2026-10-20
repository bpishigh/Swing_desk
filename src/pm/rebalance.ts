// Rebalancing suggestions and new-money sizing (Portfolio Manager phase 6, design sections 8 and 9.2). Pure. A suggestion is a dated list of actions, never an order.
// 1. New money goes first, to the classes furthest below target. 2. Only a class still above its band after that is sold down, and only from lots that may be sold (never the Swing book,
// never ELSS inside its 3-year lock-in, never a holding with no asset class), cheapest in tax first. 3. A sale below the minimum trade, or whose cost is too large a share of it, is skipped.
// Estimates exclude surcharge and cess; slab-rate lines carry the gain but no tax figure, because the person's slab rate is not set. Exit loads are not modelled (no data yet): every sale is flagged for that.
import { TARGET_CLASSES, type TargetClass } from './allocation.ts';

export interface MoneyLine { cls: TargetClass; amount: number; why: string }
/** Routes `amount` of new money. Shortfall = target × (capital + amount) − what is held. Fills shortfalls in proportion; any surplus is spread by target weight. Sums to `amount`, never negative. */
export function routeNewMoney(targets: { cls: TargetClass; target: number }[], held: Record<TargetClass, number>, amount: number): { lines: MoneyLine[]; error?: string } {
  if (!(amount > 0)) return { lines: [], error: 'Enter an amount above zero.' };
  const base = TARGET_CLASSES.reduce((a, c) => a + (held[c] ?? 0), 0), total = base + amount;
  const sh = targets.map((t) => ({ cls: t.cls, target: t.target, short: Math.max(0, t.target * total - (held[t.cls] ?? 0)) }));
  const sumShort = sh.reduce((a, x) => a + x.short, 0);
  const lines: MoneyLine[] = sh.map((x) => {
    const amt = sumShort >= amount ? (x.short * amount) / sumShort : x.short + (x.target * (amount - sumShort)) / (targets.reduce((a, t) => a + t.target, 0) || 1);
    return { cls: x.cls, amount: amt, why: x.short > 0 ? `below target by ${Math.round(x.short).toLocaleString('en-IN')}` : 'at or above target; share by target weight' };
  }).filter((l) => l.amount > 0.5);
  return { lines };
}

export interface OpenLot { account?: string; name: string; kind: 'Stock' | 'ETF' | 'Fund'; book: string; assetClass: string | null; category?: string; type: string; date: string; qty: number; unitCost: number; price: number; locked?: boolean }
export interface RebalSettings { minTrade: number; maxCostShare: number }
export interface SaleLine { account?: string; name: string; cls: TargetClass; qty: number; value: number; gain: number; long: boolean; tax: number | null; charges: number; group: string; reason: string }
export interface SkippedSale { name: string; cls: TargetClass; value: number; why: string }
export interface SalePlan { lines: SaleLine[]; skipped: SkippedSale[]; unmet: { cls: TargetClass; short: number; why: string }[]; taxTotal: number; slabGains: number }
type Rules = { types: Record<string, { long_after_days: number | null; deemed_short_if_bought_on_or_after?: string; exemption: boolean; rules: { transfer_from: string; stcg: number | string; ltcg: number | string; exemption?: number }[] }> };

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export function isLong(rules: Rules, l: OpenLot, today: string): boolean | null {
  const r = rules.types[l.type]; if (!r || r.long_after_days === null || r.long_after_days === undefined) return null;
  if (r.deemed_short_if_bought_on_or_after && l.date >= r.deemed_short_if_bought_on_or_after) return false;
  return days(l.date, today) > r.long_after_days;
}
/** Sale order from the design: Exit-verdict names, loss lots, long-term equity (exemption applies), other long-term, short-term. */
function groupOf(rules: Rules, l: OpenLot, today: string, exit: Set<string>): { g: number; label: string; long: boolean } {
  const long = isLong(rules, l, today) ?? false, gain = (l.price - l.unitCost) * l.qty, ex = rules.types[l.type]?.exemption;
  if (exit.has(l.name)) return { g: 0, label: 'Exit verdict: already a sale', long };
  if (gain < 0) return { g: 1, label: 'loss lot', long };
  if (long && ex) return { g: 2, label: 'long-term, equity exemption', long };
  if (long) return { g: 3, label: 'long-term', long };
  return { g: 4, label: 'short-term', long };
}
export function planSales(lots: OpenLot[], need: Partial<Record<TargetClass, number>>, ctx: { today: string; rules: Rules; exit?: Set<string>; exemptionLeft?: number; settings: RebalSettings; chargesOf?: (value: number, type: string) => number }): SalePlan {
  const exit = ctx.exit ?? new Set<string>(), plan: SalePlan = { lines: [], skipped: [], unmet: [], taxTotal: 0, slabGains: 0 };
  let exemption = ctx.exemptionLeft ?? 125000;
  for (const cls of TARGET_CLASSES) {
    let left = need[cls] ?? 0; if (!(left > 0)) continue;
    const cands = lots.filter((l) => l.assetClass === cls && l.book !== 'Swing' && !l.locked && l.qty > 0 && l.price > 0).map((l) => ({ l, ...groupOf(ctx.rules, l, ctx.today, exit) }))
      .sort((a, b) => a.g - b.g || (a.l.price - a.l.unitCost) / a.l.price - (b.l.price - b.l.unitCost) / b.l.price);
    for (const c of cands) {
      if (left <= 0.5) break;
      const l = c.l, lotValue = l.qty * l.price; let qty = lotValue <= left ? l.qty : (left / l.price);
      qty = l.kind === 'Fund' ? Math.floor(qty * 1000) / 1000 : Math.floor(qty);
      if (qty <= 0) continue;
      const value = qty * l.price, gain = qty * (l.price - l.unitCost), rule = ctx.rules.types[l.type]?.rules.filter((r) => r.transfer_from <= ctx.today).sort((a, b) => b.transfer_from.localeCompare(a.transfer_from))[0];
      let tax: number | null = null, usedFree = 0;
      if (gain <= 0) tax = 0;
      else if (rule) {
        const rate = c.long ? rule.ltcg : rule.stcg;
        if (rate === 'slab') { tax = null; plan.slabGains += gain; }
        else if (typeof rate === 'number') { const free = c.long && ctx.rules.types[l.type].exemption ? Math.min(exemption, gain) : 0; usedFree = free; tax = (gain - free) * rate; }
      }
      const charges = ctx.chargesOf ? ctx.chargesOf(value, l.type) : 0, cost = (tax ?? 0) + charges;
      if (value < ctx.settings.minTrade) { plan.skipped.push({ name: l.name, cls, value, why: `below the minimum trade of ₹${ctx.settings.minTrade.toLocaleString('en-IN')}` }); continue; }
      if (c.g !== 0 && cost > ctx.settings.maxCostShare * value) { plan.skipped.push({ name: l.name, cls, value, why: `cost ₹${Math.round(cost).toLocaleString('en-IN')} is ${(100 * cost / value).toFixed(1)}% of the sale, above the ${(100 * ctx.settings.maxCostShare).toFixed(0)}% limit` }); continue; }
      plan.lines.push({ account: l.account, name: l.name, cls, qty, value, gain, long: c.long, tax, charges, group: c.label, reason: `${c.label}; bought ${l.date}` });
      exemption -= usedFree; plan.taxTotal += tax ?? 0; left -= value;
    }
    if (left > 0.5) plan.unmet.push({ cls, short: left, why: 'not enough sellable lots (Swing book, locked ELSS, unclassified, below the minimum trade or too costly are never sold here)' });
  }
  return plan;
}
/** Amount to sell per class after new money: down to target, for classes still above target + band. */
export function sellNeeds(targets: { cls: TargetClass; target: number }[], held: Record<TargetClass, number>, band: (c: TargetClass) => number, newMoney: Partial<Record<TargetClass, number>> = {}): Partial<Record<TargetClass, number>> {
  const total = TARGET_CLASSES.reduce((a, c) => a + (held[c] ?? 0) + (newMoney[c] ?? 0), 0), out: Partial<Record<TargetClass, number>> = {};
  for (const t of targets) { const cur = (held[t.cls] ?? 0) + (newMoney[t.cls] ?? 0); if (total > 0 && cur / total > t.target + band(t.cls)) out[t.cls] = cur - t.target * total; }
  return out;
}
