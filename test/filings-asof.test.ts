import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asOfResults, quarterEndOnOrAfter, type ResultFact } from '../src/engine/filings-asof.ts';

const E = 'ACME';
const f = (period: string, rev: number | null, o: Partial<ResultFact> = {}): ResultFact => ({ entity: E, period, basis: 'consolidated', asOf: `${nextMonth(period)}T10:00:00Z`, revision: 0, fields: { revenue: rev, pbt: rev == null ? null : rev / 5, pat: rev == null ? null : rev / 8, eps: rev == null ? null : rev / 100 }, ...o });
function nextMonth(p: string) { const d = new Date(p + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 40); return d.toISOString().slice(0, 10); }
// eight quarters, Mar 2024 to Dec 2025, revenue growing 10 a quarter from 100
const Q = ['2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31'];
const base = Q.map((p, i) => f(p, 100 + 10 * i));

test('nothing filed after t is returned', () => {
  const v = asOfResults(base, E, '2025-01-31'); assert.deepEqual(v.quarters.map((q) => q.period), ['2024-12-31', '2024-09-30', '2024-06-30', '2024-03-31'].filter((p) => nextMonth(p) <= '2025-01-31'));
  assert.ok(v.quarters.every((q) => q.asOf.slice(0, 10) <= '2025-01-31'));
});
test('year-on-year growth compares with the year-ago quarter', () => {
  const v = asOfResults(base, E, '2026-03-31'); const q = v.quarters[0];
  assert.equal(q.period, '2025-12-31'); assert.equal(q.yoyReason, 'ok'); assert.ok(Math.abs((q.yoy!.revenue as number) - (170 / 130 - 1)) < 1e-12);
  assert.equal(v.quarters[v.quarters.length - 1].yoyReason, 'no year-ago quarter');
});
test('the original filing is used; a later revision is used only when asked, with its own date', () => {
  const rev = f('2025-12-31', 999, { revision: 1, asOf: '2026-03-01T10:00:00Z' });
  const o = asOfResults([...base, rev], E, '2026-06-30'); assert.equal(o.quarters[0].values.revenue, 170); assert.equal(o.quarters[0].revision, 0);
  const r = asOfResults([...base, rev], E, '2026-06-30', { revisions: true }); assert.equal(r.quarters[0].values.revenue, 999); assert.equal(r.quarters[0].asOf, '2026-03-01T10:00:00Z');
  const before = asOfResults([...base, rev], E, '2026-02-15', { revisions: true }); assert.equal(before.quarters[0].values.revenue, 170);   // the revision did not exist yet
});
test('consolidated is used where filed; standalone otherwise', () => {
  const s = f('2025-12-31', 50, { basis: 'standalone' }); const c = f('2025-12-31', 170);
  assert.equal(asOfResults([s, c], E, '2026-06-30').quarters[0].basis, 'consolidated');
  assert.equal(asOfResults([s], E, '2026-06-30').quarters[0].basis, 'standalone');
});
test('growth is not computed across a basis difference', () => {
  const facts = base.map((x, i) => (i < 4 ? { ...x, basis: 'standalone' as const } : x));
  const v = asOfResults(facts, E, '2026-06-30'); assert.equal(v.quarters.find((q) => q.period === '2025-03-31')!.yoyReason, 'basis differs');
  assert.ok(v.flags.some((x) => x.kind === 'first consolidated filing' && x.date === '2025-03-31'));
});
test('after a demerger growth is suppressed for four quarters and returns on the fifth, counting the event quarter', () => {
  const ev = [{ date: '2024-10-14', kind: 'demerger' as const, symbol: E, subject: 'Demerger', isin: null }];   // event quarter is Dec 2024
  const facts = ['2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31'].map((p, i) => f(p, 100 + 10 * i));
  const more = [...facts, f('2026-03-31', 200), f('2026-06-30', 210), f('2026-09-30', 220), f('2026-12-31', 230)];
  const v = asOfResults(more, E, '2027-03-31', { events: ev, limit: 20 }); const by = (p: string) => v.quarters.find((q) => q.period === p)!;
  assert.equal(by('2025-03-31').yoyReason, 'structure event'); assert.equal(by('2025-09-30').yoyReason, 'structure event');
  assert.equal(by('2025-12-31').yoyReason, 'ok');   // year-ago is the event quarter itself: five quarters counted from it
  assert.equal(by('2026-03-31').yoyReason, 'ok');
  assert.equal(by('2024-12-31').yoyReason, 'no year-ago quarter');
  assert.ok(v.flags.some((x) => x.kind === 'structure event'));
});
test('an event that has not happened yet at t changes nothing', () => {
  const ev = [{ date: '2026-10-01', kind: 'demerger' as const, symbol: E, subject: 'Demerger', isin: null }];
  const v = asOfResults(base, E, '2026-03-31', { events: ev }); assert.equal(v.quarters[0].yoyReason, 'ok'); assert.equal(v.flags.length, 0);
});
test('a missing field stays null; a non-positive base gives no growth, not a made-up number', () => {
  const facts = base.map((x, i) => (i === 3 ? { ...x, fields: { revenue: null, pbt: -5, pat: null, eps: null } } : x));
  const v = asOfResults(facts, E, '2026-06-30'); const q = v.quarters.find((x) => x.period === '2025-12-31')!;           // its year-ago quarter is the doctored one
  assert.equal(q.yoy!.revenue, null); assert.equal(q.yoy!.pat, null);       // year-ago revenue and profit missing
  assert.equal(q.yoy!.pbt, null);                                            // year-ago profit before tax negative: no growth figure
  assert.equal(q.yoyReason, 'base not positive');
});
test('facts of other companies are ignored', () => { assert.equal(asOfResults([...base, { ...f('2025-12-31', 5), entity: 'OTHER' }], E, '2026-06-30').quarters[0].values.revenue, 170); });
test('quarter end helper', () => { assert.equal(quarterEndOnOrAfter('2025-10-14'), '2025-12-31'); assert.equal(quarterEndOnOrAfter('2025-03-31'), '2025-03-31'); assert.equal(quarterEndOnOrAfter('2025-04-01'), '2025-06-30'); });
