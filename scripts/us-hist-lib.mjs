// Reads the Nasdaq-sourced US store: base files (data/us/hist/<SYM>.json.gz, 10 years, split-adjusted by Nasdaq) plus daily tail files (data/us/hist-tail/<date>.json.gz)
// for sessions after the base. Returns the scan's day shape [ticker, close, high, low, volume]. Base wins where a date is in both.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
export const histSymbols = () => readdirSync('data/us/hist').filter((f) => f.endsWith('.json.gz')).map((f) => f.slice(0, -8));
export const readBase = (sym) => JSON.parse(gunzipSync(readFileSync(`data/us/hist/${sym}.json.gz`)));
export const tailDates = () => (existsSync('data/us/hist-tail') ? readdirSync('data/us/hist-tail').filter((f) => /^\d{4}-\d\d-\d\d\.json\.gz$/.test(f)).map((f) => f.slice(0, 10)).sort() : []);
export const readTail = (d) => JSON.parse(gunzipSync(readFileSync(`data/us/hist-tail/${d}.json.gz`)));
/** asof: only dates up to and including it. */
export function loadDays(asof) {
  const by = new Map();   // date -> Map(sym -> row)
  const put = (d, sym, row, force) => { if (asof && d > asof) return; let m = by.get(d); if (!m) by.set(d, (m = new Map())); if (force || !m.has(sym)) m.set(sym, row); };
  for (const sym of histSymbols()) { const b = readBase(sym); for (const [d, c, h, l, v] of b.bars) put(d, sym, [sym, c, h, l, v], true); }
  for (const d of tailDates()) { const t = readTail(d); for (const [sym, c, h, l, v] of t.rows) put(t.date, sym, [sym, c, h, l, v], false); }
  return [...by.keys()].sort().map((date) => ({ date, rows: [...by.get(date).values()] }));
}
