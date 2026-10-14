// Market-cap segment of an Indian stock, from the NSE index constituent lists: Nifty 100 (large), Nifty Midcap 150 (mid), Nifty Smallcap 250 (small).
// A stock on none of the three is outside the Nifty 500. The lists are public CSVs with the header "Company Name,Industry,Symbol,Series,ISIN Code".
export const LISTS: Record<'large' | 'mid' | 'small', { file: string; min: number; max: number }> = {
  large: { file: 'ind_nifty100list.csv', min: 90, max: 110 },
  mid: { file: 'ind_niftymidcap150list.csv', min: 140, max: 160 },
  small: { file: 'ind_niftysmallcap250list.csv', min: 230, max: 270 },
};
/** Symbols from one NSE list; throws on an unexpected header or an implausible count so a changed file is never read as truth. */
export function parseIndexList(csv: string, which: keyof typeof LISTS): string[] {
  const lines = csv.replace(/^﻿/, '').trim().split(/\r?\n/);
  if (!/^Company Name,Industry,Symbol/.test(lines[0])) throw new Error(`${which}: unexpected header`);
  const out = [...new Set(lines.slice(1).map((l) => l.split(',')[2]?.trim()).filter((s): s is string => !!s))];
  const { min, max } = LISTS[which];
  if (out.length < min || out.length > max) throw new Error(`${which}: ${out.length} symbols, expected ${min} to ${max}`);
  return out;
}

/** Industry of each symbol in one NSE list (the second column); same header check as parseIndexList. */
export function parseIndexIndustries(csv: string): Record<string, string> {
  const lines = csv.replace(/^﻿/, '').trim().split(/\r?\n/);
  if (!/^Company Name,Industry,Symbol/.test(lines[0])) throw new Error('unexpected header');
  const out: Record<string, string> = {};
  for (const l of lines.slice(1)) { const c = l.split(','); const sym = c[2]?.trim(), ind = c[1]?.trim(); if (sym && ind) out[sym] = ind; }
  return out;
}
