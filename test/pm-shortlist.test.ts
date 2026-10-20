import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchBuy, sessionsBetween, outsidePct, type ShortLine } from '../src/pm/shortlist.ts';
import { inferBooks } from '../src/pm/books.ts';

const S = { nearSessions: 3, nearPricePct: 2 };
const line: ShortLine = { sym: 'AAA', setup: '4', trigger: 100, limit: 101, stop: 92, signalDate: '2026-10-16' };   // a Friday
const lot = (key: string, date: string, unitCost: number) => ({ key, date, qty: 10, unitCost, source: {} as any });

test('sessions count weekdays after the signal date, skipping the weekend', () => {
  assert.equal(sessionsBetween('2026-10-16', '2026-10-19'), 1);   // Fri -> Mon
  assert.equal(sessionsBetween('2026-10-16', '2026-10-21'), 3);
  assert.equal(sessionsBetween('2026-10-19', '2026-10-19'), 0);
});
test('exact: entry session, price inside trigger and limit', () => {
  const m = matchBuy('AAA', '2026-10-19', 100.4, [line], S)!;
  assert.equal(m.tier, 'exact'); assert.equal(m.line.stop, 92);
});
test('near: a later session, or a price just outside the range; beyond the tolerance is no match', () => {
  assert.equal(matchBuy('AAA', '2026-10-20', 100.5, [line], S)!.tier, 'near');          // second session, inside range
  assert.equal(matchBuy('AAA', '2026-10-19', 102.5, [line], S)!.tier, 'near');          // 1.5% above the limit
  assert.equal(matchBuy('AAA', '2026-10-19', 98.5, [line], S)!.tier, 'near');           // 1.5% below the trigger
  assert.equal(matchBuy('AAA', '2026-10-19', 104, [line], S), null);                    // 3% above
  assert.equal(matchBuy('AAA', '2026-10-22', 100.5, [line], S), null);                  // 4 sessions later
  assert.equal(matchBuy('AAA', '2026-10-16', 100.5, [line], S), null);                  // same day as the signal: not after it
  assert.equal(matchBuy('BBB', '2026-10-19', 100.5, [line], S), null);                  // other stock
});
test('the nearest line wins; exact beats near', () => {
  const later: ShortLine = { ...line, signalDate: '2026-10-19', trigger: 103, limit: 104, stop: 95 };
  const m = matchBuy('AAA', '2026-10-20', 103.5, [line, later], S)!;
  assert.equal(m.line.signalDate, '2026-10-19'); assert.equal(m.tier, 'exact');
  assert.equal(outsidePct(line, 100.5), 0);
});
test('books: exact is Swing with the line stop; near waits for an answer; yes makes it Swing; no keeps Legacy; before go-live stays Legacy', () => {
  const ctx = (answer?: 'yes' | 'no') => ({ typeOf: () => 'listed_equity' as const, isFund: () => false, swingGoLive: '2026-10-16', swingMatch: (l: any) => { const m = matchBuy('AAA', l.date, l.unitCost, [line], S); return m ? { ...m, answer } : null; } });
  const ex = inferBooks([lot('K', '2026-10-19', 100.4)], ctx())[0];
  assert.equal(ex.book, 'Swing'); assert.equal(ex.swing!.stop, 92); assert.equal(ex.swing!.tier, 'exact');
  const nr = inferBooks([lot('K', '2026-10-20', 100.5)], ctx())[0];
  assert.equal(nr.book, 'Legacy'); assert.ok(nr.proposal);
  const yes = inferBooks([lot('K', '2026-10-20', 100.5)], ctx('yes'))[0];
  assert.equal(yes.book, 'Swing'); assert.equal(yes.swing!.tier, 'near-confirmed');
  const no = inferBooks([lot('K', '2026-10-20', 100.5)], ctx('no'))[0];
  assert.equal(no.book, 'Legacy'); assert.equal(no.proposal, undefined);
  assert.equal(inferBooks([lot('K', '2026-10-15', 100.4)], ctx())[0].book, 'Legacy');
});
