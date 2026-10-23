// Fund-score back-test (Engine Rules C-81). Pure: takes NAV series, returns the per-year result and the two pass/fail tests. No tuning happens here.
import { scoreAll, navOn, addDays, type Scheme, type Nav, SETTINGS } from './fundscore.ts';

export const BT = { firstYear: 2015, lastYear: 2025, minGroup: 10, passShare: 0.6, minYears: 5, nearWeakTo: 35 };   // nearWeakTo: C-83, fixed before the run   // fixed in C-81 before the first run
export interface Point { date: string; scored: number; strong: number; weak: number; medExcessStrong: number | null; medExcessWeak: number | null; countedA: boolean; countedB: boolean; passA: boolean; passB: boolean; near: number; medExcessNear: number | null; countedC: boolean; passC: boolean }
export interface Result { points: Point[]; testA: { counted: number; passed: number; pass: boolean }; testB: { counted: number; passed: number; pass: boolean }; testC: { counted: number; passed: number; pass: boolean }; nearWeakOn: boolean; replaceOn: boolean; funds: number }

const median = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plusYear = (d: string): string => { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); };

export type Scorer = (schemes: Scheme[], cut: Map<string, Nav>, asOf: string) => { code: string; cat: string; band: string | null; score?: number | null }[];
/** `scorer` defaults to the FUND-3 score; C-82 passes the risk-aware score for debt groups to run the same test on it (information only). */
export function runBacktest(schemes: Scheme[], series: Map<string, Nav>, s = SETTINGS, scorer: Scorer = (sc, cut, T) => scoreAll(sc, cut, T, s)): Result {
  const dates = new Map<string, string[]>(); for (const [k, nav] of series) dates.set(k, Object.keys(nav).sort());
  const points: Point[] = [];
  for (let y = BT.firstYear; y <= BT.lastYear; y++) {
    const T = `${y}-10-01`, E = plusYear(T);
    // only NAVs up to T may be used to score; the series is cut so a look-ahead bug cannot hide
    const cut = new Map<string, Nav>();
    for (const [k, nav] of series) { const d = dates.get(k)!, o: Nav = {}; for (const x of d) { if (x > T) break; o[x] = nav[x]; } if (d[0] <= T) cut.set(k, o); }
    const sc = scorer(schemes, cut, T).filter((r) => r.band);
    const fwd = new Map<string, number>();
    for (const r of sc) { const d = dates.get(r.code)!, nav = series.get(r.code)!, a = navOn(d, nav, T), b = navOn(d, nav, E); if (a && b && a > 0) fwd.set(r.code, b / a - 1); }
    const byCat = new Map<string, number[]>(); for (const r of sc) { const f = fwd.get(r.code); if (f !== undefined) (byCat.get(r.cat) ?? byCat.set(r.cat, []).get(r.cat)!).push(f); }
    const medCat = new Map([...byCat].map(([c, v]) => [c, median(v)]));
    const ex = (band: string) => sc.filter((r) => r.band === band && fwd.has(r.code)).map((r) => (fwd.get(r.code)! - medCat.get(r.cat)!) * 100);
    const A = ex('Strong'), B = ex('Weak');
    const C = sc.filter((r) => r.score != null && r.score >= 25 && r.score < BT.nearWeakTo && fwd.has(r.code)).map((r) => (fwd.get(r.code)! - medCat.get(r.cat)!) * 100);
    const mC = C.length ? median(C) : null, cC = C.length >= BT.minGroup;
    const mA = A.length ? median(A) : null, mB = B.length ? median(B) : null;
    const cA = A.length >= BT.minGroup, cB = B.length >= BT.minGroup;
    points.push({ date: T, scored: sc.length, strong: A.length, weak: B.length, medExcessStrong: mA, medExcessWeak: mB, countedA: cA, countedB: cB, passA: cA && mA! > 0, passB: cB && mB! < 0, near: C.length, medExcessNear: mC, countedC: cC, passC: cC && mC! < 0 });
  }
  const test = (cnt: (p: Point) => boolean, pas: (p: Point) => boolean) => { const counted = points.filter(cnt).length, passed = points.filter((p) => cnt(p) && pas(p)).length; return { counted, passed, pass: counted >= BT.minYears && passed / counted >= BT.passShare }; };
  const testA = test((p) => p.countedA, (p) => p.passA), testB = test((p) => p.countedB, (p) => p.passB);
  const testC = test((p) => p.countedC, (p) => p.passC);
  return { points, testA, testB, testC, nearWeakOn: testC.pass, replaceOn: testA.pass && testB.pass, funds: series.size };
}
