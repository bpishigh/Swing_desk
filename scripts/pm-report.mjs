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
const [broker, ...rest] = process.argv.slice(2);
const fi = rest.indexOf('--facts'); const factsFile = fi >= 0 ? rest.splice(fi, 2)[1] : null;
const charges = JSON.parse(readFileSync('data/rules/charges.json', 'utf8')), rules = JSON.parse(readFileSync('data/rules/tax.json', 'utf8'));
const cat = factsFile ? JSON.parse(readFileSync(factsFile, 'utf8')) : { facts: [], candidates: [] };
const batches = [];
for (const f of rest) { const rows = /\.xlsx$/i.test(f) ? readXlsx(readFileSync(f))[0].rows : parseCsv(readFileSync(f, 'utf8')); const r = readRows(rows, { filename: f.split('/').pop() }); if (r.rejected) { console.log('REJECTED', f, r.rejected); continue; } batches.push(r.trades); }
const m = mergeTrades(batches); const orders = aggregateFills(m.trades);
const stocks = orders.filter((t) => t.kind !== 'fund'), funds = orders.filter((t) => t.kind === 'fund');
const res = resolve(stocks, cat, cat.overrides ?? []);
const typeByKey = new Map(); for (const t of stocks) if (!typeByKey.has(t.isin || t.instrument.toUpperCase())) typeByKey.set(t.isin || t.instrument.toUpperCase(), assetType(t));
const nameByKey = new Map(); for (const t of stocks) nameByKey.set(t.isin || t.instrument.toUpperCase(), t.instrument);
const synth = (r, side, value, date) => ({ instrument: nameByKey.get(r.key) ?? r.key, isin: '', side, qty: r.qty, price: value / r.qty, value, date, time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock' });
const expense = (r) => { const ty = typeByKey.get(r.key) ?? 'listed_equity'; return orderCharges(synth(r, 'buy', r.cost, r.buyDate), ty, broker, charges).deductible + orderCharges(synth(r, 'sell', r.proceeds, r.sellDate), ty, broker, charges, true).deductible; };
const years = taxView(res.replay, (k) => typeByKey.get(k) ?? 'listed_equity', expense, rules);
console.log(`files ${rest.length}; trades ${m.trades.length} (duplicates dropped ${m.duplicates}); orders ${orders.length}; stock orders ${stocks.length}; fund orders ${funds.length}`);
console.log(`open lots ${res.replay.open.length}; applied ${res.applied.length}; proposed ${res.proposed.length}; unexplained ${res.unexplained.length}`);
for (const b of res.unexplained) console.log('  OPEN SELL', (nameByKey.get(b.key) ?? b.key).padEnd(28), b.date, 'qty', b.qty);
for (const y of years) console.log(`FY ${y.fy}: equity STCG ${Math.round(y.equity.stcg)}  LTCG ${Math.round(y.equity.ltcg)}  exemption used ${y.equity.exemptionUsed}  est. tax ${y.equity.tax}  other-type gains (slab) ${y.slabGains}`);
if (years.length) console.log('banner:', years[0].banner);
