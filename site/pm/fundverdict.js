// Verdicts for held mutual funds, index funds and ETFs (Engine Rules C-81, design 9.1). Pure: the caller supplies the published fund scores, the back-test gate and, for sector funds, the NAV history.
// Active and index funds: Strong or Average = Keep, Weak = Watch, Weak for three monthly runs in a row = Replace, but only for active funds and only when the back-test passed.
// Sector and thematic funds: the stock lens on the fund's NAV (a close below the 200-session average or below the last major swing low = Exit). Everything else: No verdict, with the reason.
import { sma, swingLow, SMA_LEN } from './verdict.js';

                                                                                                                                                   
                                                                          
                                                                             
                                                                                                            

const PLAIN = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
export const normFundName = (n         )         => String(n ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(limited|ltd)\b/g, '').replace(/\s+/g, ' ').trim();
const no = (why        )              => ({ label: 'No verdict', reasons: [why], pending: [], asOf: null });

export function fundVerdict(held                  , scores                            , gate                  , nav                         )              {
  if (!scores || !gate) return no('fund scores are not loaded');
  if (!gate.ran) return no('waiting for the fund-score back-test (Engine Rules C-81)');
  const key = normFundName(held.name);
  const row = scores.find((r) => normFundName(r.n) === key);
  if (!row) return no('not in the scored list (the scored list holds Direct-Growth plans)');
  if (row.g === 'us') return no('US-listed ETFs are not judged here');
  if (row.c === 'Sectoral/Thematic') {
    const d = nav ? Object.keys(nav).sort() : [];
    if (d.length < SMA_LEN) return no('sector fund: needs 200 NAV sessions for the 200-day test');
    const closes = d.map((x) => nav [x]), last = closes[closes.length - 1], avg = sma(closes), sl = swingLow(d, closes);
    const below200 = avg !== null && last < avg, belowSwing = sl !== null && last < sl.price;
    const reasons = [below200 ? `NAV ${last.toFixed(2)} is below its 200-day average ${avg .toFixed(2)}` : '', belowSwing ? `NAV is below the last swing low ${sl .price.toFixed(2)}` : ''].filter(Boolean);
    return reasons.length ? { label: 'Exit', reasons, pending: [], asOf: d[d.length - 1] } : { label: 'Keep', reasons: ['sector fund: NAV above its 200-day average and its swing low'], pending: [], asOf: d[d.length - 1] };
  }
  if (row.g === 'mf' && !PLAIN.has(row.c)) return no(`${row.c} funds are not judged against each other (hybrid and similar)`);
  if (!row.b) return no(row.note || 'not scored');
  if (row.b === 'Strong' || row.b === 'Average') return { label: 'Keep', reasons: [`score band ${row.b} in ${row.c}`], pending: [], asOf: null };
  // Weak
  const why = `score band Weak in ${row.c}`;
  if (row.rp && row.g === 'mf') {
    if (gate.replaceOn) return { label: 'Replace', reasons: [why + ', Weak in 3 monthly runs in a row'], pending: [], asOf: null };
    return { label: 'Watch', reasons: [why + ', Weak in 3 monthly runs in a row'], pending: ['Replace is off: the back-test did not pass'], asOf: null };
  }
  return { label: 'Watch', reasons: [why], pending: row.g === 'idx' ? ['Replace is off for index funds and ETFs'] : [], asOf: null };
}
