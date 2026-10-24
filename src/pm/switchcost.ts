// Switch-cost calculator (C-91). Pure. Prices selling every open lot of one holding today and says how much extra yearly return the new holding must earn to make up the cost. Information only.
import { isLong, inLoad, type OpenLot, type Rules } from './rebalance.ts';

export interface SwitchLot { date: string; qty: number; value: number; gain: number; long: boolean; tax: number | null; load: number; loadNote?: string }
export interface SwitchCost { value: number; gain: number; longGain: number; shortGain: number; tax: number | null; load: number; charges: number; cost: number; net: number; lots: SwitchLot[]; notes: string[]; breakEven: { years: number; extra: number }[]; baseReturn: number }

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
/** Lots must all be of one holding. `exemptionLeft` is the long-term equity exemption still unused this financial year. */
export function switchCost(lots: OpenLot[], ctx: { today: string; rules: Rules; exemptionLeft?: number; slabRate?: number; chargesOf?: (value: number, type: string) => number; checkDays?: number; baseReturn?: number; horizons?: number[] }): SwitchCost {
  const base = ctx.baseReturn ?? 0.12, out: SwitchCost = { value: 0, gain: 0, longGain: 0, shortGain: 0, tax: 0, load: 0, charges: 0, cost: 0, net: 0, lots: [], notes: [], breakEven: [], baseReturn: base };
  // longest-held lots first within a holding is not assumed: every lot is sold, so the order only decides who gets the exemption (oldest first)
  let exemption = ctx.exemptionLeft ?? 125000, slabUnset = false;
  for (const l of [...lots].filter((x) => x.qty > 0 && x.price > 0).sort((a, b) => a.date.localeCompare(b.date))) {
    const value = l.qty * l.price, gain = l.qty * (l.price - l.unitCost), long = isLong(ctx.rules, l, ctx.today) ?? false, tr = ctx.rules.types[l.type];
    const rule = tr?.rules.filter((r) => r.transfer_from <= ctx.today).sort((a, b) => b.transfer_from.localeCompare(a.transfer_from))[0];
    let tax: number | null = null;
    if (gain <= 0) tax = 0;
    else if (rule) {
      const rate = long ? rule.ltcg : rule.stcg;
      if (rate === 'slab') { if (ctx.slabRate && ctx.slabRate > 0) tax = gain * ctx.slabRate; else slabUnset = true; }
      else if (typeof rate === 'number') { const free = long && tr.exemption ? Math.min(exemption, gain) : 0; exemption -= free; tax = (gain - free) * rate; }
    }
    const load = inLoad(l, ctx.today) ? value * l.exitLoad!.pct : 0, charges = ctx.chargesOf ? ctx.chargesOf(value, l.type) : 0;
    let loadNote: string | undefined;
    if (l.kind === 'Fund' && l.exitLoad === undefined && days(l.date, ctx.today) < (ctx.checkDays ?? 365)) loadNote = `bought ${days(l.date, ctx.today)} days ago and no exit load is recorded for this fund: check the load before selling`;
    else if (load > 0) loadNote = `exit load ${(100 * l.exitLoad!.pct).toFixed(2)}% applies until ${new Date(Date.parse(l.date) + l.exitLoad!.days * 86400000).toISOString().slice(0, 10)}`;
    out.lots.push({ date: l.date, qty: l.qty, value, gain, long, tax, load, loadNote });
    out.value += value; out.gain += gain; out.load += load; out.charges += charges; if (long) out.longGain += gain; else out.shortGain += gain;
    out.tax = out.tax === null || tax === null ? null : out.tax + tax;
  }
  if (slabUnset) { out.tax = null; out.notes.push('This asset is taxed at your slab rate; enter a slab rate in Allocation to price the tax.'); }
  for (const x of out.lots) if (x.loadNote && !out.notes.includes(x.loadNote)) out.notes.push(x.loadNote);
  out.cost = (out.tax ?? 0) + out.load + out.charges; out.net = out.value - out.cost;
  // extra yearly return r so that net × (1+base+r)^n = value × (1+base)^n
  out.breakEven = out.value > 0 && out.net > 0 ? (ctx.horizons ?? [1, 3, 5]).map((years) => ({ years, extra: (1 + base) * ((out.value / out.net) ** (1 / years) - 1) })) : [];
  return out;
}
