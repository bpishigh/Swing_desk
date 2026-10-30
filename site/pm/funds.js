// Mutual fund identity: map an order's scheme (ISIN when present, else name) to the AMFI scheme code, category and ISIN.
// Name matching is deterministic: plan (direct/regular) and option (growth/IDCW) must agree, then token overlap decides; a weak or tied match is flagged, never forced.
                                                                                                                                                                   
                                                                                                                                                              
                                                                        

const STOP = new Set(['fund', 'plan', 'option', 'scheme', 'the', 'of', 'and', 'a', 'growth', 'direct', 'regular', 'idcw', 'dividend', 'payout', 'reinvestment', 'bonus', 'cum', 'capital', 'withdrawal', 'income', 'distribution']);
const norm = (s        ) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\bfof\b/g, 'fund of funds').replace(/\b(mid|small|large|flexi|multi) cap\b/g, '$1cap').trim();
const flags = (s        ) => { const n = norm(s); return { plan: /\bdirect\b/.test(n) ? 'direct' : /\bregular\b/.test(n) ? 'regular' : 'unknown', option: /\b(idcw|dividend|payout|reinvestment)\b/.test(n) ? 'idcw' : /\bgrowth\b/.test(n) ? 'growth' : /\bbonus\b/.test(n) ? 'bonus' : 'unknown' }; };
const tokens = (s        ) => new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t)));
const jacc = (a             , b             ) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };

export class FundMaster {
          byIsin = new Map                 ();         rows                                                                    = [];
          overrides = new Map                                                          ();
  constructor(rows           , overrides                                                                   = []) {
    for (const o of overrides) this.overrides.set(norm(o.name), o);
    for (const r of rows) { for (const i of [r[1], r[2]]) if (i && i !== '-') this.byIsin.set(i, r); this.rows.push({ row: r, tok: tokens(r[3]), f: flags(r[3]) }); }
  }
  resolve(name        , isin         )             {
    if (isin && this.byIsin.has(isin)) { const r = this.byIsin.get(isin) ; return { match: { code: r[0], isin, name: r[3], category: r[4], nav: Number(r[7]) || undefined, navDate: r[8], how: 'isin', score: 1 } }; }
    const ov = this.overrides.get(norm(name));
    if (ov) { const r = this.rows.find((x) => x.row[0] === ov.code)?.row; return { match: { code: ov.code, isin: ov.isin, name: r?.[3] ?? name, category: r?.[4] ?? '', nav: Number(r?.[7]) || undefined, navDate: r?.[8], how: 'name', score: 1 } }; }
    const want = flags(name), tk = tokens(name);
    if (want.plan === 'unknown' || want.option === 'unknown') return { match: null, reason: 'plan or option not stated in the name' };
    const scored = this.rows.filter((x) => x.f.plan === want.plan && x.f.option === want.option).map((x) => ({ x, s: jacc(tk, x.tok) })).sort((a, b) => b.s - a.s);
    const top = scored[0], second = scored[1];
    if (!top || top.s < 0.8) return { match: null, reason: `no scheme close enough (best ${top ? top.s.toFixed(2) : '0'})` };
    if (second && second.s >= top.s - 0.001 && second.x.row[0] !== top.x.row[0]) return { match: null, reason: 'tie between schemes with the same words' };
    const r = top.x.row; return { match: { code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4], nav: Number(r[7]) || undefined, navDate: r[8], how: 'name', score: top.s } };
  }
}

                                                                                                              
/** Tax class of a fund from its AMFI category (design section 7). Anything the category does not settle stays unclassified, shown with a flag. */
export function fundTaxType(category        , name = '', eqMin                = null)              {
  const c = category.toLowerCase(), n = name.toLowerCase();
  if (/fof overseas|overseas|international/.test(c) || /gold|silver/.test(n) && /fund of fund|fof/.test(n + ' ' + c)) return 'overseas_fof';
  if (/index fund|etf/.test(c) && /gold|silver/.test(n)) return 'overseas_fof';
  if (/arbitrage/.test(c) || /balanced advantage|dynamic asset/.test(c)) return 'equity_fund';
  // Equity Savings (C-115): taxed as an equity fund when the fund's own stated minimum equity incl. arbitrage is 65% or more; below that, or not known, the cautious hybrid rule
  if (/equity savings/.test(c)) return eqMin !== null && eqMin >= 65 ? 'equity_fund' : 'hybrid_other';
  if (/aggressive hybrid/.test(c)) return 'equity_fund';
  if (/^equity scheme/.test(c) || /elss|index fund|sectoral|thematic/.test(c) && !/debt/.test(c)) return 'equity_fund';
  if (/index funds|other scheme - index|other scheme - etf/.test(c)) return /nifty|sensex|bse|nasdaq|s&p/.test(n) && !/nasdaq|s&p ?500|us /.test(n) ? 'equity_fund' : 'fund_unclassified';
  if (/debt|income|liquid|money market|gilt|overnight|ultra short|low duration|floater|corporate bond|credit risk|banking and psu|short duration|medium duration|long duration|dynamic bond/.test(c)) return 'debt_fund';
  // A Conservative Hybrid fund holds 75% to 90% in debt: a "specified mutual fund" (more than 65% in debt and money-market instruments), taxed at the slab rate whatever the holding period when bought on or after 1 Apr 2023 (section 50AA).
  // Its asset class stays Hybrid (assetclass.ts reads the category first); only the tax class changes.
  if (/conservative hybrid/.test(c)) return 'debt_fund';
  if (/multi asset|conservative hybrid|hybrid/.test(c)) return 'hybrid_other';
  return 'fund_unclassified';
}
