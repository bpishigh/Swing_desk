// AMFI scheme master from the public NAV file: scheme code, ISINs, name and category header, for mapping mutual fund orders by ISIN or name.
// Output data/rules/amfi-schemes.json (rows: [code, isinPayoutOrGrowth, isinReinvest, name, category]). Public data, no personal data.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
let txt = null, status = null;
for (const u of ['https://www.amfiindia.com/spages/NAVAll.txt', 'https://portal.amfiindia.com/spages/NAVAll.txt']) {
  const r = await fetch(u, { headers: { 'user-agent': UA } }); status = r.status;
  if (r.ok) { txt = await r.text(); break; }
}
if (!txt) { console.error('AMFI file unavailable, status', status); process.exit(1); }
const rows = []; let category = '';
for (const line of txt.split(/\r?\n/)) {
  const p = line.split(';');
  if (p.length >= 6 && /^\d+$/.test(p[0].trim())) rows.push([p[0].trim(), p[1].trim(), p[2].trim(), p[3].trim(), category]);
  else if (/^(Open|Close|Interval).*Schemes?\s*\(/i.test(line.trim())) category = line.trim().replace(/^.*\(/, '').replace(/\)\s*$/, '');
}
writeFileSync('data/rules/amfi-schemes.json', JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), cols: ['code', 'isin1', 'isin2', 'name', 'category'], rows }));
console.log(JSON.stringify({ schemes: rows.length, categories: new Set(rows.map((r) => r[4])).size }));
