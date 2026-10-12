// End-to-end local report from broker files: read -> merge -> orders -> per-account FIFO -> charges -> tax view.
// Usage: node scripts/pm-report.mjs <broker:groww|zerodha> <file...> [--facts facts.json]   (one account per call; prints only, never writes personal data)
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/pm/csv.ts';
import { readXlsx } from '../src/pm/xlsx.ts';
import { readRows, mergeTrades, aggregateFills } from '../src/pm/reader.ts';
import { resolve } from '../src/pm/resolver.ts';
import { assetType } from '../src/pm/classify.ts';
import { orderCharges } from '../src/pm/charges.ts';
import { taxView } from '../src/pm/tax.ts';
import { computeDividends } from '../src/pm/dividends.ts';
import { FundMaster, fundTaxType } from '../src/pm/funds.ts';
import { replay } from '../src/pm/ledger.ts';
import { performance } from '../src/pm/performance.ts';
import { canonicalise } from '../src/pm/lineage.ts';
import { buildCatalogue, ipoCandidates } from '../src/pm/nse-catalogue.ts';
const [broker, ...rest] = process.argv.slice(2);
const ni = rest.indexOf('--nse'); const useNse = ni >= 0; if (useNse) rest.splice(ni, 1);
const fi = rest.indexOf('--facts'); const factsFile = fi >= 0 ? rest.splice(fi, 2)[1] : null;
const charges = JSON.parse(readFileSync('data/rules/charges.json', 'utf8')), rules = JSON.parse(readFileSync('data/rules/tax.json', 'utf8'));
const cat = factsFile ? JSON.parse(readFileSync(factsFile, 'utf8')) : { facts: [], candidates: [] };
const batches = [];
for (const f of rest) { const rows = /\.xlsx$/i.test(f) ? readXlsx(readFileSync(f))[0].rows : parseCsv(readFileSync(f, 'utf8')); const r = readRows(rows, { filename: f.split('/').pop() }); if (r.rejected) { console.log('REJECTED', f, r.rejected); continue; } batches.push(r.trades); }
const m = mergeTrades(batches);
let feed = [], dem = [];
if (useNse) { feed = JSON.parse(readFileSync('data/india/corp-actions-history.json', 'utf8')); dem = JSON.parse(readFileSync('data/rules/demergers.json', 'utf8')).records; }
const names = new Set(m.trades.map((t) => (t.symbol ?? t.instrument).toUpperCase()));
const pairs = feed.filter((r) => names.has(r.symbol.toUpperCase()) || m.trades.some((t) => t.isin && t.isin === r.isin)).map((r) => ({ symbol: r.symbol, isin: r.isin, date: r.exDate }));
const canon = canonicalise(m.trades, pairs);
const orders = aggregateFills(canon.trades);
let skipped = [];
if (useNse) { const held = new Set(canon.trades.map((t) => t.isin)); const bc = buildCatalogue(feed.filter((r) => pairs.some((p) => p.symbol === r.symbol && p.isin === r.isin) || held.has(canon.lineage.key(r.symbol, r.isin))), canon.lineage, dem, held); cat.facts = bc.catalogue.facts; cat.candidates = ipoCandidates(JSON.parse(readFileSync('data/rules/ipos.json', 'utf8')).records, canon.lineage, held); skipped = bc.skipped; }
const stocks = orders.filter((t) => t.kind !== 'fund'), funds = orders.filter((t) => t.kind === 'fund');
const res = resolve(stocks, cat, cat.overrides ?? []);
const typeByKey = new Map(); for (const t of stocks) if (!typeByKey.has(t.isin || t.instrument.toUpperCase())) typeByKey.set(t.isin || t.instrument.toUpperCase(), assetType(t));
const nameByKey = new Map(); for (const t of stocks) nameByKey.set(t.isin || t.instrument.toUpperCase(), t.instrument);
const synth = (r, side, value, date) => ({ instrument: nameByKey.get(r.key) ?? r.key, isin: '', side, qty: r.qty, price: value / r.qty, value, date, time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock' });
const expense = (r) => { const ty = typeByKey.get(r.key) ?? 'listed_equity'; return orderCharges(synth(r, 'buy', r.cost, r.buyDate), ty, broker, charges).deductible + orderCharges(synth(r, 'sell', r.proceeds, r.sellDate), ty, broker, charges, true).deductible; };
// funds: scheme -> AMFI code/ISIN/category (ISIN first, then name); FIFO per scheme; cost is the amount paid (stamp duty is taken before units)
const fm = new FundMaster(JSON.parse(readFileSync('data/rules/amfi-schemes.json', 'utf8')).rows, JSON.parse(readFileSync('data/rules/fund-overrides.json', 'utf8')).records);
const fundTrades = []; const unmapped = new Set();
for (const t of funds) { const x = fm.resolve(t.instrument, t.isin); if (!x.match) { unmapped.add(t.instrument); continue; } typeByKey.set(x.match.isin, fundTaxType(x.match.category, x.match.name)); nameByKey.set(x.match.isin, x.match.name); fundTrades.push({ ...t, isin: x.match.isin }); }
const fundRep = replay(fundTrades, 365);
const combined = { open: [...res.replay.open, ...fundRep.open], realised: [...res.replay.realised, ...fundRep.realised], breaks: [...res.replay.breaks, ...fundRep.breaks], applied: [] };
const isFund = (k) => !!typeByKey.get(k) && /fund|fof|hybrid/.test(typeByKey.get(k));
const years = taxView(combined, (k) => typeByKey.get(k) ?? 'listed_equity', (r) => (isFund(r.key) ? 0 : expense(r)), rules);
if (funds.length) console.log(`fund orders ${funds.length}: mapped ${fundTrades.length}, unmapped schemes ${unmapped.size}${unmapped.size ? ' (' + [...unmapped].join('; ') + ')' : ''}; open fund breaks ${fundRep.breaks.length}`);
const zero = stocks.filter((t) => t.value === 0); if (zero.length) console.log(`WARNING ${zero.length} order(s) with zero value (a credit, not a purchase: cost unknown, likely a demerger or bonus credit): ` + zero.map((t) => `${t.instrument || t.symbol || t.isin} ${t.qty} on ${t.date}`).join('; '));
console.log(`files ${rest.length}; trades ${m.trades.length} (duplicates dropped ${m.duplicates}); orders ${orders.length}; stock orders ${stocks.length}; fund orders ${funds.length}`);
console.log(`open lots ${res.replay.open.length}; applied ${res.applied.length}; proposed ${res.proposed.length}; unexplained ${res.unexplained.length}`);
for (const x of skipped) console.log('  NEEDS RECORD', x.symbol, x.exDate, x.why);
console.log('events applied from NSE history:', res.facts.length);
for (const p of [...res.applied, ...res.proposed]) console.log('  ' + p.status.toUpperCase(), (nameByKey.get(p.event.key) ?? p.event.key), p.why.slice(0, 110));
for (const b of res.unexplained) console.log('  OPEN SELL', (nameByKey.get(b.key) ?? b.key).padEnd(28), b.date, 'qty', b.qty);
for (const y of years) console.log(`FY ${y.fy}: equity+equity-fund STCG ${Math.round(y.equity.stcg)}  LTCG ${Math.round(y.equity.ltcg)}  exemption used ${y.equity.exemptionUsed}  est. tax ${y.equity.tax}  other-type gains (slab) ${y.slabGains}`);
if (years.length) console.log('banner:', years[0].banner);

if (useNse) {
  const dy = computeDividends(canon.trades.filter((t) => t.kind !== 'fund'), res.events, feed, canon.lineage, JSON.parse(readFileSync('data/rules/dividend.json', 'utf8')));
  for (const y of dy) console.log(`DIVIDENDS (computed) FY ${y.fy}: gross ${y.gross}  TDS ${y.tds}  net ${y.net}  (${y.lines.length} payments)`);
}

// ---- performance: XIRR on dated cash flows; holdings valued at the latest stored NSE close (stocks, ETFs) and latest AMFI NAV (funds)
{
  const bhavDir = 'data/india/bhav'; const { readdirSync } = await import('node:fs');
  const latest = readdirSync(bhavDir).filter((f) => f.endsWith('.json')).sort().pop(); const bhav = JSON.parse(readFileSync(`${bhavDir}/${latest}`, 'utf8'));
  const symOf = new Map(); for (const t of canon.trades.filter((x) => x.kind !== 'fund')) symOf.set(t.isin, (t.symbol ?? t.instrument).toUpperCase());
  const latestEx = new Map(); for (const r of feed) { const k = canon.lineage.key(r.symbol, r.isin); if (symOf.has(k) && (!latestEx.has(k) || latestEx.get(k) < r.exDate)) { latestEx.set(k, r.exDate); if (bhav.rows[r.symbol]) symOf.set(k, r.symbol); } }
  const navOf = new Map(); const navDate = new Map(); for (const t of funds) { const x = fm.resolve(t.instrument, t.isin); if (x.match) { navOf.set(x.match.isin, x.match.nav); navDate.set(x.match.isin, x.match.navDate); } }
  let held = 0, unvalued = []; const lastOrderPrice = new Map(); for (const t of fundTrades) lastOrderPrice.set(t.isin, t.price);
  for (const l of combined.open) {
    if (typeByKey.get(l.key) && /fund|fof|hybrid/.test(typeByKey.get(l.key))) { const nav = navOf.get(l.key) ?? lastOrderPrice.get(l.key); held += l.qty * nav; if (!navOf.get(l.key)) unvalued.push('fund at last order NAV: ' + (nameByKey.get(l.key) ?? l.key)); continue; }
    const px = bhav.rows[symOf.get(l.key)]?.[5]; if (px) held += l.qty * px; else unvalued.push((nameByKey.get(l.key) ?? l.key) + ' [' + l.key + ' ' + symOf.get(l.key) + ' qty ' + l.qty + ']');
  }
  const ords = [];
  const ch = (t) => { const ty = typeByKey.get(t.isin || t.instrument.toUpperCase()) ?? 'listed_equity'; return /fund|fof|hybrid/.test(ty) ? 0 : orderCharges(t, ty, broker, charges).total; };
  for (const t of stocks) ords.push({ date: t.date, side: t.side, value: t.value, charges: ch(t) });
  for (const t of fundTrades) ords.push({ date: t.date, side: t.side, value: t.value, charges: 0 });
  for (const e of res.events) if (e.type === 'grant' && e.unitCost > 0) ords.push({ date: e.date, side: 'buy', value: e.qty * e.unitCost, charges: 0 });
  const dv = useNse ? computeDividends(canon.trades.filter((t) => t.kind !== 'fund'), res.events, feed, canon.lineage, JSON.parse(readFileSync('data/rules/dividend.json', 'utf8'))).flatMap((y) => y.lines.map((l) => ({ date: l.exDate, net: l.net }))) : [];
  const p = performance({ orders: ords, dividends: dv, holdingsValue: held, asOf: latest.slice(0, 10) });
  const costOpen = combined.open.reduce((a, l) => a + l.qty * l.unitCost, 0), realisedGain = combined.realised.reduce((a, r) => a + r.gain, 0);
  console.log(`  realised gain ${Math.round(realisedGain)}, unrealised gain ${Math.round(held - costOpen)} (held ${Math.round(held)} vs cost of open lots ${Math.round(costOpen)}), dividends computed ${Math.round(p.dividends)}`);
  const pc = (x) => (x === null ? 'n/a' : (x * 100).toFixed(1) + '%');
  console.log(`PERFORMANCE as of ${p.asOf}: invested ${Math.round(p.invested)}, sold ${Math.round(p.sold)}, held now ${Math.round(p.held)}, computed dividends ${Math.round(p.dividends)}, gain ${Math.round(p.gain)} (price-only), XIRR price-only ${pc(p.xirrPriceOnly)}, with dividends ${pc(p.xirrWithDividends)}`);
  if (unvalued.length) console.log('  not valued:', unvalued.slice(0, 8).join('; '));
}
if (process.env.DEBUG_KEY) { console.log(res.replay.applied.filter((a) => a.includes(process.env.DEBUG_KEY)).join('\n').slice(0, 600)); console.log(res.replay.open.filter((l) => l.key === process.env.DEBUG_KEY).map((l) => `${l.date} ${l.qty} @ ${l.unitCost}`).join('\n')); }
