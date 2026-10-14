// The whole Portfolio Manager pipeline on already-parsed trades, with all public data passed in (no file or network access here),
// so the same code runs in Node (tests, local report) and in the browser (Upload tab). Personal data enters only as `batches`.
import { mergeTrades, aggregateFills,            } from './reader.js';
import { canonicalise } from './lineage.js';
import { buildCatalogue, ipoCandidates,                                                   } from './nse-catalogue.js';
import { resolve,               } from './resolver.js';
import { assetType, isEtf,                } from './classify.js';
import { orderCharges } from './charges.js';
import { taxView,              } from './tax.js';
import { computeDividends,                   } from './dividends.js';
import { FundMaster, fundTaxType,              } from './funds.js';
import { replay } from './ledger.js';
import { performance,                      } from './performance.js';
import { inferBooks, bookTotals } from './books.js';
import { valuationSeries,               } from './valuation.js';

                             
                                                                                                         
                                             
                                                                                        
                                                                                                                               
                                                                                                                        
 
                         
                                                                                                                            
                                                
                                                                                                                                                                                                                                                                                                                                                                                                                                                          
                     
                                                                                                                                                 
                                                                       
                                                                                                                                                                    
                                                                                                                                                                                    
                                                               
 
const isFundType = (t         ) => !!t && /fund|fof|hybrid/.test(t);

export function runPipeline(batches           , broker                     , d            , decisions                           = {})         {
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
  const kids = new Map(d.demergers.filter((x) => x.childIsin).map((x) => [x.childIsin , x]         ));
  const factKids = new Set(cat.facts.filter((f     ) => f.type === 'demerger').map((f     ) => f.child));
  const absorbed           = [];
  const stocks = orders.filter((t) => t.kind !== 'fund').filter((t) => { if (t.value === 0 && t.side === 'buy' && factKids.has(t.isin) && kids.has(t.isin)) { absorbed.push(`${kids.get(t.isin) .childName ?? t.isin} ${t.qty} on ${t.date}`); return false; } return true; }), funds = orders.filter((t) => t.kind === 'fund');
  const res = resolve(stocks, cat, [], 365, decisions);
  const typeByKey = new Map                (), nameByKey = new Map                ();
  for (const t of stocks) { const k = t.isin || t.instrument.toUpperCase(); if (!typeByKey.has(k)) typeByKey.set(k, assetType(t)); nameByKey.set(k, t.instrument); }
  const symKid = new Map                ();
  const fm = new FundMaster(d.amfi, d.fundOverrides);
  const fundCodes                         = {};
  const fundTrades          = [], unmapped = new Set        (), navOf = new Map                ();
  for (const t of funds) {
    const x = fm.resolve(t.instrument, t.isin); if (!x.match) { unmapped.add(t.instrument); continue; }
    typeByKey.set(x.match.isin, fundTaxType(x.match.category, x.match.name)); nameByKey.set(x.match.isin, x.match.name); if (x.match.nav) navOf.set(x.match.isin, x.match.nav);
    fundCodes[x.match.isin] = x.match.code; fundTrades.push({ ...t, isin: x.match.isin });
  }
  for (const k of kids.values()) if (k.childIsin) { if (k.childName) nameByKey.set(k.childIsin, k.childName); if (k.childSymbol) symKid.set(k.childIsin, k.childSymbol); }
  const fundRep = replay(fundTrades, 365);
  const combined = { open: [...res.replay.open, ...fundRep.open], realised: [...res.replay.realised, ...fundRep.realised], breaks: [...res.replay.breaks, ...fundRep.breaks], applied: []             };
  const synth = (r                              , side                , value        , date        )        => ({ instrument: nameByKey.get(r.key) ?? r.key, isin: '', side, qty: r.qty, price: value / r.qty, value, date, time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock' });
  const expense = (r     ) => { if (isFundType(typeByKey.get(r.key))) return 0; const ty = (typeByKey.get(r.key) ?? 'listed_equity')             ; return orderCharges(synth(r, 'buy', r.cost, r.buyDate), ty, broker, d.charges).deductible + orderCharges(synth(r, 'sell', r.proceeds, r.sellDate), ty, broker, d.charges, true).deductible; };
  const tax = taxView(combined, (k) => (typeByKey.get(k) ?? 'listed_equity')             , expense, d.taxRules);
  const dividends = computeDividends(canon.trades.filter((t) => t.kind !== 'fund'), res.events, d.feed, canon.lineage, d.divRules);

  // valuation: stocks and ETFs at the latest stored NSE close, funds at the latest AMFI NAV (last order price if the NAV is missing)
  const symOf = new Map                (); for (const t of canon.trades.filter((x) => x.kind !== 'fund')) symOf.set(t.isin, (t.symbol ?? t.instrument).toUpperCase());
  const latestEx = new Map                (); for (const r of d.feed) { const k = canon.lineage.key(r.symbol, r.isin); if (symOf.has(k) && (!latestEx.has(k) || latestEx.get(k)  < r.exDate) && d.prices[r.symbol] !== undefined) { latestEx.set(k, r.exDate); symOf.set(k, r.symbol); } }
  for (const [k, v] of symKid) symOf.set(k, v);
  const lastOrder = new Map                (); for (const t of fundTrades) lastOrder.set(t.isin, t.price);
  const notValued           = []; let heldValue = 0, costOpen = 0; const holdings                     = [];
  const priceOf = (key        )                     => (isFundType(typeByKey.get(key)) ? navOf.get(key) ?? lastOrder.get(key) : d.prices[symOf.get(key) ?? '']);
  for (const l of combined.open) {
    const px = priceOf(l.key); costOpen += l.qty * l.unitCost;
    if (px === undefined) notValued.push(`${nameByKey.get(l.key) ?? l.key} (${l.qty} units)`); else heldValue += l.qty * px;
    if (isFundType(typeByKey.get(l.key)) && !navOf.get(l.key)) notValued.push(`${nameByKey.get(l.key) ?? l.key}: valued at last order price`);
  }
  const books = inferBooks(combined.open, { typeOf: (k) => (typeByKey.get(k) ?? 'listed_equity')             , isFund: (k) => isFundType(typeByKey.get(k)) });
  const bt = bookTotals(books, priceOf);
  const byName = new Map                                    ();
  for (const t of books) { const nm = nameByKey.get(t.lot.key) ?? t.lot.key; const px = priceOf(t.lot.key); const fundLike = isFundType(typeByKey.get(t.lot.key)); const e = byName.get(nm) ?? byName.set(nm, { name: nm, symbol: fundLike ? '' : symOf.get(t.lot.key) ?? '', kind: fundLike ? 'Fund' : isEtf(nm + ' ' + (symOf.get(t.lot.key) ?? ''), (typeByKey.get(t.lot.key) ?? 'listed_equity')             ) ? 'ETF' : 'Stock', book: t.book, qty: 0, cost: 0, value: px === undefined ? null : 0, price: px ?? null }).get(nm) ; e.qty += t.lot.qty; e.cost += t.lot.qty * t.lot.unitCost; if (px !== undefined && e.value !== null) e.value += t.lot.qty * px; }
  holdings.push(...byName.values());

  const ords                                                                            = [];
  const ch = (t       ) => { const ty = (typeByKey.get(t.isin || t.instrument.toUpperCase()) ?? 'listed_equity')             ; return orderCharges(t, ty, broker, d.charges).total; };
  for (const t of stocks) ords.push({ date: t.date, side: t.side, value: t.value, charges: ch(t) });
  for (const t of fundTrades) ords.push({ date: t.date, side: t.side, value: t.value, charges: 0 });
  for (const e of res.events) if (e.type === 'grant' && e.unitCost > 0) ords.push({ date: e.date, side: 'buy', value: e.qty * e.unitCost, charges: 0 });
  const perf = performance({ orders: ords, dividends: dividends.flatMap((y) => y.lines.map((l) => ({ date: l.exDate, net: l.net }))), holdingsValue: heldValue, asOf: d.pricesAsOf });
  const realised = combined.realised.reduce((a, r) => a + r.gain, 0);

  let series                    = null;
  if (d.priceHistory) {
    const ph = d.priceHistory, first = [...stocks, ...(d.navHistory ? fundTrades : [])].map((t) => t.date).sort()[0] ?? '';
    const all = ph.dates.map((x, i) => [x, i]         ).filter(([x]) => x >= first);
    // Long histories are thinned so the daily replay stays fast: every day in the last 400 days, one day in five before that, and always the last session on or before each 31 March (the financial-year boundaries the page needs).
    const recent = ph.dates.length ? new Date(Date.parse(ph.dates[ph.dates.length - 1]) - 400 * 86400000).toISOString().slice(0, 10) : '';
    const idx = all.filter(([x], k) => x >= recent || k % 5 === 0 || (k + 1 < all.length && x <= `${x.slice(0, 4)}-03-31` && all[k + 1][0] > `${x.slice(0, 4)}-03-31`) || k === all.length - 1);
    const dates = idx.map(([x]) => x), at = new Map(idx);
    const navDates = new Map                  (); for (const [k, m] of Object.entries(d.navHistory ?? {})) navDates.set(k, Object.keys(m).sort());
    const price = (key        , date        )                     => {
      if (isFundType(typeByKey.get(key))) { const m = d.navHistory?.[key]; if (!m) return undefined; if (m[date] !== undefined) return m[date]; const ds = navDates.get(key) ; let lo = 0, hi = ds.length - 1, best = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (ds[mid] <= date) { best = mid; lo = mid + 1; } else hi = mid - 1; } return best >= 0 ? m[ds[best]] : undefined; }
      const arr = ph.px[symOf.get(key) ?? '']; return arr?.[at.get(date) ] ?? undefined;
    };
    series = valuationSeries([...stocks, ...(d.navHistory ? fundTrades : [])], res.events, dates, price);
  }
  const warnings           = [];
  const zero = stocks.filter((t) => t.value === 0);
  if (absorbed.length) warnings.push(`Your broker showed free shares from a demerger (${absorbed.join('; ')}). The demerger is already counted from public records, with the cost moved over from the original company, so the broker's free credit was ignored to avoid counting it twice.`);
  if (zero.length) warnings.push(`${zero.length} order(s) with zero value (a credit, not a purchase; cost unknown, likely a demerger or bonus credit): ` + zero.map((t) => `${t.instrument || t.symbol || t.isin} ${t.qty} on ${t.date}`).join('; '));
  if (unmapped.size) warnings.push(`Fund schemes not matched to AMFI: ${[...unmapped].join('; ')}`);
  const nm = (k        ) => nameByKey.get(k) ?? k;
  return {
    counts: { trades: m.trades.length, duplicates: m.duplicates, orders: orders.length, stockOrders: stocks.length, fundOrders: funds.length, openLots: combined.open.length },
    funds: { mapped: fundTrades.length, unmapped: [...unmapped] },
    resolver: { eventsFromFeed: res.facts.length, applied: res.applied.map((p) => `${nm((p.event       ).key)}: ${p.why}`), proposed: res.proposed.map((p) => `${nm((p.event       ).key)}: ${p.why}`),
      proposedItems: res.proposed.filter((p) => p.event.type === 'grant').map((p) => { const e = p.event       ; return { key: e.key, name: nm(e.key), kind: /rights/.test(p.why) ? 'rights entitlement'          : 'IPO allotment'         , date: e.date, qty: e.qty, unitCost: e.unitCost, why: p.why }; }),
      decided: Object.entries(decisions).map(([k, v]) => ({ key: k, name: nm(k), action: v.action, unitCost: v.unitCost })), unexplained: res.unexplained.map((b) => ({ name: nm(b.key), date: b.date, qty: b.qty })), needsRecord: bc.skipped },
    flows: ords.map((o) => ({ date: o.date, amount: o.side === 'buy' ? -(o.value + (o.charges ?? 0)) : o.value - (o.charges ?? 0) })),
    divFlows: dividends.flatMap((y) => y.lines.map((l) => ({ date: l.exDate, amount: l.net }))),
    warnings, tax, dividends, performance: { ...perf, realised, unrealised: heldValue - costOpen, costOpen, notValued },
    books: bt, holdings: holdings.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), series, fundCodes,
  };
}
