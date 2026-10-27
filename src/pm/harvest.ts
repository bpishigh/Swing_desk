// Harvest (book a loss now) and the sale-after date (wait for the long-term rate). Listed equity only. Decided 27 Oct 2026 (owner "defaults"):
// count half of a loss that can only carry forward, and act only when the saving beats the cost by a quarter. Decision support, not tax advice.
export const HARVEST_DEFAULTS = { haircut: 0.5, margin: 0.25, gapRisk: 0.005, windowDays: 60 };
export type HarvestSettings = typeof HARVEST_DEFAULTS;
export interface EqLot { account?: string; name: string; symbol?: string; date: string; qty: number; unitCost: number; price: number; long: boolean; daysToLong: number }
export interface EqRates { stcg: number; ltcg: number }
/** Gains already booked this year that a loss could cancel: short-term gains, and long-term gains above the exemption. */
export interface Position { stcg: number; ltcgTaxable: number }

export interface HarvestRow { name: string; account?: string; loss: number; value: number; long: boolean; taxSaved: number; carryValue: number; taxValue: number; roundTrip: number; fire: boolean; why: string }

export function harvest(lots: EqLot[], pos: Position, rate: EqRates, chargesOf: (value: number) => number, s: HarvestSettings = HARVEST_DEFAULTS): HarvestRow[] {
  const left = { ...pos }, rows: HarvestRow[] = [];
  const losers = lots.filter((l) => l.price < l.unitCost).map((l) => ({ l, loss: (l.unitCost - l.price) * l.qty })).sort((a, b) => b.loss - a.loss);
  for (const { l, loss } of losers) {
    const value = l.price * l.qty;
    let rest = loss, saved = 0;
    if (!l.long) { const u = Math.min(rest, Math.max(0, left.stcg)); saved += u * rate.stcg; left.stcg -= u; rest -= u; }
    { const u = Math.min(rest, Math.max(0, left.ltcgTaxable)); saved += u * rate.ltcg; left.ltcgTaxable -= u; rest -= u; }
    const carryValue = rest * s.haircut * rate.ltcg, taxValue = saved + carryValue, roundTrip = 2 * chargesOf(value) + s.gapRisk * value, fire = taxValue > roundTrip * (1 + s.margin);
    rows.push({ name: l.name, account: l.account, loss, value, long: l.long, taxSaved: saved, carryValue, taxValue, roundTrip, fire,
      why: `${l.long ? 'Long' : 'Short'}-term loss of ₹${Math.round(loss).toLocaleString('en-IN')}: cancels ₹${Math.round(loss - rest).toLocaleString('en-IN')} of this year's gains (saves ₹${Math.round(saved).toLocaleString('en-IN')}); the other ₹${Math.round(rest).toLocaleString('en-IN')} only carries forward, counted at ${Math.round(s.haircut * 100)}% (₹${Math.round(carryValue).toLocaleString('en-IN')}). Round trip costs about ₹${Math.round(roundTrip).toLocaleString('en-IN')}.` });
  }
  return rows.sort((a, b) => (b.fire ? 1 : 0) - (a.fire ? 1 : 0) || b.taxValue - a.taxValue);
}

export interface SaleAfterRow { name: string; account?: string; gain: number; value: number; daysToLong: number; date: string; taxSaved: number; expectedLoss: number; wait: boolean; why: string }

/** `dailyVol`: standard deviation of daily returns (closes only), so the expected loss over the wait is value x dailyVol x sqrt(days). Untested first formula (design section 4). */
export function saleAfter(lots: EqLot[], today: string, exemptionLeft: number, rate: EqRates, dailyVol: (l: EqLot) => number | null, s: HarvestSettings = HARVEST_DEFAULTS): SaleAfterRow[] {
  const rows: SaleAfterRow[] = []; let ex = Math.max(0, exemptionLeft);
  for (const l of lots.filter((x) => !x.long && x.price > x.unitCost && x.daysToLong > 0 && x.daysToLong <= s.windowDays).sort((a, b) => a.daysToLong - b.daysToLong)) {
    const gain = (l.price - l.unitCost) * l.qty, value = l.price * l.qty, vol = dailyVol(l); if (vol === null) continue;
    const useEx = Math.min(ex, gain), taxNow = gain * rate.stcg, taxLater = (gain - useEx) * rate.ltcg, taxSaved = taxNow - taxLater, expectedLoss = value * vol * Math.sqrt(l.daysToLong), wait = taxSaved > expectedLoss * (1 + s.margin);
    if (wait) ex -= useEx;
    const date = new Date(Date.parse(today) + l.daysToLong * 86400000).toISOString().slice(0, 10);
    rows.push({ name: l.name, account: l.account, gain, value, daysToLong: l.daysToLong, date, taxSaved, expectedLoss, wait, why: `Becomes long-term on ${date} (${l.daysToLong} days). Selling today taxes the ₹${Math.round(gain).toLocaleString('en-IN')} gain at ${Math.round(rate.stcg * 1000) / 10}%; waiting saves about ₹${Math.round(taxSaved).toLocaleString('en-IN')}. The price could move against you by about ₹${Math.round(expectedLoss).toLocaleString('en-IN')} over the wait.` });
  }
  return rows;
}
