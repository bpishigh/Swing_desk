// Cross-category allocation back-test (Engine Rules C-99). Pure: NAV series in, per-year result and the pass/fail out. Nothing after each 1 Oct date is used to rank.
import { cagr, navOn, normCategory,                       } from './fundscore.js';
import { riskStats } from './fundrisk.js';

export const CR = { firstYear: 2015, lastYear: 2025, minFunds: 8, top: 2, passShare: 0.6, minYears: 5, worstYearSlack: 3, cats: ['Large Cap', 'Large & Mid Cap', 'Mid Cap', 'Small Cap', 'Flexi Cap', 'Multi Cap', 'Focused', 'Value'], mix: { 'Large Cap': 0.71, 'Mid Cap': 0.18, 'Small Cap': 0.11 }                           };
                                                                                                                                       
                                                                                                                                                                             
const median = (a          )         => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plusYear = (d        )         => { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); };

export function categoryRotation(schemes          , series                  , cr = CR)            {
  const dates = new Map                  (); for (const [k, nav] of series) dates.set(k, Object.keys(nav).sort());
  const years            = [];
  for (let y = cr.firstYear; y <= cr.lastYear; y++) {
    const T = `${y}-10-01`, E = plusYear(T), per = new Map                                                        ();
    for (const s of schemes) {
      const c = normCategory(s.category), nav = series.get(s.code), d = dates.get(s.code); if (!cr.cats.includes(c) || !nav || !d) continue;
      const r3 = cagr(d, nav, T, 3), st = riskStats(nav, T), a = navOn(d, nav, T), b = navOn(d, nav, E);
      if (r3 === null || !st || !(a && b && a > 0)) continue;
      const e = per.get(c) ?? per.set(c, { r3: [], vol: [], fwd: [] }).get(c) ; e.r3.push(r3); e.vol.push(st.vol); e.fwd.push((b / a - 1) * 100);
    }
    const ok = [...per].filter(([, v]) => v.fwd.length >= cr.minFunds).map(([c, v]) => ({ c, score: median(v.r3) / median(v.vol), fwd: median(v.fwd) }));
    const need = Object.keys(cr.mix); if (ok.length < cr.top + 2 || !need.every((c) => ok.some((o) => o.c === c))) continue;
    const top = [...ok].sort((a, b) => b.score - a.score || a.c.localeCompare(b.c)).slice(0, cr.top), tilt = top.reduce((a, o) => a + o.fwd, 0) / top.length;
    const mix = need.reduce((a, c) => a + cr.mix[c] * ok.find((o) => o.c === c) .fwd, 0), equal = ok.reduce((a, o) => a + o.fwd, 0) / ok.length;
    years.push({ date: T, eligible: ok.length, picked: top.map((o) => o.c), tilt, mix, equal, excess: tilt - mix });
  }
  const counted = years.length, beat = years.filter((y) => y.excess > 0).length, medianExcess = counted ? median(years.map((y) => y.excess)) : null;
  const worstTilt = counted ? Math.min(...years.map((y) => y.tilt)) : null, worstMix = counted ? Math.min(...years.map((y) => y.mix)) : null;
  const pass = counted >= cr.minYears && beat / counted >= cr.passShare && (medianExcess ?? -1) > 0 && worstTilt  >= worstMix  - cr.worstYearSlack;
  return { years, counted, beat, medianExcess, worstTilt, worstMix, pass };
}
