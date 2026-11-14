// Delivery files (Batch C, package 21, C-210). Pure parsers: the full bhavcopy CSV (2021 on, header SYMBOL, SERIES, ..., TTL_TRD_QNTY, ..., DELIV_QTY, DELIV_PER) and the older MTO file (record lines "20,<no>,<symbol>,<series>,<traded>,<delivered>,<pct>"). A row is [symbol, series, traded, delivered]; delivery percent is delivered over traded, never read from the file's own rounding. Series kept: EQ and the trade-for-trade series BE and BZ.
export type DeliveryRow = [string, string, number, number];
export const KEEP = new Set(['EQ', 'BE', 'BZ']);
const num = (x: string | undefined): number => { const v = Number((x ?? '').replace(/,/g, '').trim()); return Number.isFinite(v) ? v : NaN; };
export function parseFullBhav(csv: string): { rows: DeliveryRow[]; date: string | null; bad: number } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return { rows: [], date: null, bad: 0 };
  const h = lines[0].split(',').map((x) => x.trim().toUpperCase()), i = (n: string) => h.indexOf(n);
  const iS = i('SYMBOL'), iR = i('SERIES'), iD = i('DATE1'), iT = i('TTL_TRD_QNTY'), iV = i('DELIV_QTY');
  if ([iS, iR, iT, iV].some((k) => k < 0)) return { rows: [], date: null, bad: lines.length - 1 };
  const rows: DeliveryRow[] = []; let bad = 0, date: string | null = null;
  for (const l of lines.slice(1)) {
    const c = l.split(',').map((x) => x.trim()), ser = c[iR];
    if (!KEEP.has(ser)) continue;
    const t = num(c[iT]), v = num(c[iV]);   // a "-" delivery figure (no delivery data that day) is missing, not zero
    if (!c[iS] || !(t >= 0) || Number.isNaN(v)) { bad++; continue; }
    if (!date && iD >= 0) { const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(c[iD] ?? ''); if (m) date = `${m[3]}-${{ JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' }[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}`; }
    rows.push([c[iS], ser, t, v]);
  }
  return { rows, date, bad };
}
export function parseMto(text: string): { rows: DeliveryRow[]; bad: number } {
  const rows: DeliveryRow[] = []; let bad = 0;
  for (const l of text.split(/\r?\n/)) {
    const c = l.split(',').map((x) => x.trim()); if (c[0] !== '20') continue;
    const t = num(c[4]), v = num(c[5]); if (!KEEP.has(c[3])) continue;
    if (!c[2] || !(t >= 0) || Number.isNaN(v)) { bad++; continue; }
    rows.push([c[2], c[3], t, v]);
  }
  return { rows, bad };
}
/** Delivery percent as the share of traded quantity taken into delivery; null when nothing traded. */
export const deliveryPct = (r: DeliveryRow): number | null => (r[2] > 0 ? (100 * r[3]) / r[2] : null);
