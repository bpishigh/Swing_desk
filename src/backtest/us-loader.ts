// Backtester: the US data every US replay needs, loaded once (C-119). The Nasdaq-sourced store data/us/hist (about 10 years, split-adjusted prices AND volumes by Nasdaq, so
// dollar volume is unchanged by later splits) plus SPY from data/us/hist-bench. SURVIVOR-BIASED UPWARD: only stocks that are liquid and still trading today are in the store (C-55, C-116).
// Past price LEVELS are adjusted for later splits, so the $10 price floor is applied to adjusted prices (a later splitter looks cheaper in the past): disclosed in C-119.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { buildHistories } from '../ingest/us-scan.ts';

export interface UsData {
  dates: string[]; N: number; days: Array<{ date: string; rows: Array<[string, number, number, number, number]> }>;
  spy: Float64Array; types: Map<string, string>; allowed: Set<string>; sic: Map<string, number>;
  hist: ReturnType<typeof buildHistories>;
  first: (d: string) => number;
  snapshot: { sessions: number; first: string; last: string; symbols: number; splits: number; hash: string };
}
const readGz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());

export function loadUs(root = 'data/us', opts: { to?: string } = {}): UsData {
  const tkFile = readdirSync(root).filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop() as string;
  const tk = JSON.parse(readFileSync(`${root}/${tkFile}`, 'utf8'));
  const types = new Map<string, string>(); for (const [sym, type] of tk.rows) if (type === 'CS' || type === 'ADRC') types.set(sym, type);
  const spyBars: any[] = readGz(`${root}/hist-bench/SPY.json.gz`).bars;
  const dates = spyBars.map((b) => b[0]).filter((d: string) => !opts.to || d <= opts.to), N = dates.length, idx = new Map(dates.map((d, i) => [d, i]));
  const rowsByDay: Array<Array<[string, number, number, number, number]>> = dates.map(() => []);
  const allowed = new Set<string>(); let nfiles = 0;
  for (const f of readdirSync(`${root}/hist`).filter((x) => x.endsWith('.json.gz'))) {
    const o = readGz(`${root}/hist/${f}`); if (!types.has(o.sym) && !types.has(o.sym.replace('_', '.'))) continue;
    nfiles++;
    for (const [d, c, h, l, v] of o.bars) { const i = idx.get(d); if (i === undefined) continue; if (c > 0 && h > 0 && l > 0) { rowsByDay[i].push([o.sym, c, h, l, v]); allowed.add(o.sym); } }
  }
  const days = dates.map((date, i) => ({ date, rows: rowsByDay[i] }));
  const spy = new Float64Array(N).fill(NaN); spyBars.forEach((b) => { const i = idx.get(b[0]); if (i !== undefined) spy[i] = b[1]; });
  const sic = new Map<string, number>(); if (existsSync(`${root}/sic.json`)) for (const [sym, code] of JSON.parse(readFileSync(`${root}/sic.json`, 'utf8')).rows) if (code) sic.set(sym, +code);
  const hist = buildHistories(days, [], allowed);
  const first = (d: string) => { let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] < d) lo = m + 1; else hi = m; } return lo; };
  const h = createHash('sha1'); h.update(dates.join(',')); h.update(String(nfiles)); h.update([...allowed].sort().join(',')); h.update(String(days.reduce((a, d) => a + d.rows.length, 0)));
  return { dates, N, days, spy, types, allowed, sic, hist, first, snapshot: { sessions: N, first: dates[0], last: dates[N - 1], symbols: allowed.size, splits: 0, hash: h.digest('hex').slice(0, 12) } };
}
export const truncatedHist = (hist: ReturnType<typeof buildHistories>, t: number) => ({ dates: hist.dates.slice(0, t + 1), series: new Map([...hist.series].map(([k, s]) => [k, { c: s.c.subarray(0, t + 1), h: s.h.subarray(0, t + 1), l: s.l.subarray(0, t + 1), v: s.v.subarray(0, t + 1) }])) });
/** US round-trip cost by 20-day dollar volume (C-52 analyst figures). */
export const usCost = (dv: number): number => (dv >= 100e6 ? 0.002 : dv >= 25e6 ? 0.0035 : 0.006);
