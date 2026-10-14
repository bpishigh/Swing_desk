// The state a held stock's verdict is in, as the replay measured it (scripts/replay-verdicts.mjs): the same names key the track record in site/pm-data/track-record.json.
// ATR here is the close-to-close proxy (mean absolute move over 14 sessions), because high and low prices exist only from Oct 2025.
export const ATR_LEN = 14;
export const MID_BAND_PCT = 0.03;   // replay band definition (C-42): near = within 1 ATR of the 200 SMA, mid = beyond that but within 3%, far = beyond both
export type ExitState = 'Both' | '200 only: near (within 1 ATR)' | '200 only: mid (1 ATR to 3%)' | '200 only: far (beyond both)' | 'Swing only' | 'Swing only (no 200-day yet)' | 'Keep';

export function atr14(closes: (number | null)[], end = closes.length - 1): number | null {
  let s = 0, n = 0;
  for (let m = end - ATR_LEN + 1; m <= end; m++) { const a = closes[m], b = closes[m - 1]; if (m >= 1 && a !== null && a !== undefined && b !== null && b !== undefined) { s += Math.abs(a - b); n++; } }
  return n ? s / n : null;
}
export function bandOf(close: number, sma200: number, atr: number | null): ExitState {
  if (atr !== null && sma200 - close <= atr) return '200 only: near (within 1 ATR)';
  return close / sma200 - 1 >= -MID_BAND_PCT ? '200 only: mid (1 ATR to 3%)' : '200 only: far (beyond both)';
}
export function stateOf(v: { label: string; below200: boolean | null; belowSwing: boolean | null; close: number | null; sma200: number | null; partial?: string }, closes: (number | null)[]): ExitState | null {
  if (v.label === 'Keep') return 'Keep';
  if (v.label !== 'Exit' || v.close === null) return null;
  if (v.below200 && v.belowSwing) return 'Both';
  if (v.below200 && v.sma200 !== null) return bandOf(v.close, v.sma200, atr14(closes));
  return v.partial ? 'Swing only (no 200-day yet)' : 'Swing only';
}
