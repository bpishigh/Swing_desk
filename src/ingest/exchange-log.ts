// Wave 2 collection helpers (Batch C, C-5): parse the exchange's day files into stored rows. Pure. No network.
export interface Deal { date: string; symbol: string; name: string; client: string; side: 'BUY' | 'SELL'; units: number; price: number; remarks: string | null }
const MON: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
export const isoOf = (s: string): string | null => { const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim()); return m && MON[m[2].toUpperCase()] ? `${m[3]}-${MON[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}` : null; };
function splitCsv(line: string): string[] { const o: string[] = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o.map((x) => x.trim()); }
/** Bulk or block CSV: Date, Symbol, Security Name, Client Name, Buy/Sell, Quantity Traded, Trade Price / Wght. Avg. Price[, Remarks]. Rows that do not parse are counted, not guessed. */
export function parseDeals(csv: string): { rows: Deal[]; bad: number } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim()); const rows: Deal[] = []; let bad = 0;
  for (const l of lines.slice(1)) {
    const c = splitCsv(l); const date = isoOf(c[0] ?? ''), side = /^b/i.test(c[4] ?? '') ? 'BUY' : /^s/i.test(c[4] ?? '') ? 'SELL' : null, units = Number((c[5] ?? '').replace(/,/g, '')), price = Number((c[6] ?? '').replace(/,/g, ''));
    if (!date || !side || !(units > 0) || !(price > 0) || !c[1]) { bad++; continue; }
    rows.push({ date, symbol: c[1], name: c[2] ?? '', client: c[3] ?? '', side, units, price, remarks: c[7] ? c[7] : null });
  }
  return { rows, bad };
}
const list = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x : Array.isArray((x as { data?: unknown })?.data) ? (x as { data: Record<string, unknown>[] }).data : []);
/** Surveillance lists: GSM and ESM are arrays of rows; ASM has longterm and shortterm parts. Each row is kept as the exchange sent it (name, ISIN, stage), nothing renamed. */
export function parseSurveillance(asm: unknown, gsm: unknown, esm: unknown): { asmLong: Record<string, unknown>[]; asmShort: Record<string, unknown>[]; gsm: Record<string, unknown>[]; esm: Record<string, unknown>[] } {
  const a = (asm ?? {}) as { longterm?: unknown; shortterm?: unknown };
  return { asmLong: list(a.longterm), asmShort: list(a.shortterm), gsm: list(gsm), esm: list(esm) };
}
