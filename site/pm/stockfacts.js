// Business facts for a listed stock (scope K3), read from public pages: Groww's stock page (valuation, results, holding by quarter) and NSE's quarterly shareholding filing (promoter pledge). Facts only: nothing here changes a verdict or a score.
                                                                                                                                                                                                    
                                                                                                
                                                                                                                                                                                                                                                                                                                                                         

const num = (x         )                => { if (typeof x === 'number' && Number.isFinite(x)) return x; if (typeof x === 'string') { const n = parseFloat(x.replace(/[,%₹\s]|Cr$/g, '')); return Number.isFinite(n) ? n : null; } return null; };
const find = (o     , key        , d = 0)      => { if (!o || typeof o !== 'object' || d > 7) return undefined; if (key in o && o[key] !== null && o[key] !== undefined) return o[key]; for (const v of Object.values(o)) { const r = find(v, key, d + 1); if (r !== undefined) return r; } return undefined; };
const yoy = (a                    , b                    )                => (a !== undefined && b !== undefined && b > 0 ? Math.round(((a / b) - 1) * 1000) / 10 : null);

/** Reads the facts out of a Groww stock page; null when the page carries none. */
export function parseStockPage(html        , today        )                    {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) return null;
  let pp     ; try { pp = JSON.parse(m[1]).props?.pageProps; } catch { return null; } if (!pp) return null;
  const fund                                    = find(pp, 'fundamentals') ?? [], fv = (n        ) => num(fund.find((x) => n.test(x.name))?.value);
  const pe = num(find(pp, 'peRatio')) ?? fv(/^P\/E/), pb = num(find(pp, 'pbRatio')) ?? fv(/^P\/B/), roe = fv(/^ROE/);
  const stmts        = find(pp, 'financialStatement') ?? [];
  const years                      = {}, qs                                         = {};
  for (const s of stmts) { if (!s?.title) continue; const y = s.yearly ?? {}; const keep = Object.keys(y).sort().slice(-5); years[s.title] = Object.fromEntries(keep.map((k) => [k, y[k]])); qs[s.title] = s.quarterly ?? {}; }
  const last2 = (o                                    ) => { const k = Object.keys(o ?? {}).sort(); return k.length >= 2 ? [o [k[k.length - 1]], o [k[k.length - 2]]] : [undefined, undefined]; };
  const prof = Object.keys(years).find((t) => /^(net )?profit|^pat\b/i.test(t)) ?? null, rev = Object.keys(years).find((t) => /^(total )?revenue|^sales/i.test(t)) ?? null;
  const qYoY = (t               ) => { if (!t) return null; const q = qs[t] ?? {}, ks = Object.keys(q); if (ks.length < 5) return null; const mon = (k        ) => { const [a, b] = k.split(" '"); return +b * 12 + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(a); }; const s = ks.sort((a, b) => mon(a) - mon(b)), l = s[s.length - 1], p = s.find((k) => mon(k) === mon(l) - 12); return p ? yoy(q[l], q[p]) : null; };
  const hp = find(pp, 'shareholdingPatternV2')?.data ?? {}; const mq = (k        ) => { const [a, b] = k.split(" '"); return +b * 12 + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(a); };
  const holding            = Object.keys(hp).sort((a, b) => mq(a) - mq(b)).slice(-6).map((q) => ({ q, promoters: hp[q].promoters, fii: hp[q].fii, dii: hp[q].dii, pub: hp[q].public }));
  if (pe === null && roe === null && !stmts.length && !holding.length) return null;
  const [r1, r0] = last2(rev ? years[rev] : undefined), [p1, p0] = last2(prof ? years[prof] : undefined);
  const extra                         = {}; for (const x of fund) if (x?.name && x.value !== undefined) extra[x.name] = String(x.value);
  return { asOf: today, pe, pb, roe, mcap: fund.find((x) => /Market Cap/i.test(x.name))?.value ?? null, revYoY: yoy(r1, r0), profitYoY: p0 !== undefined && p0 > 0 ? yoy(p1, p0) : null, qRevYoY: qYoY(rev), qProfitYoY: qYoY(prof), years, holding, extra };
}

/** Promoter pledge out of NSE's shareholding XBRL file (context "promoter and promoter group"). */
export function parsePledge(xml        , asOf               )                {
  const ctxOf = (tag        , ctx        )                => { const r = new RegExp(`<in-bse-shp:${tag}\\s+[^>]*contextRef="${ctx}"[^>]*>\\s*([-\\d.eE]+)\\s*<`).exec(xml); return r ? parseFloat(r[1]) : null; };
  const C = 'ShareholdingOfPromoterAndPromoterGroup_ContextI';
  const held = ctxOf('NumberOfFullyPaidUpEquityShares', C), pct = ctxOf('ShareholdingAsAPercentageOfTotalNumberOfShares', C);
  if (held === null && pct === null) return null;
  return { asOf, promoterPct: pct === null ? null : Math.round(pct * 10000) / 100, pledgedShares: ctxOf('NumberOfSharesEncumberedUnderPledged', C) ?? 0, pledgedOfPromoter: ctxOf('EncumberedShareUnderPledgedAsPercentageOfTotalNumberOfShares', C) ?? 0, ndu: ctxOf('NumberOfSharesEncumberedUnderNonDisposalUndertaking', C) ?? 0, encumberedOfPromoter: ctxOf('EncumberedSharesHeldAsPercentageOfTotalNumberOfShares', C) ?? 0 };
}
