// Business facts for a listed stock (scope K3), read from public pages: Groww's stock page (valuation, results, holding by quarter) and NSE's quarterly shareholding filing (promoter pledge). Facts only: nothing here changes a verdict or a score.
export interface Pledge { asOf: string | null; promoterPct: number | null; pledgedShares: number | null; pledgedOfPromoter: number | null; ndu: number | null; encumberedOfPromoter: number | null }
export interface Holding { q: string; promoters: number; fii: number; dii: number; pub: number }
export interface StockFacts { asOf: string; pe: number | null; pb: number | null; roe: number | null; de: number | null; mcap: string | null; revYoY: number | null; profitYoY: number | null; qRevYoY: number | null; qProfitYoY: number | null; years: Record<string, Record<string, number>>; pattern: Holding[]; extra: Record<string, string>; pledge?: Pledge | null }

const num = (x: unknown): number | null => { if (typeof x === 'number' && Number.isFinite(x)) return x; if (typeof x === 'string') { const n = parseFloat(x.replace(/[,%₹\s]|Cr$/g, '')); return Number.isFinite(n) ? n : null; } return null; };
const find = (o: any, key: string, d = 0): any => { if (!o || typeof o !== 'object' || d > 7) return undefined; if (key in o && o[key] !== null && o[key] !== undefined) return o[key]; for (const v of Object.values(o)) { const r = find(v, key, d + 1); if (r !== undefined) return r; } return undefined; };
const yoy = (a: number | undefined, b: number | undefined): number | null => (a !== undefined && b !== undefined && b > 0 ? Math.round(((a / b) - 1) * 1000) / 10 : null);

/** Reads the facts out of a Groww stock page; null when the page carries none. */
export function parseStockPage(html: string, today: string): StockFacts | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) return null;
  let pp: any; try { pp = JSON.parse(m[1]).props?.pageProps; } catch { return null; } if (!pp) return null;
  const fund: { name: string; value: string }[] = find(pp, 'fundamentals') ?? [], fv = (n: RegExp) => num(fund.find((x) => n.test(x.name))?.value);
  const pe = fv(/^P\/E/) ?? num(find(pp, 'peRatio')), pb = fv(/^P\/B/) ?? num(find(pp, 'pbRatio')), roe = fv(/^ROE/), de = fv(/^Debt to Equity/);   // the page's own key-figure list first: deeper keys of the same name can belong to other things
  const stmts: any[] = find(pp, 'financialStatement') ?? [];
  const years: StockFacts['years'] = {}, qs: Record<string, Record<string, number>> = {};
  for (const s of stmts) { if (!s?.title) continue; const y = s.yearly ?? {}; const keep = Object.keys(y).sort().slice(-5); years[s.title] = Object.fromEntries(keep.map((k) => [k, y[k]])); qs[s.title] = s.quarterly ?? {}; }
  const last2 = (o: Record<string, number> | undefined) => { const k = Object.keys(o ?? {}).sort(); return k.length >= 2 ? [o![k[k.length - 1]], o![k[k.length - 2]]] : [undefined, undefined]; };
  const prof = Object.keys(years).find((t) => /^(net )?profit|^pat\b/i.test(t)) ?? null, rev = Object.keys(years).find((t) => /^(total )?revenue|^sales/i.test(t)) ?? null;
  const qYoY = (t: string | null) => { if (!t) return null; const q = qs[t] ?? {}, ks = Object.keys(q); if (ks.length < 5) return null; const mon = (k: string) => { const [a, b] = k.split(" '"); return +b * 12 + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(a); }; const s = ks.sort((a, b) => mon(a) - mon(b)), l = s[s.length - 1], p = s.find((k) => mon(k) === mon(l) - 12); return p ? yoy(q[l], q[p]) : null; };
  const hp = find(pp, 'shareholdingPatternV2')?.data ?? {}; const mq = (k: string) => { const [a, b] = k.split(" '"); return +b * 12 + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(a); };
  const holding: Holding[] = Object.keys(hp).sort((a, b) => mq(a) - mq(b)).slice(-6).map((q) => ({ q, promoters: hp[q].promoters, fii: hp[q].fii, dii: hp[q].dii, pub: hp[q].public }));
  if (pe === null && roe === null && !stmts.length && !holding.length) return null;
  const [r1, r0] = last2(rev ? years[rev] : undefined), [p1, p0] = last2(prof ? years[prof] : undefined);
  const extra: Record<string, string> = {}; for (const x of fund) if (x?.name && x.value !== undefined) extra[x.name] = String(x.value);
  return { asOf: today, pe, pb, roe, de, mcap: fund.find((x) => /Market Cap/i.test(x.name))?.value ?? null, revYoY: yoy(r1, r0), profitYoY: p0 !== undefined && p0 > 0 ? yoy(p1, p0) : null, qRevYoY: qYoY(rev), qProfitYoY: qYoY(prof), years, pattern: holding, extra };
}

/** Promoter pledge out of NSE's shareholding XBRL file (context "promoter and promoter group"). */
export function parsePledge(xml: string, asOf: string | null): Pledge | null {
  const ctxOf = (tag: string, ctx: string): number | null => { const r = new RegExp(`<in-bse-shp:${tag}\\s+[^>]*contextRef="${ctx}"[^>]*>\\s*([-\\d.eE]+)\\s*<`).exec(xml); return r ? parseFloat(r[1]) : null; };
  const C = 'ShareholdingOfPromoterAndPromoterGroup_ContextI';
  const held = ctxOf('NumberOfFullyPaidUpEquityShares', C), pct = ctxOf('ShareholdingAsAPercentageOfTotalNumberOfShares', C);
  if (held === null && pct === null) return null;
  return { asOf, promoterPct: pct === null ? null : Math.round(pct * 10000) / 100, pledgedShares: ctxOf('NumberOfSharesEncumberedUnderPledged', C) ?? 0, pledgedOfPromoter: ctxOf('EncumberedShareUnderPledgedAsPercentageOfTotalNumberOfShares', C) ?? 0, ndu: ctxOf('NumberOfSharesEncumberedUnderNonDisposalUndertaking', C) ?? 0, encumberedOfPromoter: ctxOf('EncumberedSharesHeldAsPercentageOfTotalNumberOfShares', C) ?? 0 };
}
