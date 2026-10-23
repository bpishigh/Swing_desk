// Risk-aware fund score for debt, liquid and international funds (Engine Rules C-82). Pure. Percentile rank inside a peer group on five components; weights fixed in C-82.
import { navOn, addDays, cagr, type Nav } from './fundscore.ts';

export const RISK = { weights: { ret: 30, cons: 20, ra: 20, dd: 15, cost: 15 }, strongAbove: 75, weakBelow: 25, minPeersDebt: 5, minPeersIntl: 3, rollingMonths: 36, debtDayFlag: -1 };
export interface RScheme { code: string; isin: string; name: string; category: string }
export interface RScored extends RScheme { cat: string; r1: number | null; r3: number | null; consistency: number | null; vol: number | null; ra: number | null; dd: number | null; wd: number | null; ter?: number | null; score: number | null; rank: number | null; peers: number; band: 'Strong' | 'Average' | 'Weak' | null; note?: string; flag?: string }

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pctRank = (v: number, all: number[]) => (all.filter((x) => x < v).length + 0.5 * all.filter((x) => x === v).length) / all.length * 100;
const minusYears = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() - n); return x.toISOString().slice(0, 10); };

/** Volatility (annualised, %), worst peak-to-trough fall (%) and worst single day (%) of the NAV over the 3 years to asOf; null when the fund has less than 3 years. */
export function riskStats(nav: Nav, asOf: string): { vol: number; dd: number; wd: number } | null {
  const all = Object.keys(nav).sort(); const start = minusYears(asOf, 3);
  if (!all.length || all[0] > addDays(start, 7)) return null;
  const d = all.filter((x) => x >= start && x <= asOf); if (d.length < 400) return null;
  let peak = nav[d[0]], dd = 0, wd = 0; const r: number[] = [];
  for (let i = 1; i < d.length; i++) { const a = nav[d[i - 1]], b = nav[d[i]]; if (!(a > 0 && b > 0)) continue; const x = b / a - 1; r.push(Math.log(b / a)); if (x < wd) wd = x; if (b > peak) peak = b; const f = b / peak - 1; if (f < dd) dd = f; }
  const mean = r.reduce((s, x) => s + x, 0) / r.length, sd = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / (r.length - 1));
  return { vol: sd * Math.sqrt(252) * 100, dd: dd * 100, wd: wd * 100 };
}

/** Score the schemes of each group against each other. `groupOf` returns the peer group (null = skip); `ter` maps scheme code to the direct expense ratio. */
export function scoreRisk(schemes: RScheme[], series: Map<string, Nav>, asOf: string, groupOf: (s: RScheme) => string | null, ter: Map<string, number> = new Map(), minPeers: (group: string) => number = () => RISK.minPeersDebt, flagDay: (group: string) => boolean = () => false): RScored[] {
  const info = new Map<string, { dates: string[]; nav: Nav }>();
  for (const x of schemes) { const nav = series.get(x.code); if (nav) info.set(x.code, { dates: Object.keys(nav).sort(), nav }); }
  const groups = new Map<string, RScheme[]>();
  for (const x of schemes) { if (!info.has(x.code)) continue; const g = groupOf(x); if (g) (groups.get(g) ?? groups.set(g, []).get(g)!).push(x); }
  const out: RScored[] = [];
  for (const [cat, list] of groups) {
    const m = list.map((x) => { const i = info.get(x.code)!; return { x, r1: cagr(i.dates, i.nav, asOf, 1), r3: cagr(i.dates, i.nav, asOf, 3), st: riskStats(i.nav, asOf) }; });
    const ends: string[] = []; for (let k = 0; k < RISK.rollingMonths; k++) ends.push(addDays(asOf, -30 * k));
    const win = (code: string, end: string) => { const i = info.get(code)!, e = navOn(i.dates, i.nav, end), b = navOn(i.dates, i.nav, minusYears(end, 1)); return e !== null && b !== null && b > 0 && i.dates[0] <= addDays(minusYears(end, 1), 7) ? e / b - 1 : null; };
    const cons = new Map<string, { won: number; n: number }>();
    for (const end of ends) {
      const rets = list.map((x) => [x.code, win(x.code, end)] as const).filter((r): r is readonly [string, number] => r[1] !== null);
      if (rets.length < minPeers(cat)) continue;
      const med = median(rets.map((r) => r[1]));
      for (const [code, r] of rets) { const c = cons.get(code) ?? { won: 0, n: 0 }; c.n++; if (r >= med) c.won++; cons.set(code, c); }
    }
    const ranked = m.filter((r) => r.r3 !== null && r.st);
    const enough = ranked.length >= minPeers(cat);
    const consVals = [...cons.values()].filter((c) => c.n >= 12).map((c) => c.won / c.n);
    const col = (f: (r: typeof ranked[number]) => number | null) => ranked.map(f).filter((v): v is number => v !== null);
    const raOf = (r: typeof ranked[number]) => (r.r3 !== null && r.st && r.st.vol > 0 ? r.r3 / r.st.vol : null);
    const scored: RScored[] = m.map((r) => {
      const c = cons.get(r.x.code), cv = c && c.n >= 12 ? c.won / c.n : null, tr = ter.get(r.x.code) ?? null;
      const base: RScored = { ...r.x, cat, r1: r.r1, r3: r.r3, consistency: cv === null ? null : cv * 100, vol: r.st?.vol ?? null, ra: raOf(r as any), dd: r.st?.dd ?? null, wd: r.st?.wd ?? null, ter: tr, score: null, rank: null, peers: ranked.length, band: null };
      if (r.st && flagDay(cat) && r.st.wd < RISK.debtDayFlag) base.flag = `worst single day ${r.st.wd.toFixed(1)}% (a credit or duration event shows up like this)`;
      if (r.r3 === null || !r.st) return { ...base, note: 'Less than 3 years of NAV history: not scored.' };
      if (!enough) return { ...base, note: `Only ${ranked.length} funds in this group have a 3-year record (need ${minPeers(cat)}): not ranked.` };
      const parts: [number, number][] = [[RISK.weights.ret, pctRank(r.r3, col((q) => q.r3))], [RISK.weights.ra, pctRank(base.ra!, col(raOf))], [RISK.weights.dd, pctRank(r.st.dd, col((q) => q.st!.dd))]];
      if (cv !== null && consVals.length >= minPeers(cat)) parts.push([RISK.weights.cons, pctRank(cv, consVals)]);
      const terVals = ranked.map((q) => ter.get(q.x.code)).filter((v): v is number => v !== undefined && v !== null);
      if (tr !== null && terVals.length >= minPeers(cat)) parts.push([RISK.weights.cost, 100 - pctRank(tr, terVals)]);
      const w = parts.reduce((a, p) => a + p[0], 0), score = parts.reduce((a, p) => a + p[0] * p[1], 0) / w;
      return { ...base, score: Math.round(score * 10) / 10 };
    });
    const ord = scored.filter((r) => r.score !== null).sort((a, b) => (b.score! - a.score!) || a.name.localeCompare(b.name));
    ord.forEach((r, i) => { r.rank = i + 1; r.band = r.score! >= RISK.strongAbove ? 'Strong' : r.score! < RISK.weakBelow ? 'Weak' : 'Average'; });
    out.push(...scored);
  }
  return out;
}

const DEBT_MAP: [RegExp, string][] = [[/overnight/i, 'Overnight'], [/liquid/i, 'Liquid'], [/money market/i, 'Money market'], [/ultra short/i, 'Ultra short'], [/low duration/i, 'Low duration'], [/short (term|duration)/i, 'Short duration'], [/medium to long/i, 'Medium to long'], [/medium/i, 'Medium duration'], [/long (term|duration)/i, 'Long duration'], [/dynamic/i, 'Dynamic bond'], [/corporate bond/i, 'Corporate bond'], [/banking and psu/i, 'Banking and PSU'], [/credit risk/i, 'Credit risk'], [/gilt/i, 'Gilt'], [/floating|floater/i, 'Floater']];
/** Peer group of a debt scheme from its AMFI category, or null when it is not a plain debt category (index, ETF, fixed term, sectoral). */
export function debtGroup(category: string): string | null {
  if (!/debt|income/i.test(category) || /index|etf|fixed term|sectoral|other debt|fund of funds|fof/i.test(category)) return null;
  for (const [re, g] of DEBT_MAP) if (re.test(category)) return g;
  return /^income$/i.test(category.trim()) ? 'Income' : null;
}
/** What an international fund-of-funds holds, read from its name and category; null when it is not an overseas fund of funds. */
export function intlGroup(name: string, category: string): string | null {
  if (!/overseas|offshore|fof overseas|international/i.test(category + ' ' + name)) return null;
  const t = name.toLowerCase();
  if (/nasdaq|fang|nyse/.test(t)) return 'Nasdaq 100 and US tech giants';
  if (/s&p 500|s&p500/.test(t)) return 'S&P 500';
  if (/emerging|asean|brazil|latin/.test(t)) return 'Emerging markets';
  if (/europe|euro/.test(t)) return 'Europe';
  if (/china|hang seng|hong kong/.test(t)) return 'China and Hong Kong';
  if (/\bus\b|u\.s\.|america/.test(t)) return 'Other US';
  return 'Global and other';
}
