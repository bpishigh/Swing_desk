// Compares a snapshot of the Claude Desk's stored numbers with the Repo Desk's for one session and writes data/compare/<date>.json and latest.json.
// Usage: node scripts/compare.mjs --claude=<snapshot.json> [--out=data/compare]
// Snapshot: { date, india: { tracker, feedHist }, us: { tracker, feedHist } } = the Claude Desk's tracker / feed_hist docs for that date (market data only).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { compareMarket, summarise } from '../src/ops/compare.ts';
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const file = arg('claude'); const out = arg('out') || 'data/compare';
if (!file) { console.error('usage: compare.mjs --claude=<snapshot.json>'); process.exit(2); }
const snap = JSON.parse(readFileSync(file, 'utf8'));
const D = snap.date;
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const repoSide = (m) => ({
  tracker: read(`data/${m}/tracker/${D}.json`), feedHist: read(`data/${m}/feed_hist/${D}.json`),
  breadth: read(`data/${m}/breadth.json`)?.[D]?.pct ?? null,
});
const india = compareMarket('India', { ...(snap.india || {}), breadth: snap.india?.tracker?.breadth ?? null }, repoSide('india'));
const us = compareMarket('US', { ...(snap.us || {}), breadth: snap.us?.tracker?.breadth ?? null }, repoSide('us'));
const doc = { date: D, generatedAt: new Date().toISOString(), summary: { India: summarise(india), US: summarise(us) }, rows: [...india, ...us] };
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/${D}.json`, JSON.stringify(doc, null, 1) + '\n');
writeFileSync(`${out}/latest.json`, JSON.stringify(doc, null, 1) + '\n');
console.log(JSON.stringify(doc.summary));
for (const r of doc.rows.filter((x) => x.status === 'differs')) console.log(`differs: ${r.market} ${r.item} ${r.field} claude ${r.claude} repo ${r.repo} (${r.diff}${r.unit})`);
