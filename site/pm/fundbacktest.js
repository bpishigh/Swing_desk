// Fund-score back-test (Engine Rules C-81). Pure: takes NAV series, returns the per-year result and the two pass/fail tests. No tuning happens here.
import { scoreAll, navOn, addDays, cagr, indexKey,                        SETTINGS } from './fundscore.js';

export const BT = { firstYear: 2015, lastYear: 2025, minGroup: 10, passShare: 0.6, minYears: 5, nearWeakTo: 35 };   // nearWeakTo: C-83, fixed before the run   // fixed in C-81 before the first run
                                                                                                                                                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                                                                                                                                                     

const median = (a          )         => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plusYear = (d        )         => { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); };

                                                                                                                                                             
/** `scorer` defaults to the FUND-3 score; C-82 passes the risk-aware score for debt groups to run the same test on it (information only). */
                                                        
/** C-85: `ctx` holds the index funds and liquid funds used for the index test (D) and the cash test (E). */
export function runBacktest(schemes          , series                  , s = SETTINGS, scorer         = (sc, cut, T) => scoreAll(sc, cut, T, s), ctx      )         {
  const dates = new Map                  (); for (const [k, nav] of series) dates.set(k, Object.keys(nav).sort());
  const points          = [];
  for (let y = BT.firstYear; y <= BT.lastYear; y++) {
    const T = `${y}-10-01`, E = plusYear(T);
    // only NAVs up to T may be used to score; the series is cut so a look-ahead bug cannot hide
    const cut = new Map             ();
    for (const [k, nav] of series) { const d = dates.get(k) , o      = {}; for (const x of d) { if (x > T) break; o[x] = nav[x]; } if (d[0] <= T) cut.set(k, o); }
    const sc = scorer(schemes, cut, T).filter((r) => r.band);
    const fwd = new Map                ();
    for (const r of sc) { const d = dates.get(r.code) , nav = series.get(r.code) , a = navOn(d, nav, T), b = navOn(d, nav, E); if (a && b && a > 0) fwd.set(r.code, b / a - 1); }
    const byCat = new Map                  (); for (const r of sc) { const f = fwd.get(r.code); if (f !== undefined) (byCat.get(r.cat) ?? byCat.set(r.cat, []).get(r.cat) ).push(f); }
    const medCat = new Map([...byCat].map(([c, v]) => [c, median(v)]));
    const ex = (band        ) => sc.filter((r) => r.band === band && fwd.has(r.code)).map((r) => (fwd.get(r.code)  - medCat.get(r.cat) ) * 100);
    // C-85 tests D and E: trailing 3-year return below the segment index funds' median (D) or below the liquid funds' median (E); outcome = forward return minus that median's forward return
    const med3 = (codes          , f                              ) => { const v = codes.map(f).filter((x)              => x !== null); return v.length >= 3 ? median(v) : null; };
    const r3Of = (c        ) => { const nav = series.get(c); return nav ? cagr(dates.get(c) , nav, T, 3) : null; };
    const fwdOf = (c        ) => { const d = dates.get(c), nav = series.get(c); if (!d || !nav) return null; const a = navOn(d, nav, T), b = navOn(d, nav, E); return a && b && a > 0 ? b / a - 1 : null; };
    const idxCodes = new Map                  (); for (const x of ctx?.idx ?? []) { const k = indexKey(x.name); if (k) (idxCodes.get(k) ?? idxCodes.set(k, []).get(k) ).push(x.code); }
    const SEG                         = { 'Large Cap': 'Nifty 50', 'Mid Cap': 'Nifty Midcap 150', 'Small Cap': 'Nifty Smallcap 250' };
    const bench = (cat        ) => { for (const k of [SEG[cat] ?? 'Nifty 500', 'Nifty 50']) { const codes = idxCodes.get(k) ?? [], r3 = med3(codes, r3Of), fw = med3(codes, fwdOf); if (r3 !== null && fw !== null) return { r3, fw }; } return null; };
    const cashR3 = ctx ? med3(ctx.liquid, r3Of) : null, cashFw = ctx ? med3(ctx.liquid, fwdOf) : null;
    const D           = [], Ex           = [];
    for (const r of sc) { const f = fwd.get(r.code), t3 = r3Of(r.code); if (f === undefined || t3 === null) continue; const b = bench(r.cat); if (b && t3 < b.r3) D.push((f - b.fw) * 100); if (cashR3 !== null && cashFw !== null && t3 < cashR3) Ex.push((f - cashFw) * 100); }
    const mD = D.length ? median(D) : null, cD = D.length >= BT.minGroup, mE = Ex.length ? median(Ex) : null, cE = Ex.length >= BT.minGroup;
    const A = ex('Strong'), B = ex('Weak');
    const C = sc.filter((r) => r.score != null && r.score >= 25 && r.score < BT.nearWeakTo && fwd.has(r.code)).map((r) => (fwd.get(r.code)  - medCat.get(r.cat) ) * 100);
    const mC = C.length ? median(C) : null, cC = C.length >= BT.minGroup;
    const mA = A.length ? median(A) : null, mB = B.length ? median(B) : null;
    const cA = A.length >= BT.minGroup, cB = B.length >= BT.minGroup;
    points.push({ date: T, scored: sc.length, strong: A.length, weak: B.length, medExcessStrong: mA, medExcessWeak: mB, countedA: cA, countedB: cB, passA: cA && mA  > 0, passB: cB && mB  < 0, near: C.length, medExcessNear: mC, countedC: cC, passC: cC && mC  < 0, nD: D.length, medD: mD, countedD: cD, passD: cD && mD  < 0, nE: Ex.length, medE: mE, countedE: cE, passE: cE && mE  < 0 });
  }
  const test = (cnt                       , pas                       ) => { const counted = points.filter(cnt).length, passed = points.filter((p) => cnt(p) && pas(p)).length; return { counted, passed, pass: counted >= BT.minYears && passed / counted >= BT.passShare }; };
  const testA = test((p) => p.countedA, (p) => p.passA), testB = test((p) => p.countedB, (p) => p.passB);
  const testC = test((p) => p.countedC, (p) => p.passC), testD = test((p) => p.countedD, (p) => p.passD), testE = test((p) => p.countedE, (p) => p.passE);
  return { points, testA, testB, testC, testD, testE, indexRuleOn: testD.pass, cashRuleOn: testE.pass, nearWeakOn: testC.pass, replaceOn: testA.pass && testB.pass, funds: series.size };
}
