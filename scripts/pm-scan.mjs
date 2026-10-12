// Local check of the reader against real uploads. Prints counts and issues only, never names, codes or amounts per person.
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/pm/csv.ts';
import { readXlsx } from '../src/pm/xlsx.ts';
import { readRows, mergeTrades, aggregateFills } from '../src/pm/reader.ts';
const batches = [];
for (const f of process.argv.slice(2)) {
  const rows = /\.xlsx$/i.test(f) ? readXlsx(readFileSync(f))[0].rows : parseCsv(readFileSync(f, 'utf8'));
  const r = readRows(rows, { filename: f.split('/').pop() });
  console.log(f.split('/').pop().replace(/[0-9]{6,}/g, '<id>').slice(0, 50).padEnd(50), r.rejected ?? `${r.trades.length} rows, ${r.issues.length} issues, ${r.confidence}, hdr@${r.profile.headerRow}, ${r.profile.dateFormat}, kinds ${[...new Set(r.trades.map(t => t.kind))]}`);
  for (const i of r.issues.slice(0, 3)) console.log('   ', i.row, i.reason);
  batches.push(r.trades);
}
const m = mergeTrades(batches); console.log('merged', m.trades.length, 'dup', m.duplicates, 'orders', aggregateFills(m.trades).length);
