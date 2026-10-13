// The whole Portfolio Manager pipeline on already-parsed trades, with all public data passed in (no file or network access here),
// so the same code runs in Node (tests, local report) and in the browser (Upload tab). Personal data enters only as `batches`.
import { mergeTrades, aggregateFills, type Trade } from './reader.ts';
import { canonicalise } from './lineage.ts';
import { buildCatalogue, ipoCandidates, type DemergerRecord, type FeedRow, type IpoRecord } from './nse-catalogue.ts';
import { resolve } from './resolver.ts';
import { assetType, type AssetType } from './classify.ts';
import { orderCharges } from './charges.ts';
import { taxView, type TaxYear } from './tax.ts';
import { computeDividends, type DividendYear } from './dividends.ts';
import { FundMaster, fundTaxType, type AmfiRow } from './funds.ts';
import { replay } from './ledger.ts';
import { performance, type Perf } from './performance.ts';
import { inferBooks, bookTotals } from './books.ts';

export interface PublicData {
  feed: FeedRow[]; demergers: DemergerRecord[]; ipos: IpoRecord[]; amfi: AmfiRow[]; fundOverrides: any[];
  charges: any; taxRules: any; divRules: any;
  prices: Record<string, number>; pricesAsOf: string;      // latest close by NSE symbol
}
export interface Report {
  counts: { trades: number; duplicates: number; orders: number; stockOrders: number; fundOrders: number; openLots: number };
  funds: { mapped: number; unmapped: string[] };
  resolver: { eventsFromFeed: number; applied: string[]; proposed: string[]; unexplained: { name: string; date: string; qty: number }[]; needsRecord: { symbol: string; exDate: string; why: string }[] };
  warnings: string[];
  tax: TaxYear[]; dividends: DividendYear[]; performance: Perf & { realised: number; unrealised: number; costOpen: number; notValued: string[] };
  books: Record<string, { cost: number; value: number; lots: number }>;
  holdings: { name: string; book: string; qty: number; cost: number; value: number | null }[];
}
const isFundType = (t?: string) => !!t && /fund|fof|hybrid/.test(t);

export function runPipeline(batches: Trade[][], broker: 'groww' | 'zerodha', d: PublicData): Report {
  const m = mergeTrades(batches);
  const names = new Set(m.trades.map((t) => (t.symbol ?? t.instrument).toUpperCase()));
  const isins = new Set(m.trades.filter((t) => t.isin).map((t) => t.isin));
  const pairs = d.feed.filter((r) => names.has(r.symbol.toUpperCase()) || (r.isin && isins.has(r.isin))).map((r) => ({ symbol: r.symbol, isin: r.isin, date: r.exDate }));
  const canon = canonicalise(m.trades, pairs);
  const orders = aggregateFills(canon.trades);
  const held = new Set(canon.trades.map((t) => t.isin));
  const bc = buildCatalogue(d.feed.filter((r) => pairs.some((p) => p.symbol === r.symbol && p.isin === r.isin) || held.has(canon.lineage.key(r.symbol, r.isin))), canon.lineage, d.demergers, held);
  const cat = { facts: bc.catalogue.facts, candidates: ipoCandidates(d.ipos, canon.lineage, held) };
  // A broker's zero-value credit of a demerger's child shares is the same event as the demerger fact (which carries the cost): keep the fact, drop the credit
  const kids = new Map(d.demergers.filter((x) => x.childIsin).map((x) => [x.childIsin!, x] as const));
  const factKids = new Set(cat.facts.filter((f: any) => f.type === 'demerger').map((f: any) => f.child));
  const absorbed: string[] = [];
  const stocks = orders.filter((t) => t.kind !== 'fund').filter((t) => { if (t.value === 0 && t.side === 'buy' && factKids.has(t.isin) && kids.has(t.isin)) { absorbed.push(`${kids.get(t.isin)!.childName ?? t.isin} ${t.qty} on ${t.date}`); return false; } return true; }), funds = orders.filter((t) => t.kind === 'fund');
  const res = resolve(stocks, cat, []);
  const typeByKey = new Map<string, string>(), nameByKey = new Map<string, string>();
  for (const t of stocks) { const k = t.isin || t.instrument.toUpperCase(); if (!typeByKey.has(k)) typeByKey.set(k, assetType(t)); nameByKey.set(k, t.instrument); }
  const symKid = new Map<string, string>();
  const fm = new FundMaster(d.amfi, d.fundOverrides);
  const fundTrades: Trade[] = [], unmapped = new Set<string>(), navOf = new Map<string, number>();
  for (const t of funds) {
    const x = fm.resolve(t.instrument, t.isin); if (!x.match) { unmapped.add(t.instrument); continue; }
    typeByKey.set(x.match.isin, fundTaxType(x.match.category, x.match.name)); nameByKey.set(x.match.isin, x.match.name); if (x.match.nav) navOf.set(x.match.isin, x.match.nav);
    fundTrades.push({ ...t, isin: x.match.isin });
  }
  for (const k of kids.values()) if (k.childIsin) { if (k.childName) nameByKey.set(k.childIsin, k.childName); if (k.childSymbol) symKid.set(k.childIsin, k.childSymbol); }
  const fundRep = replay(fundTrades, 365);
  const combined = { open: [...res.replay.open, ...fundRep.open], realised: [...res.replay.realised, ...fundRep.realised], breaks: [...res.replay.breaks, ...fundRep.breaks], applied: [] as string[] };
  const synth = (r: { key: string; qty: number }, side: 'buy' | 'sell', value: number, date: string): Trade => ({ instrument: nameByKey.get(r.key) ?? r.key, isin: '', side, qty: r.qty, price: value / r.qty, value, date, time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock' });
  const expense = (r: any) => { if (isFundType(typeByKey.get(r.key))) return 0; const ty = (typeByKey.get(r.key) ?? 'listed_equity') as AssetType; return orderCharges(synth(r, 'buy', r.cost, r.buyDate), ty, broker, d.charges).deductible + orderCharges(synth(r, 'sell', r.proceeds, r.sellDate), ty, broker, d.charges, true).deductible; };
  const tax = taxView(combined, (k) => (typeByKey.get(k) ?? 'listed_equity') as AssetType, expense, d.taxRules);
  const dividends = computeDividends(canon.trades.filter((t) => t.kind !== 'fund'), res.events, d.feed, canon.lineage, d.divRules);

  // valuation: stocks and ETFs at the latest stored NSE close, funds at the latest AMFI NAV (last order price if the NAV is missing)
  const symOf = new Map<string, string>(); for (const t of canon.trades.filter((x) => x.kind !== 'fund')) symOf.set(t.isin, (t.symbol ?? t.instrument).toUpperCase());
  const latestEx = new Map<string, string>(); for (const r of d.feed) { const k = canon.lineage.key(r.symbol, r.isin); if (symOf.has(k) && (!latestEx.has(k) || latestEx.get(k)! < r.exDate) && d.prices[r.symbol] !== undefined) { latestEx.set(k, r.exDate); symOf.set(k, r.symbol); } }
  for (const [k, v] of symKid) symOf.set(k, v);
  const lastOrder = new Map<string, number>(); for (const t of fundTrades) lastOrder.set(t.isin, t.price);
  const notValued: string[] = []; let heldValue = 0, costOpen = 0; const holdings: Report['holdings'] = [];
  const priceOf = (key: string): number | undefined => (isFundType(typeByKey.get(key)) ? navOf.get(key) ?? lastOrder.get(key) : d.prices[symOf.get(key) ?? '']);
  for (const l of combined.open) {
    const px = priceOf(l.key); costOpen += l.qty * l.unitCost;
    if (px === undefined) notValued.push(`${nameByKey.get(l.key) ?? l.key} (${l.qty} units)`); else heldValue += l.qty * px;
    if (isFundType(typeByKey.get(l.key)) && !navOf.get(l.key)) notValued.push(`${nameByKey.get(l.key) ?? l.key}: valued at last order price`);
  }
  const books = inferBooks(combined.open, { typeOf: (k) => (typeByKey.get(k) ?? 'listed_equity') as AssetType, isFund: (k) => isFundType(typeByKey.get(k)) });
  const bt = bookTotals(books, priceOf);
  const byName = new Map<string, Report['holdings'][number]>();
  for (const t of books) { const nm = nameByKey.get(t.lot.key) ?? t.lot.key; const px = priceOf(t.lot.key); const e = byName.get(nm) ?? byName.set(nm, { name: nm, book: t.book, qty: 0, cost: 0, value: px === undefined ? null : 0 }).get(nm)!; e.qty += t.lot.qty; e.cost += t.lot.qty * t.lot.unitCost; if (px !== undefined && e.value !== null) e.value += t.lot.qty * px; }
  holdings.push(...byName.values());

  const ords: { date: string; side: 'buy' | 'sell'; value: number; charges?: number }[] = [];
  const ch = (t: Trade) => { const ty = (typeByKey.get(t.isin || t.instrument.toUpperCase()) ?? 'listed_equity') as AssetType; return orderCharges(t, ty, broker, d.charges).total; };
  for (const t of stocks) ords.push({ date: t.date, side: t.side, value: t.value, charges: ch(t) });
  for (const t of fundTrades) ords.push({ date: t.date, side: t.side, value: t.value, charges: 0 });
  for (const e of res.events) if (e.type === 'grant' && e.unitCost > 0) ords.push({ date: e.date, side: 'buy', value: e.qty * e.unitCost, charges: 0 });
  const perf = performance({ orders: ords, dividends: dividends.flatMap((y) => y.lines.map((l) => ({ date: l.exDate, net: l.net }))), holdingsValue: heldValue, asOf: d.pricesAsOf });
  const realised = combined.realised.reduce((a, r) => a + r.gain, 0);

  const warnings: string[] = [];
  const zero = stocks.filter((t) => t.value === 0);
  if (absorbed.length) warnings.push(`Broker credit(s) matched to a demerger and replaced by the demerger record (cost moved from the parent): ${absorbed.join('; ')}`);
  if (zero.length) warnings.push(`${zero.length} order(s) with zero value (a credit, not a purchase; cost unknown, likely a demerger or bonus credit): ` + zero.map((t) => `${t.instrument || t.symbol || t.isin} ${t.qty} on ${t.date}`).join('; '));
  if (unmapped.size) warnings.push(`Fund schemes not matched to AMFI: ${[...unmapped].join('; ')}`);
  const nm = (k: string) => nameByKey.get(k) ?? k;
  return {
    counts: { trades: m.trades.length, duplicates: m.duplicates, orders: orders.length, stockOrders: stocks.length, fundOrders: funds.length, openLots: combined.open.length },
    funds: { mapped: fundTrades.length, unmapped: [...unmapped] },
    resolver: { eventsFromFeed: res.facts.length, applied: res.applied.map((p) => `${nm((p.event as any).key)}: ${p.why}`), proposed: res.proposed.map((p) => `${nm((p.event as any).key)}: ${p.why}`), unexplained: res.unexplained.map((b) => ({ name: nm(b.key), date: b.date, qty: b.qty })), needsRecord: bc.skipped },
    warnings, tax, dividends, performance: { ...perf, realised, unrealised: heldValue - costOpen, costOpen, notValued },
    books: bt, holdings: holdings.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
  };
}
