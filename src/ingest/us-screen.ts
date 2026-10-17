// Weekly US stock screen (Repo Desk version of the Claude Desk's Saturday task). Pure functions, no I/O.
//   1. Sectors: a sector passes the gate if r3m > benchmark r3m AND r3m > 0 (C-58) AND close > sma50. Score = 2*r3m + r1m. Top 4 passing sectors.
//   2. Holdings: the top 10 holdings of each chosen sector ETF (equities only). A stock under two ETFs is kept once, under the first.
//   3. Per stock, from Tiingo bars (split-adjusted): close, sma50, sma200, ema20, atr14, high50, high1, low10, low3, r1m, avgVol, adv,
//      volRatio, chg52. From the StockAnalysis statistics page: the next earnings date (Tiingo does not carry it), and cross-checks.
import { sma, emaSeeded, atr, returnOver } from '../engine/indicators.ts';
import { adjustedThrough, type Bar } from './us-eod.ts';

export interface FeedSector { close?: number; sma50?: number; r1m?: number; r3m?: number }
export interface Feed { bench?: { r1m?: number; r3m?: number }; sectors: Record<string, FeedSector> }

/** Tickers of the top `max` sectors passing the gate, best first. Key format "<name> (<ETF>)". */
export function pickSectors(feed: Feed, max = 4): Array<{ etf: string; key: string; score: number }> {
  const b3 = feed.bench?.r3m;
  if (typeof b3 !== 'number') return [];
  const out: Array<{ etf: string; key: string; score: number }> = [];
  for (const [key, s] of Object.entries(feed.sectors)) {
    const m = /\(([A-Z]+)\)\s*$/.exec(key);
    if (!m || typeof s.close !== 'number' || typeof s.sma50 !== 'number' || typeof s.r3m !== 'number' || typeof s.r1m !== 'number') continue;
    if (s.r3m > b3 && s.r3m > 0 && s.close > s.sma50) out.push({ etf: m[1], key, score: Math.round((2 * s.r3m + s.r1m) * 100) / 100 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

export interface Holding { rank: number; symbol: string; name: string; weight: number }

/** StockAnalysis ETF holdings table (No., Symbol, Name, % Weight, Shares) -> top `n` rows that are equities. */
export function parseHoldings(html: string, n = 10): Holding[] {
  const out: Holding[] = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((x) => x[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim());
    const rank = Number(c[0]);
    if (!Number.isInteger(rank) || rank < 1 || rank > n || c.length < 4) continue;
    const weight = Number((c[3] || '').replace('%', ''));
    if (!/^[A-Z]{1,5}([.-][A-Z])?$/.test(c[1] || '') || /cash|treasury|futures|repo|money market/i.test(c[2] || '') || !Number.isFinite(weight)) continue;
    out.push({ rank, symbol: c[1], name: c[2], weight });
  }
  return out;
}

const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
export interface Stats { chg52?: number; ma50?: number; ma200?: number; avgVol?: number; earnings: string | null }

/** StockAnalysis statistics page text -> the few fields the screen cross-checks or cannot get from Tiingo. */
export function parseStats(html: string): Stats {
  const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '|').replace(/\|[\s|]*\|/g, '|').replace(/\s+/g, ' ');
  const after = (label: string): string | null => { const i = t.indexOf(label + '|'); if (i < 0) return null; return t.slice(i + label.length + 1).split('|')[0].trim(); };
  const num = (s: string | null): number | undefined => { if (s === null) return undefined; const v = Number(s.replace(/[,%+]/g, '')); return Number.isFinite(v) ? v : undefined; };
  const e = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(after('Earnings Date') || '');
  return {
    chg52: num(after('52-Week Price Change')), ma50: num(after('50-Day Moving Average')), ma200: num(after('200-Day Moving Average')),
    avgVol: num(after('Average Volume (20 Days)')), earnings: e && MON[e[1]] ? `${e[3]}-${MON[e[1]]}-${e[2].padStart(2, '0')}` : null,
  };
}

export interface ScreenStock {
  sym: string; sector: string; weight: number; date: string; close: number; sma50?: number; sma200?: number; ema20?: number; atr14?: number;
  high50: number; high1: number; low10: number; low3: number; r1m?: number; avgVol: number; adv: number; volRatio: number; chg52?: number;
  earnings: string | null; flags: string[];
}
const r2 = (x: number): number => Math.round(x * 100) / 100;
const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / a.length;

/** Metrics as of the last stored bar. Null when fewer than 40 bars exist (the Claude Desk skipped those too). */
export function stockMetrics(bars: Bar[], sym: string, sector: string, weight: number, stats: Stats): ScreenStock | null {
  if (bars.length < 40) return null;
  const date = bars[bars.length - 1][0];
  const s = adjustedThrough(bars, date);
  const n = s.close.length, flags: string[] = [];
  const close = s.close[n - 1];
  const byDate: Record<string, number> = {}; s.dates.forEach((d, i) => { byDate[d] = s.close[i]; });
  const sma50 = sma(s.close, 50), sma200 = sma(s.close, 200), ema20 = emaSeeded(s.close, 20), a14 = atr(s.high, s.low, s.close, 14);
  const r1 = returnOver(byDate, date, 1), c52 = returnOver(byDate, date, 12);
  const avgVol = mean(s.volume.slice(-20));
  const prior = s.volume.slice(-21, -1);
  if (!Number.isNaN(sma50) && stats.ma50 !== undefined && Math.abs(sma50 / stats.ma50 - 1) > 0.01) flags.push('sma50 mismatch');
  if (!Number.isNaN(c52) && stats.chg52 !== undefined && Math.abs(c52 - stats.chg52) > 2) flags.push('52-week change differs from StockAnalysis');
  if (stats.earnings === null) flags.push('next earnings date missing');
  const out: ScreenStock = {
    sym, sector, weight, date, close: r2(close),
    ...(Number.isNaN(sma50) ? {} : { sma50: r2(sma50) }), ...(Number.isNaN(sma200) ? {} : { sma200: r2(sma200) }),
    ...(Number.isNaN(ema20) ? {} : { ema20: r2(ema20) }), ...(Number.isNaN(a14) ? {} : { atr14: r2(a14) }),
    high50: r2(Math.max(...s.high.slice(-50))), high1: r2(s.high[n - 1]), low10: r2(Math.min(...s.low.slice(-10))), low3: r2(Math.min(...s.low.slice(-3))),
    ...(Number.isNaN(r1) ? {} : { r1m: r1 }), avgVol: Math.round(avgVol), adv: Math.round(avgVol * close),
    volRatio: prior.length === 20 ? r2(s.volume[n - 1] / mean(prior)) : NaN,
    ...(Number.isNaN(c52) ? {} : { chg52: c52 }), earnings: stats.earnings, flags,
  };
  return out;
}

/** The date most stocks end on (the screen's date). */
export function commonDate(stocks: Array<{ date: string }>): string | null {
  const c = new Map<string, number>(); for (const s of stocks) c.set(s.date, (c.get(s.date) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null;
}
