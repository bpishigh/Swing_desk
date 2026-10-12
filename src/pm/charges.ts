// Itemised charges per order from the dated rates table (data/rules/charges.json). Gross price stays separate (design section 3).
// STT is kept apart because it is not deductible for capital gains; the rest is split into buy-side cost and sell-side expense.
import type { Trade } from './reader.ts';
import type { AssetType } from './classify.ts';
export interface Charges { brokerage: number; stt: number; exchange: number; sebi: number; ipft: number; stamp: number; gst: number; dp: number; total: number; deductible: number; estimate: boolean; confidence: string }
type Rates = typeof import('../../data/rules/charges.json');
const pick = <T extends { from: string }>(rows: T[], date: string): T | undefined => rows.filter((r) => r.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0];
const r2 = (x: number) => Math.round(x * 100) / 100;

export function orderCharges(t: Trade, type: AssetType, broker: 'groww' | 'zerodha', rates: Rates, firstSellOfDay = true): Charges {
  const v = t.value, zero: Charges = { brokerage: 0, stt: 0, exchange: 0, sebi: 0, ipft: 0, stamp: 0, gst: 0, dp: 0, total: 0, deductible: 0, estimate: false, confidence: 'Medium' };
  if (type === 'fund_unclassified') return { ...zero, stamp: t.side === 'buy' ? r2((v * (pick(rates.stamp, t.date)?.mf_buy_pct ?? 0)) / 100) : 0, total: t.side === 'buy' ? r2((v * 0.005) / 100) : 0, deductible: 0 };
  const reg = pick(rates.brokers[broker].regimes, t.date), ex = pick(rates.exchange, t.date), st = pick(rates.stt, t.date), sp = pick(rates.stamp, t.date);
  if (!reg || !ex || !st || !sp) return { ...zero, estimate: true, confidence: 'Low' }; // before the earliest dated row
  const b = reg.brokerage;
  const brokerage = b.pct === 0 ? 0 : Math.max(b.min, Math.min(b.cap, (v * b.pct) / 100));
  const exch = (v * (t.exchange === 'BSE' ? ex.BSE_pct : ex.NSE_pct)) / 100, sebi = (v * ex.sebi_pct) / 100, ipft = t.exchange === 'BSE' ? 0 : (v * ex.ipft_NSE_pct) / 100;
  const dp = t.side === 'sell' && firstSellOfDay ? reg.dp_per_sell_debit : 0;
  const gst = ((brokerage + exch + sebi + ipft + dp) * ex.gst_pct) / 100;
  const stt = type === 'listed_equity' ? (v * st.listed_shares_pct) / 100 : type === 'us_stock' ? 0 : t.side === 'sell' && /etf|bees/i.test(t.instrument) && type !== 'gold_silver_etf' && type !== 'intl_etf' ? (v * st.equity_etf_sell_pct) / 100 : 0;
  const stamp = t.side === 'buy' ? (v * sp.buy_pct) / 100 : 0;
  const total = brokerage + exch + sebi + ipft + dp + gst + stt + stamp;
  // deductible for capital gains: brokerage, exchange levy, stamp duty and the GST on them; STT excluded, DP left out until confirmed (design section 7)
  const deductible = brokerage + exch + sebi + ipft + stamp + ((brokerage + exch + sebi + ipft) * ex.gst_pct) / 100;
  const estimate = t.date < '2024-01-01' && broker === 'groww'; // Groww structure for earlier years not verified
  return { brokerage: r2(brokerage), stt: r2(stt), exchange: r2(exch), sebi: r2(sebi), ipft: r2(ipft), stamp: r2(stamp), gst: r2(gst), dp: r2(dp), total: r2(total), deductible: r2(deductible), estimate, confidence: estimate ? 'Low' : reg.confidence };
}
