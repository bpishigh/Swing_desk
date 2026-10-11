// Backup for corporate-action breaks the NSE list cannot explain: read a site's published (already adjusted) 200-day average,
// solve for the missing price factor, and cross-check it against the site's published EMAs. Pure functions, no I/O.
import { emaSeeded } from '../engine/indicators.ts';

const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const f = (s: string): number => Number(s.replace(/[,\s]/g, ''));

export interface DhanPage { symbol: string | null; close: number | null; asOf: string | null; asOfTime: string | null; dma50: number | null; dma200: number | null }
/** Read the text of a Dhan share-price page (tags already stripped). */
export function parseDhanShare(text: string): DhanPage {
  const sym = /Symbol : ([A-Z0-9&-]+)/.exec(text);
  const dma = /The 50 DMA stands at ([\d,]+(?:\.\d+)?) and 200 DMA is at ([\d,]+(?:\.\d+)?)/.exec(text);
  const close = /share price as of today is ₹ ?([\d,.\s]+?) as on/.exec(text);
  const asOf = /as on (\d{1,2}) ([A-Za-z]{3}) (\d{4}) at (\d{1,2}:\d{2}) ?(AM|PM)?/.exec(text);
  let time: string | null = null;
  if (asOf) { let [h, m] = asOf[4].split(':').map(Number); if (asOf[5] === 'PM' && h < 12) h += 12; if (asOf[5] === 'AM' && h === 12) h = 0; time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  return {
    symbol: sym ? sym[1] : null, close: close ? f(close[1]) : null,
    asOf: asOf && MON[asOf[2]] ? `${asOf[3]}-${MON[asOf[2]]}-${asOf[1].padStart(2, '0')}` : null, asOfTime: time,
    dma50: dma ? f(dma[1]) : null, dma200: dma ? f(dma[2]) : null,
  };
}
/** Published EMAs from the technical-analysis page: {5: 238.43, 10: 239.75, ...}. */
export function parseDhanEmas(text: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of text.matchAll(/\b(\d+)-EMA ([\d,]+(?:\.\d+)?)/g)) if (!(Number(m[1]) in out)) out[Number(m[1])] = f(m[2]);
  return out;
}

/** The address Dhan uses is the company name with '&' dropped, 'Limited' -> 'ltd' and punctuation as hyphens. */
export function dhanSlugs(companyName: string): string[] {
  const base = companyName.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const short = base.replace(/\blimited\b/g, 'ltd').trim().replace(/\s+/g, '-');
  const full = base.replace(/\s+/g, '-');
  return [...new Set([short, full])];
}

export interface Solve { factor: number; pre: number; post: number }
/**
 * `closes` = raw closes in date order through D (D last). `breakIdx` = index of the first close after the break. The published 200 DMA runs
 * through the session before D, so it covers closes[n-201 .. n-2]. Closes before the break are scaled by `factor`:
 *   200 * P = factor * Spre + Spost   ->   factor = (200 * P - Spost) / Spre.
 * Returns null when the break is not inside that window or the window is too short.
 */
export function solveFactor(closes: number[], breakIdx: number, published200: number, k = 200): Solve | null {
  const n = closes.length, start = n - 1 - k, end = n - 2;
  if (start < 0 || breakIdx <= start || breakIdx > end) return null;
  let pre = 0, post = 0;
  for (let i = start; i <= end; i++) { if (i < breakIdx) pre += closes[i]; else post += closes[i]; }
  const factor = (k * published200 - post) / pre;
  return Number.isFinite(factor) && factor > 0 ? { factor, pre, post } : null;
}

export interface Check { ok: boolean; worstPct: number; detail: Record<number, { ours: number; published: number; diffPct: number }> }
/** Compare our EMAs (closes before the break scaled by `factor`, EMA through D) with the published ones. */
export function checkEmas(closes: number[], breakIdx: number, factor: number, published: Record<number, number>, tolPct = 2): Check {
  const adj = closes.map((c, i) => (i < breakIdx ? c * factor : c));
  const detail: Check['detail'] = {}; let worst = 0, any = false;
  for (const n of [10, 20, 50, 100, 200]) {
    const pub = published[n]; if (pub === undefined || adj.length < n * 2) continue;
    const ours = emaSeeded(adj, n); const diff = (ours / pub - 1) * 100;
    detail[n] = { ours: Math.round(ours * 100) / 100, published: pub, diffPct: Math.round(diff * 100) / 100 };
    worst = Math.max(worst, Math.abs(diff)); any = true;
  }
  return { ok: any && worst <= tolPct, worstPct: Math.round(worst * 100) / 100, detail };
}
