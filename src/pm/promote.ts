// Promote (design section 4). A direct Legacy stock that passes the exit test AND is on the latest nightly Swing Desk shortlist is a Promote candidate:
// the lot becomes Swing with the line's stop. Only the latest night counts ("today's screen"). Pure; a verdict, not an order.
import type { ShortLine } from './shortlist.ts';

export interface PromoteInput { symbol: string; price: number; qty: number }
export interface PromoteResult { symbol: string; price: number; line: ShortLine; stop: number; riskPct: number; riskRs: number; qtyFull: number; qtyCapped: number | null; why: string }

/** `lines`: the shortlist file's lines. `latest`: the newest night the nightly job ran. `riskBudget`: rupees of risk one Swing position may carry (optional); when given the quantity is capped to fit. */
export function promoteOf(input: PromoteInput, lines: ShortLine[], latest: string | undefined, riskBudget?: number): PromoteResult | null {
  if (!latest || !(input.price > 0) || !(input.qty > 0)) return null;
  const hits = lines.filter((l) => l.sym === input.symbol && l.signalDate === latest && l.stop > 0 && l.stop < input.price);
  if (!hits.length) return null;
  const line = hits.find((l) => l.stream === 'capwaived') ?? hits[0];
  const perShare = input.price - line.stop, riskRs = perShare * input.qty;
  const qtyCapped = riskBudget && riskBudget > 0 && riskRs > riskBudget ? Math.max(0, Math.floor(riskBudget / perShare)) : null;
  return { symbol: input.symbol, price: input.price, line, stop: line.stop, riskPct: perShare / input.price * 100, riskRs, qtyFull: input.qty, qtyCapped,
    why: `On the ${latest} Swing Desk shortlist (setup ${line.setup}, trigger ${line.trigger}, stop ${line.stop}). Promoting gives the lot that stop: ${(perShare / input.price * 100).toFixed(1)}% below the price.` };
}

// ---- Sizing a Promote: how many shares of the Legacy holding move to Swing, per account. The Swing rules apply as they do to a new entry:
// one R of risk, the 20% position cap, the account's and the household's open-risk limits, the household position count, the setup allowed on today's light,
// and the setup's maximum stop width (a wider stop is skipped, not resized). Shares come from the oldest lots first.
import { limitsFor, type RiskAdj } from './swingorders.ts';
import { SETUPS, type Light } from '../engine/setups.ts';

export interface PromoteAcct { label: string; heldQty: number; swingCapital: number; openRisk: number; swingValueOfName: number; inSwing: boolean }
export interface PromoteLine { label: string; qty: number; ok: boolean; binding: string; note?: string }
export interface PromoteSize { light: Light | null; perAccount: PromoteLine[]; total: number }

export function sizePromote(p: { price: number; stop: number; setup: string }, accts: PromoteAcct[], ctx: { light: Light | null; vix?: number | null; maxPositions: number; householdPositions: number; householdOpenRisk: number } & RiskAdj): PromoteSize {
  const lim = limitsFor(ctx.light, ctx.vix, ctx), sp = SETUPS[p.setup as keyof typeof SETUPS];
  if (!lim) return { light: ctx.light, total: 0, perAccount: accts.map((a) => ({ label: a.label, qty: 0, ok: false, binding: 'no market light saved today', note: 'No market light is saved for today, so nothing is sized.' })) };
  const rps = p.price - p.stop, stopPct = (rps / p.price) * 100, maxPos = Math.min(lim.maxPos, ctx.maxPositions);
  const hhCap = accts.reduce((t, a) => t + a.swingCapital, 0), hhCapRs = (hhCap * lim.cap) / 100;
  let hhOpen = ctx.householdOpenRisk, newName = accts.every((a) => !a.inSwing);
  const per: PromoteLine[] = accts.map((a) => {
    const no = (note: string): PromoteLine => ({ label: a.label, qty: 0, ok: false, binding: note, note });
    if (!(rps > 0)) return no('the stop is not below the price');
    if (a.heldQty <= 0) return no('does not hold this stock as Legacy');
    if (a.swingCapital <= 0) return no('no swing capital in this account');
    if (!sp) return no('unknown setup');
    if (!lim.setups.includes(p.setup as never)) return no(`${sp.short} is not allowed on a ${ctx.light} light`);
    if (stopPct > sp.maxStop + 1e-9) return no(`the stop is ${stopPct.toFixed(1)}% below the price, over the ${sp.maxStop}% limit for ${sp.short}: skip, do not resize`);
    if (newName && ctx.householdPositions >= maxPos) return no(`household position count ${ctx.householdPositions} is at the limit of ${maxPos}`);
    const byOne = Math.floor((a.swingCapital * lim.risk) / 100 / rps), byPos = Math.max(0, Math.floor((a.swingCapital * 0.2 - a.swingValueOfName) / p.price));
    const byAcct = Math.floor(Math.max(0, (a.swingCapital * lim.cap) / 100 - a.openRisk) / rps), byHh = Math.floor(Math.max(0, hhCapRs - hhOpen) / rps);
    const opts: [number, string][] = [[a.heldQty, 'the shares you hold'], [byOne, 'one R of risk'], [byPos, '20% position cap'], [byAcct, 'open-risk limit of this account'], [byHh, 'open-risk limit of the household']];
    const [qty, binding] = opts.reduce((m, o) => (o[0] < m[0] ? o : m));
    if (qty <= 0) return no(`${binding} leaves no room`);
    hhOpen += qty * rps; newName = false;
    return { label: a.label, qty, ok: true, binding };
  });
  return { light: ctx.light, perAccount: per, total: per.reduce((t, x) => t + x.qty, 0) };
}
