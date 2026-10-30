// The whole Portfolio Manager pipeline on already-parsed trades, with all public data passed in (no file or network access here),
// so the same code runs in Node (tests, local report) and in the browser (Upload tab). Personal data enters only as `batches`.
import { mergeTrades, aggregateFills,            } from './reader.js';
import { canonicalise } from './lineage.js';
import { buildCatalogue, ipoCandidates,                                                   } from './nse-catalogue.js';
import { resolve,               } from './resolver.js';
import { assetType, isEtf,                } from './classify.js';
import { orderCharges } from './charges.js';
import { taxView,              } from './tax.js';
import { cgRows,            } from './cgexport.js';
import { computeDividends,                   } from './dividends.js';
import { FundMaster, fundTaxType,              } from './funds.js';
import { assetClassOf,                 } from './assetclass.js';
import { replay } from './ledger.js';
import { performance,                      } from './performance.js';
import { inferBooks, bookTotals, attributeSales,                             } from './books.js';
import { buildTrades,                           } from './swingjournal.js';
import { tradeHistory,              } from './tradehistory.js';
import { matchBuy, sessionsBetween, gapNights,                                              } from './shortlist.js';
import { valuationSeries,               } from './valuation.js';

/** The 3-year ELSS lock runs from the day units are allotted, which can be a few days after the order date in a tradebook; this margin keeps a lot locked until it is clearly free. */
export const ELSS_MARGIN_DAYS = 5;
                             
                                                                                                         
                                             
                                                                                        
                                                                                                                               
                                                                                                                                                                                                                              
                                                                                                                                                                     
                                                                                                                        
 
                         
                                                                                                                            
                                                
                                                                                                                                                                                                                                                                                                                                                                                                                                                          
                     
                                                                                                                                                                  
                                                                       
                                                                                                                                                                                                                                                                                       
                                                                                                                                
                      
                                                                                                               
                    
                                                                                                                            
                           
                                                                                      
                   
                                                                                                                                      
                                                                                                                                                                                                                                                         
                                                                                                                                                                                    
                                                               
 
const masters = new WeakMap                    ();   // the fund list is large; build the matcher once per list, not once per run
const masterFor = (amfi           , ov       ) => { let m = masters.get(amfi); if (!m) masters.set(amfi, (m = new FundMaster(amfi, ov))); return m; };
const isFundType = (t         ) => !!t && /fund|fof|hybrid/.test(t);

export function runPipeline(batches           , broker                     , d            , decisions                           = {}, swingAnswers                               = {}, typeFix                         = {})         {
  const m = mergeTrades(batches);
  const names = new Set(m.trades.map((t) => (t.symbol ?? t.instrument).toUpperCase()));
  const isins = new Set(m.trades.filter((t) => t.isin).map((t) => t.isin));
  const pairs = d.feed.filter((r) => names.has(r.symbol.toUpperCase()) || (r.isin && isins.has(r.isin))).map((r) => ({ symbol: r.symbol, isin: r.isin, date: r.exDate }));
  const canon = canonicalise(m.trades, pairs);
  const orders = aggregateFills(canon.trades);
  const held = new Set(canon.trades.map((t) => t.isin));
  const pairSet = new Set(pairs.map((p) => p.symbol + '|' + p.isin));
  const bc = buildCatalogue(d.feed.filter((r) => pairSet.has(r.symbol + '|' + r.isin) || held.has(canon.lineage.key(r.symbol, r.isin))), canon.lineage, d.demergers, held);
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
  const fm = masterFor(d.amfi, d.fundOverrides);
  const fundCodes                         = {};
  const catByKey = new Map                (); const fundTrades          = [], unmapped = new Set        (), navOf = new Map                ();
  for (const t of funds) {
    const x = fm.resolve(t.instrument, t.isin); if (!x.match) { unmapped.add(t.instrument); continue; }
    catByKey.set(x.match.isin, x.match.category); typeByKey.set(x.match.isin, fundTaxType(x.match.category, x.match.name, d.fundMix?.[x.match.isin]?.eqMin ?? null)); nameByKey.set(x.match.isin, x.match.name); if (x.match.nav) navOf.set(x.match.isin, x.match.nav);
    fundCodes[x.match.isin] = x.match.code; fundTrades.push({ ...t, isin: x.match.isin });
  }
  for (const k of kids.values()) if (k.childIsin) { if (k.childName) nameByKey.set(k.childIsin, k.childName); if (k.childSymbol) symKid.set(k.childIsin, k.childSymbol); }
  for (const [k, v] of Object.entries(typeFix)) if (typeByKey.has(k) && d.taxRules.types[v                                 ] && isFundType(v) === isFundType(typeByKey.get(k))) typeByKey.set(k, v);   // the owner's correction wins over the guess
  const fundRep = replay(fundTrades, 365);
  const combined = { open: [...res.replay.open, ...fundRep.open], realised: [...res.replay.realised, ...fundRep.realised], breaks: [...res.replay.breaks, ...fundRep.breaks], applied: []             };
  const synth = (r                              , side                , value        , date        )        => ({ instrument: nameByKey.get(r.key) ?? r.key, isin: '', side, qty: r.qty, price: value / r.qty, value, date, time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock' });
  const expense = (r     ) => { if (isFundType(typeByKey.get(r.key))) return 0; const ty = (typeByKey.get(r.key) ?? 'listed_equity')             ; return orderCharges(synth(r, 'buy', r.cost, r.buyDate), ty, broker, d.charges).deductible + orderCharges(synth(r, 'sell', r.proceeds, r.sellDate), ty, broker, d.charges, true).deductible; };
  const tax = taxView(combined, (k) => (typeByKey.get(k) ?? 'listed_equity')             , expense, d.taxRules);
  const cg = cgRows(combined, (k) => (typeByKey.get(k) ?? 'listed_equity')             , (k) => nameByKey.get(k) ?? k, expense, d.taxRules);
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
  const accountValue = combined.open.reduce((t, l) => t + l.qty * (priceOf(l.key) ?? l.unitCost), 0);
  const cal                  = d.shortlist ? { holidays: d.shortlist.holidays, extra: d.shortlist.extra } : undefined;
  // Match every open lot against the saved shortlists. A later buy of a stock that already matched (an add to a Swing trade, or a second order the same day) is proposed too, whatever its price.
  const direct = new Map                                     ();
  const lotId = (l                                                 ) => `${l.key}|${l.date}|${Math.round(l.unitCost * 1e4)}`;
  // Every lot ever bought and still in the replay, open or sold: its original size and its sells. Recognition looks at these, so a closed trade can be recognised too.
  const histMap = new Map                 ();
  const histOf = (key        , date        , unitCost        )          => { const id = lotId({ key, date, unitCost }); let h = histMap.get(id); if (!h) histMap.set(id, (h = { key, date, unitCost, qty: 0, sells: [] })); return h; };
  for (const l of combined.open) histOf(l.key, l.date, l.unitCost).qty += l.qty;
  for (const r of combined.realised) { const h = histOf(r.key, r.buyDate, r.cost / r.qty); h.qty += r.qty; h.sells.push({ date: r.sellDate, qty: r.qty, price: r.proceeds / r.qty }); }
  const hist = [...histMap.values()];
  if (d.shortlist) for (const l of hist) { const sym = symOf.get(l.key); direct.set(lotId(l), sym ? matchBuy(sym, l.date, l.unitCost, d.shortlist.lines, d.shortlist.match, cal, (hist.some((o) => o.key === l.key && o.date === l.date && o.sells.length) ? undefined : { lotValue: hist.filter((o) => o.key === l.key && o.date === l.date).reduce((x, o) => x + o.qty * o.unitCost, 0), accountValue })) : null); }
  const swingMatch = d.shortlist ? (lot                                                 ) => {
    let m = direct.get(lotId(lot)) ?? null;
    if (!m) {
      const win = d.shortlist .match.addWindowSessions;
      if (typeof win === 'number' && Number.isFinite(win) && win > 0) {
        const base = hist.filter((o) => o.qty - o.sells.reduce((t, x) => t + x.qty, 0) > 1e-9 && o.key === lot.key && o.date <= lot.date && direct.get(lotId(o)) && swingAnswers[`${o.key}|${o.date}`] !== 'no' && (direct.get(lotId(o)) .tier === 'exact' || swingAnswers[`${o.key}|${o.date}`] === 'yes') && sessionsBetween(o.date, lot.date, cal) <= win && lotId(o) !== lotId(lot)).sort((x, y) => y.date.localeCompare(x.date))[0];
        const bm = base ? direct.get(lotId(base)) : null;
        if (base && bm) m = { tier: 'near', line: bm.line, sessions: sessionsBetween(bm.line.signalDate, lot.date, cal), outsidePct: 0, why: base.date === lot.date ? `another buy of this stock on the same day matched the ${bm.line.signalDate} shortlist` : `a later buy of a stock you bought on the ${bm.line.signalDate} shortlist (on ${base.date}): an add to that trade?` };
      }
    }
    return m ? { ...m, answer: swingAnswers[`${lot.key}|${lot.date}`] } : null;
  } : undefined;
  const tagged0 = inferBooks(combined.open, { typeOf: (k) => (typeByKey.get(k) ?? 'listed_equity')             , isFund: (k) => isFundType(typeByKey.get(k)), isEtf: (k) => isEtf((nameByKey.get(k) ?? k) + ' ' + (symOf.get(k) ?? ''), (typeByKey.get(k) ?? 'listed_equity')             ),
    swingGoLive: d.shortlist ? (d.shortlist.liveFrom ?? (d.shortlist.lines.length ? d.shortlist.lines.map((l) => l.signalDate).sort()[0] : null)) : null, swingMatch,
    maxHold: d.shortlist && typeof d.shortlist.match.maxHoldSessions === 'number' && d.pricesAsOf ? { sessions: d.shortlist.match.maxHoldSessions, today: d.pricesAsOf, cal } : undefined });
  const sales = new Map                                    ();
  for (const r of combined.realised) { const k = `${r.key}|${r.sellDate}`, g = sales.get(k) ?? { key: r.key, date: r.sellDate, qty: 0, buyDates: []            , avgPrice: 0, _v: 0 }; g.qty += r.qty; g._v += r.proceeds; if (!g.buyDates.includes(r.buyDate)) g.buyDates.push(r.buyDate); sales.set(k, g); }
  const saleGroups              = [...sales.values()].map((g) => ({ key: g.key, date: g.date, qty: g.qty, buyDates: g.buyDates, avgPrice: g.qty > 0 ? g._v / g.qty : 0 }));
  // A close at or below the lot's stop within the last few sessions before a sale is the Swing Desk's exit flag: that sale is taken as the Swing exit (design section 3, partial sells).
  const exitFlag = (t        , g           )                => {
    const ph = d.priceHistory, sym = symOf.get(g.key), stop = t.swing?.stop, win = d.shortlist?.match.exitFlagSessions;
    if (!ph || !sym || !(stop && stop > 0) || !(typeof win === 'number' && win > 0)) return null;
    const px = ph.px[sym]; if (!px) return null;
    const hi = ph.dates.findIndex((x) => x >= g.date), end = hi < 0 ? ph.dates.length - 1 : (ph.dates[hi] === g.date ? hi : hi - 1);
    for (let i = Math.max(0, end - win); i <= end; i++) { const c = px[i]; if (c != null && c <= stop && ph.dates[i] > t.lot.date) return `the close on ${ph.dates[i]} was at or below this lot's stop ${stop}, within ${win} sessions of the sale, so it is taken as your Swing exit`; }
    return null;
  };
  const { tagged: books, proposals: saleP, exits } = d.shortlist ? attributeSales(tagged0, saleGroups, swingAnswers, exitFlag) : { tagged: tagged0, proposals: [], exits: [] };
  const goLive = d.shortlist ? (d.shortlist.liveFrom ?? (d.shortlist.lines.length ? d.shortlist.lines.map((l) => l.signalDate).sort()[0] : null)) : null;
  // A split, demerger or rename after the buy changes units for the open part but not for the sales already made, so such a trade cannot be scored reliably: it is left out and named.
  const evAfter                                  = [];
  for (const a of res.replay.applied) { try { const e = JSON.parse(a.slice(a.indexOf('{'))); if (['split', 'demerger', 'rename'].includes(e.type)) for (const k of [e.key, e.parent, e.child, e.from, e.to]) if (k) evAfter.push({ key: k, date: e.date }); } catch { /* unreadable record: ignored */ } }
  const skipped = new Set        (), eligible = (l         ) => !isFundType(typeByKey.get(l.key)) && !isEtf((nameByKey.get(l.key) ?? l.key) + ' ' + (symOf.get(l.key) ?? ''), (typeByKey.get(l.key) ?? 'listed_equity')             );
  const journal           = swingMatch && goLive ? buildTrades(hist, (l) => { if (l.date < goLive || !eligible(l)) return null; if (evAfter.some((e) => e.key === l.key && e.date > l.date)) { const m0 = swingMatch(l); if (m0 && (m0.tier === 'exact' || m0.answer === 'yes')) skipped.add(nameByKey.get(l.key) ?? l.key); return null; } const m = swingMatch(l); if (!m) return null; const tier = m.tier === 'exact' ? 'exact'          : m.answer === 'yes' ? 'near-confirmed'          : null; return tier ? { setup: m.line.setup, stop: m.line.stop, trigger: m.line.trigger, tier } : null; }, exits, swingAnswers, (k) => nameByKey.get(k) ?? k, priceOf) : [];
  const saleProposals = saleP.map((p) => ({ key: p.key, name: nameByKey.get(p.key) ?? p.key, date: p.date, qty: Math.round(p.qty * 1000) / 1000, price: Math.round(p.avgPrice * 100) / 100, swingDate: p.swingDate, swingQty: p.swingQty }));
  const swingGaps = d.shortlist?.checked ? gapNights(d.shortlist.checked, cal) : [];
  const swingProposals = books.filter((t) => t.proposal).map((t) => ({ key: t.lot.key, name: nameByKey.get(t.lot.key) ?? t.lot.key, date: t.lot.date, qty: t.lot.qty, price: t.lot.unitCost, why: t.proposal .why, setup: t.proposal .line.setup, stop: t.proposal .line.stop }));
  const bookByKey = new Map                     ();
  for (const t of books) (bookByKey.get(t.lot.key) ?? bookByKey.set(t.lot.key, new Set()).get(t.lot.key) ).add(t.book);
  for (const j of journal) (bookByKey.get(j.key) ?? bookByKey.set(j.key, new Set()).get(j.key) ).add('Swing');
  const kindOf = (k        )                           => (isFundType(typeByKey.get(k)) ? 'Fund' : isEtf((nameByKey.get(k) ?? k) + ' ' + (symOf.get(k) ?? ''), (typeByKey.get(k) ?? 'listed_equity')             ) ? 'ETF' : 'Stock');
  const bookOf = (k        ) => { const b = bookByKey.get(k); return b && b.size ? [...b].sort().join(' + ') : kindOf(k) === 'Stock' ? 'Legacy' : 'Long-term'; };
  const keyOfT = (t       ) => t.isin || t.instrument.toUpperCase();
  const fundKeys = new Set(funds.map(keyOfT));   // all fund trades, including ones the AMFI list cannot match
  for (const t of funds) { const k = keyOfT(t); if (!nameByKey.has(k)) nameByKey.set(k, t.instrument); }
  const kindOf2 = (k        )                           => (fundKeys.has(k) && !typeByKey.has(k) ? 'Fund' : kindOf(k));
  const openQty = new Map                (); for (const l of combined.open) openQty.set(l.key, (openQty.get(l.key) ?? 0) + l.qty);
  const matchedFund = new Set(fundTrades.map((t) => t.tradeId + '|' + t.orderId + '|' + t.date));
  const history = tradeHistory([...stocks, ...fundTrades, ...funds.filter((t) => !matchedFund.has(t.tradeId + '|' + t.orderId + '|' + t.date))].map((t) => ({ key: keyOfT(t), date: t.date, side: t.side, qty: t.qty, price: t.price })), combined.realised, (k) => nameByKey.get(k) ?? k, kindOf2, bookOf, new Date().toISOString().slice(0, 10), openQty, (k) => (isFundType(typeByKey.get(k)) || fundKeys.has(k) ? '' : symOf.get(k) ?? ''));
  const bt = bookTotals(books, priceOf);
  const byName = new Map                                    ();
  for (const t of books) { const nm = nameByKey.get(t.lot.key) ?? t.lot.key; const px = priceOf(t.lot.key); const fundLike = isFundType(typeByKey.get(t.lot.key)); const e = byName.get(nm) ?? byName.set(nm, { name: nm, symbol: fundLike ? '' : symOf.get(t.lot.key) ?? '', isin: t.lot.key.startsWith('INF') ? t.lot.key : undefined, kind: fundLike ? 'Fund' : isEtf(nm + ' ' + (symOf.get(t.lot.key) ?? ''), (typeByKey.get(t.lot.key) ?? 'listed_equity')             ) ? 'ETF' : 'Stock', book: t.book, qty: 0, cost: 0, value: px === undefined ? null : 0, price: px ?? null }).get(nm) ; e.qty += t.lot.qty; e.cost += t.lot.qty * t.lot.unitCost; if (px !== undefined && e.value !== null) e.value += t.lot.qty * px; }
  const catByName = new Map                (); for (const [k, nm] of nameByKey) if (catByKey.has(k)) catByName.set(nm, catByKey.get(k) );
  for (const t of books) {
    const nm = nameByKey.get(t.lot.key) ?? t.lot.key, e = byName.get(nm);
    if (e && e.type === undefined) { e.type = typeByKey.get(t.lot.key); e.fixKey = t.lot.key; }
    if (e && e.assetClass === undefined) {
      // An exchange-traded unit with a fund ISIN (INF...) is an ETF, not a share, whatever its listed name: the AMFI list gives its scheme name and category.
      let label = e.name;
      if (e.kind === 'Stock' && t.lot.key.startsWith('INF')) { const m = fm.resolve(nm, t.lot.key).match; e.kind = 'ETF'; if (m) { catByName.set(nm, m.category); e.category = m.category; label = m.name; } }
      e.category = e.category ?? catByName.get(nm);
      e.assetClass = assetClassOf(e.kind, label, e.category ?? '', typeByKey.get(t.lot.key) ?? '');
    }
  }
  { const lim = new Date(); lim.setFullYear(lim.getFullYear() - 3); lim.setDate(lim.getDate() - ELSS_MARGIN_DAYS); const cut = lim.toISOString().slice(0, 10);
    for (const t of books) { const nm = nameByKey.get(t.lot.key) ?? t.lot.key, e = byName.get(nm), px = priceOf(t.lot.key); if (e && px !== undefined && /elss|tax saver|tax advantage/i.test(nm + ' ' + (e.category ?? '')) && t.lot.date > cut) e.locked = (e.locked ?? 0) + t.lot.qty * px; } }  // ELSS units are locked for 3 years from each purchase
  const lockCut = (() => { const x = new Date(); x.setFullYear(x.getFullYear() - 3); x.setDate(x.getDate() - ELSS_MARGIN_DAYS); return x.toISOString().slice(0, 10); })();
  const openLots                     = books.flatMap((t) => { const nm = nameByKey.get(t.lot.key) ?? t.lot.key, e = byName.get(nm), px = priceOf(t.lot.key); return e && px !== undefined ? [{ name: nm, kind: e.kind, book: t.book, assetClass: e.assetClass ?? null, category: e.category, type: typeByKey.get(t.lot.key) ?? 'listed_equity', date: t.lot.date, qty: t.lot.qty, unitCost: t.lot.unitCost, price: px, locked: /elss|tax saver|tax advantage/i.test(nm + ' ' + (e.category ?? '')) && t.lot.date > lockCut, ...(t.swing ? { stop: t.swing.stop, setup: t.swing.setup } : {}) }] : []; });
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
    const idx = all.filter(([x, i]) => x >= recent || i % 5 === 0 || (i + 1 < ph.dates.length && x <= `${x.slice(0, 4)}-03-31` && ph.dates[i + 1] > `${x.slice(0, 4)}-03-31`) || i === ph.dates.length - 1);   // thinned on the shared date list (not per account), so accounts line up when added together
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
    warnings, tax, cgRows: cg, dividends, performance: { ...perf, realised, unrealised: heldValue - costOpen, costOpen, notValued },
    books: bt, swingProposals, saleProposals, swingGaps, journal, journalSkipped: [...skipped], history, openLots, holdings: holdings.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), series, fundCodes,
  };
}
