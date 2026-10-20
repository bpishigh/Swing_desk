// Backtester: the India data every replay needs, loaded once, one way. C-69. Replaces the ~20 lines each replay script copied.
// What it returns is exactly what those scripts built inline: stored sessions (history 2020 to 16 Oct 2025, then the daily files), corporate-action
// factors resolved once over the whole history, fully adjusted series for REALISED returns (the as-of view for rule decisions is asOfHistories()),
// today's industry map (disclosed look-ahead on group membership), the results dates, an equal-weight market series and small helpers.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { buildHistories } from '../ingest/us-scan.ts';
import { resolveHistory, toDays } from './india-asof.ts';

export interface IndiaData {
  dates: string[]; T: number; days: ReturnType<typeof toDays>; sel: any[];
  res: ReturnType<typeof resolveHistory>;
  industry: Record<string, string>; allowed: Set<string>; types: Map<string, string>;
  FH: ReturnType<typeof buildHistories>;                     // fully adjusted: for realised returns only
  RD: { dates: Record<string, string[]>; fetchedAt?: string };
  syms: string[];
  first: (d: string) => number;                              // first index with date >= d
  cc: (s: string, i: number) => number; ret: (s: string, a: number, b: number) => number;
  mkt: (a: number, b: number) => number;                     // equal-weight market return a -> b (each name clipped to +-50%)
  mk: Float64Array;                                          // equal-weight market index built from daily mkt()
  sma: (a: ArrayLike<number>, i: number, n: number) => number;
  dv20: (s: string, t: number) => number;                    // 20-session average traded value (price x volume)
  snapshot: { sessions: number; first: string; last: string; symbols: number; splits: number; hash: string };
}

const R = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const jsonIf = (p: string, d: unknown) => (existsSync(p) ? R(p) : d);

export function loadIndia(root = 'data/india'): IndiaData {
  const bhav: any[] = [];
  for (const f of readdirSync(`${root}/bhav-hist`).filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync(`${root}/bhav-hist/${f}`)).toString()));
  for (const f of readdirSync(`${root}/bhav`).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(R(`${root}/bhav/${f}`));
  bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
  const sel = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date);
  const actions = [...R(`${root}/corp-actions-history.json`), ...(jsonIf(`${root}/corp-actions.json`, []) as any[])];
  const ov = { ...(jsonIf(`${root}/corp-action-overrides-hist.json`, {}) as object), ...(jsonIf(`${root}/corp-action-overrides.json`, {}) as object) };
  const res = resolveHistory(sel, actions, ov as any);
  const industry: Record<string, string> = R(`${root}/segments.json`).industry ?? {}, allowed = new Set(Object.keys(industry)), types = new Map([...allowed].map((s) => [s, 'CS']));
  const days = toDays(sel), dates = days.map((d) => d.date), T = days.length;
  const FH = buildHistories(days, res.splits, allowed);
  const RD = R(`${root}/results-dates.json`), syms = [...allowed].filter((s) => FH.series.has(s));
  const first = (d: string) => { let lo = 0, hi = T; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] < d) lo = m + 1; else hi = m; } return lo; };
  const cc = (s: string, i: number) => { const v = (FH.series.get(s) as any)?.c[i]; return v > 0 ? v : NaN; };
  const ret = (s: string, a: number, b: number) => cc(s, b) / cc(s, a) - 1;
  const mc = new Map<string, number>();
  const mkt = (a: number, b: number) => { const k = a + ':' + b; if (mc.has(k)) return mc.get(k) as number; let s = 0, n = 0; for (const x of syms) { let r = ret(x, a, b); if (r === r) { r = Math.max(-0.5, Math.min(0.5, r)); s += r; n++; } } const v = n > 30 ? s / n : NaN; mc.set(k, v); return v; };
  const mk = new Float64Array(T).fill(NaN); mk[0] = 100; for (let i = 1; i < T; i++) { const m = mkt(i - 1, i); mk[i] = mk[i - 1] * (1 + (m === m ? m : 0)); }
  const sma = (a: ArrayLike<number>, i: number, n: number) => { let s = 0, k = 0; for (let j = i - n + 1; j <= i; j++) if (a[j] > 0) { s += a[j]; k++; } return k >= 0.8 * n ? s / k : NaN; };
  const dv20 = (s: string, t: number) => { const x: any = FH.series.get(s); let a = 0, n = 0; for (let i = t - 19; i <= t; i++) if (x.c[i] > 0 && x.v[i] === x.v[i]) { a += x.c[i] * x.v[i]; n++; } return n ? a / n : 0; };
  // a fingerprint of what the run saw: the session list, the corporate-action inputs and the results dates (not the full price files)
  const h = createHash('sha1'); h.update(dates.join(',')); h.update(JSON.stringify(actions)); h.update(JSON.stringify(ov)); h.update(JSON.stringify(RD.dates)); h.update(String(res.splits.length));
  const snapshot = { sessions: T, first: dates[0], last: dates[T - 1], symbols: syms.length, splits: res.splits.length, hash: h.digest('hex').slice(0, 12) };
  return { dates, T, days, sel, res, industry, allowed, types, FH, RD, syms, first, cc, ret, mkt, mk, sma, dv20, snapshot };
}
