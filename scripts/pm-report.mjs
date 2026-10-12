// Local report from broker files via the shared pipeline. Usage: node scripts/pm-report.mjs <groww|zerodha> <file...>   (prints only; never writes personal data)
import { readFileSync, readdirSync } from 'node:fs';
import { parseCsv } from '../src/pm/csv.ts';
import { readXlsx } from '../src/pm/xlsx.ts';
import { readRows } from '../src/pm/reader.ts';
import { runPipeline } from '../src/pm/pipeline.ts';
const [broker, ...files] = process.argv.slice(2);
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const bhavFile = readdirSync('data/india/bhav').filter((f) => f.endsWith('.json')).sort().pop(); const bhav = J('data/india/bhav/' + bhavFile);
const prices = {}; for (const [s, r] of Object.entries(bhav.rows)) if (r[5] != null) prices[s] = r[5];
const data = { feed: J('data/india/corp-actions-history.json'), demergers: J('data/rules/demergers.json').records, ipos: J('data/rules/ipos.json').records, amfi: J('data/rules/amfi-schemes.json').rows, fundOverrides: J('data/rules/fund-overrides.json').records, charges: J('data/rules/charges.json'), taxRules: J('data/rules/tax.json'), divRules: J('data/rules/dividend.json'), prices, pricesAsOf: bhav.date };
const batches = [];
for (const f of files) { const rows = /\.xlsx$/i.test(f) ? readXlsx(readFileSync(f))[0].rows : parseCsv(readFileSync(f, 'utf8')); const r = readRows(rows, { filename: f.split('/').pop() }); if (r.rejected) { console.log('REJECTED', f, r.rejected); continue; } batches.push(r.trades); }
const r = runPipeline(batches, broker, data);
const n = (x) => Math.round(x).toLocaleString('en-IN');
console.log(JSON.stringify(r.counts), 'funds mapped', r.funds.mapped);
for (const w of r.warnings) console.log('WARNING', w);
console.log(`resolver: ${r.resolver.eventsFromFeed} events applied; applied ${r.resolver.applied.length}; proposed ${r.resolver.proposed.length}; unexplained ${r.resolver.unexplained.length}`);
for (const p of r.resolver.proposed) console.log('  PROPOSED', p.slice(0, 120));
for (const u of r.resolver.unexplained) console.log('  OPEN SELL', u.name, u.date, u.qty);
for (const y of r.tax) console.log(`FY ${y.fy}: short ${n(y.equity.stcg)}  long ${n(y.equity.ltcg)}  other(slab) ${n(y.slabGains)}  est. tax ${n(y.equity.tax)}`);
for (const y of r.dividends) console.log(`DIVIDENDS FY ${y.fy}: gross ${n(y.gross)} TDS ${n(y.tds)} net ${n(y.net)}`);
const p = r.performance; const pc = (x) => (x === null ? 'n/a' : (x * 100).toFixed(1) + '%');
console.log(`PERFORMANCE ${p.asOf}: invested ${n(p.invested)} sold ${n(p.sold)} held ${n(p.held)} realised ${n(p.realised)} unrealised ${n(p.unrealised)} | XIRR price-only ${pc(p.xirrPriceOnly)}, with dividends ${pc(p.xirrWithDividends)}`);
console.log('BOOKS', JSON.stringify(Object.fromEntries(Object.entries(r.books).map(([k, v]) => [k, `${v.lots} lots, value ${n(v.value)}`]))));
if (p.notValued.length) console.log('not valued:', p.notValued.slice(0, 6).join('; '));
