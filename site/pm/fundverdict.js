// Verdicts for held mutual funds, index funds and ETFs (Engine Rules C-81, design 9.1). Pure: the caller supplies the published fund scores, the back-test gate and, for sector funds, the NAV history.
// Active and index funds: Strong or Average = Keep, Weak = Watch, Weak for three monthly runs in a row = Replace, but only for active funds and only when the back-test passed.
// Sector and thematic funds: the stock lens on the fund's NAV (a close below the 200-session average or below the last major swing low = Exit). Everything else: No verdict, with the reason.
import { sma, swingLow, SMA_LEN } from './verdict.js';

                                                                                                                                                                                                                                                                                                                                                    
                                                                                                                                             
                                                                             
                                                                                                            

const PLAIN = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
export const normFundName = (n         )         => String(n ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(limited|ltd)\b/g, '').replace(/\s+/g, ' ').trim();
export const looseKey = (n        )         => normFundName(n).replace(/\b(direct|plan|growth|option|fund)\b/g, ' ').replace(/\s+/g, ' ').trim();

const med = (a          )                => { if (!a.length) return null; const t = [...a].sort((x, y) => x - y), m = t.length >> 1; return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
const BENCH                         = { 'Large Cap': 'Nifty 50', 'Mid Cap': 'Nifty Midcap 150', 'Small Cap': 'Nifty Smallcap 250' };
const f1 = (v                           )         => (v == null ? 'n/a' : v.toFixed(1) + '%');
/** C-84 (display only, no rule): the fund's own return next to its category, the index funds for that market segment and cash (liquid funds), so a good rank in a weak category is not read as a good return. */
export function marketFacts(row              , scores                )                                                                       {
  if (row.r3 == null || (row.g !== 'mf' && row.g !== 'idx')) return null;
  const peers = scores.filter((x) => x.g === row.g && x.c === row.c), cm = med(peers.map((x) => x.r3).filter((v)              => v != null));
  const idxName = row.g === 'mf' ? (BENCH[row.c] ?? 'Nifty 500') : '', idxRows = scores.filter((x) => x.g === 'idx' && x.c === idxName && x.r3 != null);
  const im = row.g !== 'mf' ? null : idxRows.length >= 3 ? med(idxRows.map((x) => x.r3          )) : med(scores.filter((x) => x.g === 'idx' && x.c === 'Nifty 50' && x.r3 != null).map((x) => x.r3          ));
  const cash = med(scores.filter((x) => x.g === 'debt' && x.c === 'Liquid' && x.r3 != null).map((x) => x.r3          ));
  return { cm, im, cash };
}
/** C-84: the fund's own return next to its category, the index funds for its segment and cash, so a good rank in a weak category is not read as a good return. */
export function marketContext(row              , scores                )         {
  const m = marketFacts(row, scores); if (!m) return '';
  const bits = [`3-year return ${f1(row.r3)}`, `category median ${f1(m.cm)}`, ...(m.im != null ? [`index funds ${f1(m.im)}`] : []), ...(m.cash != null ? [`liquid funds ${f1(m.cash)}`] : [])];
  const weak = m.cm != null && m.cash != null && m.cm < m.cash ? '; the whole category has returned less than cash over 3 years' : '';
  return bits.join(', ') + weak;
}
const no = (why        )              => ({ label: 'No verdict', reasons: [why], pending: [], asOf: null });

export function fundVerdict(held                                                    , scores                            , gate                  , nav                         )              {
  if (!scores || !gate) return no('fund scores are not loaded');
  if (!gate.ran) return no('waiting for the fund-score back-test (Engine Rules C-81)');
  const key = normFundName(held.name), cat = held.category ?? '';
  // The broker's order file carries no ISIN, so the page matches the name to the AMFI list first (holding.isin); the score row is found by that ISIN, then by the plain name.
  const row = (held.isin ? scores.find((r) => r.i === held.isin) : undefined) ?? scores.find((r) => normFundName(r.n) === key) ?? scores.find((r) => looseKey(r.n) === looseKey(held.name));
  if (row && row.g === 'us') return no('US-listed ETFs are not judged here');
  // Sector and thematic funds take the stock lens on their NAV; this does not need a score row (AMFI files newer themes under "Thematic").
  if (row?.c === 'Sectoral/Thematic' || row?.c?.startsWith('Thematic · ') || (!row && /thematic|sectoral/i.test(cat))) {
    const d = nav ? Object.keys(nav).sort() : [];
    if (d.length < SMA_LEN) return no(nav ? 'sector fund: fewer than 200 NAV sessions, so the 200-day test cannot run' : 'sector fund: loading its NAV history for the 200-day test');
    const closes = d.map((x) => nav [x]), last = closes[closes.length - 1], avg = sma(closes), sl = swingLow(d, closes);
    const below200 = avg !== null && last < avg, belowSwing = sl !== null && last < sl.price;
    const reasons = [below200 ? `NAV ${last.toFixed(2)} is below its 200-day average ${avg .toFixed(2)}` : '', belowSwing ? `NAV is below the last swing low ${sl .price.toFixed(2)}` : ''].filter(Boolean);
    // C-105: inside its own theme the score is weakly related to the next year (rank correlation +0.06, passed); it can lower Keep to Watch for the bottom quarter, never to Replace
    const own = row?.c?.startsWith('Thematic · ') && row.b ? `score band ${row.b} among ${row.p ?? '?'} in ${row.c.slice(11)} funds` : '', note = own ? ['inside its theme the ranking is only weakly related to the next year (C-105)'] : [];
    if (reasons.length) return { label: 'Exit', reasons: own ? [...reasons, own] : reasons, pending: note, asOf: d[d.length - 1] };
    if (own && row .b === 'Weak') return { label: 'Watch', reasons: ['sector fund: NAV above its 200-day average and its swing low', own], pending: note, asOf: d[d.length - 1] };
    return { label: 'Keep', reasons: ['sector fund: NAV above its 200-day average and its swing low'].concat(own ? [own] : []), pending: note, asOf: d[d.length - 1] };
  }
  if (!row) {
    if (/liquid|debt|income|gilt|money market|overnight|duration|bond|credit|banking and psu|floater/i.test(cat)) return no('debt and liquid funds are not scored yet (no credit or duration data)');
    if (/overseas|international|fund of funds|fof|global|offshore/i.test(cat + ' ' + held.name)) return no('international and fund-of-funds are not scored yet (no peer group)');
    if (/gold|silver/i.test(cat + ' ' + held.name)) return no('gold and silver funds are not scored yet');
    return no('not in the scored list: it is new, or AMFI lists it without a plan so its Direct Growth line cannot be told from its Regular and IDCW twins');
  }
  if (!row.b) return no(row.note || 'not scored');
  if (row.g === 'debt' || row.g === 'intl') {   // C-82: judged on return, consistency, risk-adjusted return, downside and cost inside the group; Keep or Watch only
    const facts = [row.dd != null ? `worst 3-year fall ${row.dd.toFixed(1)}%` : '', row.wd != null ? `worst day ${row.wd.toFixed(1)}%` : '', row.vol != null ? `volatility ${row.vol.toFixed(1)}%` : '', row.t != null ? `expense ratio ${row.t.toFixed(2)}%` : ''].filter(Boolean).join(', ');
    const reasons = [`score band ${row.b} among ${row.p ?? '?'} in ${row.c}` + (facts ? ' (' + facts + ')' : '')].concat(row.fl ? [row.fl] : []);
    const pending = ['Replace is not available for debt and international funds; credit quality and maturity are not scored'].concat(row.g === 'intl' ? ['international band: the 10-year test could not be run (too few funds, C-103), so it is not shown to predict anything'] : []);   // C-103
    return { label: row.b === 'Weak' ? 'Watch' : 'Keep', reasons, pending, asOf: null };
  }
  const plain = PLAIN.has(row.c), hybridNote = row.g === 'mf' && !plain ? ['hybrid fund: judged inside its own category; Replace is off for it'] : [];
  const ctx = marketContext(row, scores), withCtx = (v             )              => (ctx ? { ...v, reasons: [...v.reasons, ctx] } : v);
  if (row.b === 'Average' && plain && row.g === 'mf' && gate.nearWeakOn && row.s != null && row.s >= 25 && row.s < 35) return withCtx({ label: 'Watch', reasons: [`score ${row.s.toFixed(1)}: just above the Weak line in ${row.c}, near the bottom quarter`], pending: [], asOf: null });   // C-83
  // C-85: absolute quality for plain equity funds, each rule on only when its own back-test passed
  if (row.g === 'mf' && plain && (row.b === 'Strong' || row.b === 'Average')) {
    const m = marketFacts(row, scores);
    if (m && gate.cashRuleOn && m.cash != null && row.r3  < m.cash) return withCtx({ label: 'Watch', reasons: [`trailing cash: 3-year return ${f1(row.r3)} is below the liquid funds' ${f1(m.cash)}`], pending: [], asOf: null });
    if (m && gate.indexRuleOn && m.im != null && row.r3  < m.im) return withCtx({ label: 'Watch', reasons: [`trailing the index funds: 3-year return ${f1(row.r3)} is below the index funds' ${f1(m.im)}`], pending: [`score band ${row.b} in ${row.c}`], asOf: null });
  }
  if (row.b === 'Strong' || row.b === 'Average') return withCtx({ label: 'Keep', reasons: [`score band ${row.b} in ${row.c}`], pending: [], asOf: null });
  const why = `score band Weak in ${row.c}`;
  if (row.rp && row.g === 'mf' && plain) {
    if (gate.replaceOn) return withCtx({ label: 'Replace', reasons: [why + ', Weak in 3 monthly runs in a row'], pending: [], asOf: null });
    return withCtx({ label: 'Watch', reasons: [why + ', Weak in 3 monthly runs in a row'], pending: ['no switch advice yet: in the 10-year test, funds with a Weak score did lag their peers, but top-scored funds did not reliably beat theirs, so a switch is your decision'], asOf: null });
  }
  return withCtx({ label: 'Watch', reasons: [why], pending: row.g === 'idx' ? ['Replace is off for index funds and ETFs'] : hybridNote, asOf: null });
}
