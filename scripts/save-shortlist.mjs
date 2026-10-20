// Saves the nightly India shortlist (public data) so a later real buy can be recognised as a Swing trade: one file per signal date in data/india/shortlist/.
// Lines come from the paper book's orders (sym, setup, trigger, stop, signal date; the ledger also back-fills earlier nights) and the scan's Ready list. The limit is the trigger plus the setup's limit percentage.
// Existing lines are never changed: a night's file only gains lines. Usage: node scripts/save-shortlist.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SETUPS } from '../src/engine/setups.ts';
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const dir = 'data/india/shortlist'; mkdirSync(dir, { recursive: true });
const r2 = (x) => Math.round(x * 100) / 100;
const found = [];   // { signalDate, line }
const book = rd('data/india/paper/book.json'), latest = rd('data/india/paper/latest.json'), scan = rd('data/india/scan/latest.json');
const orders = [...(book?.ledger ?? []), ...(latest?.newOrdersTonight ?? [])];
for (const o of orders) {
  const sp = SETUPS[o.setup]; const signalDate = o.signalDate ?? latest?.asOf;
  if (!sp || !signalDate || !(o.trigger > 0) || !((o.stopInitial ?? o.stop) > 0)) continue;
  found.push({ signalDate, line: { sym: o.sym, setup: o.setup, stream: o.stream ?? 'paper', trigger: r2(o.trigger), limit: r2(o.limit ?? o.trigger * (1 + sp.lim / 100)), stop: r2(o.stopInitial ?? o.stop), ...(Number.isFinite(o.atrPct) ? { atrPct: r2(o.atrPct) } : {}), ...(o.tags?.length ? { tags: o.tags } : {}) } });
}
for (const c of scan?.ready ?? []) if (c.setup && scan.asOf && [c.setup.trigger, c.setup.limit, c.setup.stop].every((x) => Number.isFinite(x) && x > 0)) found.push({ signalDate: scan.asOf, line: { sym: c.sym, setup: c.setup.id, stream: 'ready', trigger: r2(c.setup.trigger), limit: r2(c.setup.limit), stop: r2(c.setup.stop), ...(Number.isFinite(c.diag?.atr14) && c.close > 0 ? { atrPct: r2((c.diag.atr14 / c.close) * 100) } : {}) } });
const byDate = new Map(); for (const f of found) (byDate.get(f.signalDate) ?? byDate.set(f.signalDate, []).get(f.signalDate)).push(f.line);
let added = 0;
for (const [date, lines] of byDate) {
  const p = `${dir}/${date}.json`, cur = rd(p) ?? { signalDate: date, market: 'india', lines: [] };
  for (const l of lines) if (!cur.lines.some((x) => x.sym === l.sym && x.setup === l.setup && (x.stream ?? 'paper') === (l.stream ?? 'paper'))) { cur.lines.push(l); added++; }
  cur.lines.sort((a, b) => (a.sym + a.setup + (a.stream ?? '') < b.sym + b.setup + (b.stream ?? '') ? -1 : 1));
  const text = JSON.stringify(cur, null, 1) + '\n'; if (!existsSync(p) || readFileSync(p, 'utf8') !== text) writeFileSync(p, text);
}
console.log(`shortlist: ${byDate.size} night(s), ${added} new line(s)`);
