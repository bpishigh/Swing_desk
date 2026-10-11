import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction, resolveBreaks, estimateOptions, cleanRatio } from '../src/ingest/corp-actions.ts';
import { computeStocks, type BhavDay, type Row } from '../src/ingest/india-stocks.ts';

const row = (c: number, pc = c): Row => ['EQ', pc, c, c, c, c, 100, null];
/** 120 sessions of one stock at `before`, then `after` from session 60 on; plus 30 flat filler stocks so market-wide logic has a base. */
const mk = (before: number, after: number, n = 120, brk = 60): BhavDay[] => Array.from({ length: n }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  rows: { X: row(i < brk ? before : after, i === 0 ? before : (i - 1 < brk ? before : after)), ...Object.fromEntries(Array.from({ length: 30 }, (_, k) => [`F${k}`, row(50)])) },
}));
const always = () => true;
const noMkt = () => null;
const d = (days: BhavDay[], i: number) => days[i].date;

test('parse: bonus, split, rights, cash, demerger', () => {
  const p = (subject: string, cum = 100) => parseAction({ symbol: 'X', subject, exDate: '2026-01-01', faceVal: '1' }, cum);
  assert.equal(p('Bonus 1:1').factor, 0.5);
  assert.equal(p('Bonus 4:1').factor, 0.2);
  assert.equal(p('Face Value Split (Sub-Division) - From Rs 10/- Per Share To Re 1/- Per Share').factor, 0.1);
  assert.equal(p('Dividend - Rs 5 Per Share').factor, 1);
  assert.equal(p('Demerger').factor, null);
  assert.equal(p('Scheme Of Arrangement - Bonus Ncrps 1:1').factor, 1);
  const r = p('Rights 1:1 @ Premium Rs 99/-', 200);       // issue price 100: terp = (200+100)/2 = 150 -> 0.75
  assert.equal(r.factor, 0.75); assert.equal(r.confidence, 'approx');
});

test('exact split on the break day is accepted and the averages come back', () => {
  const days = mk(200, 100);
  const r = resolveBreaks(days, [{ symbol: 'X', subject: 'Bonus 1:1', exDate: d(days, 60) }], {}, always, noMkt);
  assert.equal(r.resolved.length, 1); assert.equal(r.resolved[0].factor, 0.5); assert.equal(r.unresolved.length, 0);
  const st = computeStocks(days, d(days, 119), always, r.options).X;
  assert.equal(st.sma50, 100); assert.equal(st.breaks.length, 0);
});

test('an ex-date one session off still matches; a wrong ratio is rejected', () => {
  const days = mk(200, 100);
  const off = resolveBreaks(days, [{ symbol: 'X', subject: 'Bonus 1:1', exDate: d(days, 61) }], {}, always, noMkt);
  assert.equal(off.resolved[0].how, 'list, date +1 session');
  const bad = resolveBreaks(days, [{ symbol: 'X', subject: 'Bonus 4:1', exDate: d(days, 60) }], {}, always, noMkt);   // predicts 0.2, price says 0.5
  assert.equal(bad.resolved.length, 0); assert.equal(bad.unresolved.length, 1);
  assert.match(bad.unresolved[0].reason, /does not match/);
});

test('a demerger gets no list ratio: unresolved, with a market-implied estimate kept apart', () => {
  const days = mk(200, 130);
  const r = resolveBreaks(days, [{ symbol: 'X', subject: 'Demerger', exDate: d(days, 60) }], {}, always, (dt) => (dt === d(days, 60) ? 0.01 : null));
  assert.equal(r.unresolved.length, 1); assert.match(r.unresolved[0].reason, /demerger/);
  assert.ok(Math.abs(r.unresolved[0].estimate!.factor - 0.65 / 1.01) < 1e-9);
  const st = computeStocks(days, d(days, 119), always, r.options).X;
  assert.equal(st.sma50, 130);                 // window of 50 closes is after the break, so it is clean
  const st2 = computeStocks(days.slice(0, 90), d(days, 89), always, r.options).X;
  assert.equal(st2.sma50, undefined);          // 30 closes after the break: omitted
  const est = computeStocks(days.slice(0, 90), d(days, 89), always, estimateOptions(r.options, r.unresolved)).X;
  assert.ok(est.sma50 !== undefined);          // the estimate fills the gap, separately
});

test('no action: a clean 1/10 break stays unresolved (ETF-like), a 30% jump is a real move', () => {
  const etf = mk(100, 10);
  const r1 = resolveBreaks(etf, [], {}, always, noMkt);
  assert.equal(r1.unresolved.length, 1); assert.match(r1.unresolved[0].reason, /ETF/); assert.equal(r1.unresolved[0].estimate!.factor, 0.1);
  const up = mk(100, 130);
  const r2 = resolveBreaks(up, [], {}, always, noMkt);
  assert.equal(r2.real.length, 1); assert.equal(r2.unresolved.length, 0);
  assert.equal(computeStocks(up, d(up, 119), always, r2.options).X.breaks.length, 0);
});

test('overrides win: a factor is applied, ignore marks a real move', () => {
  const days = mk(200, 130);
  const f = resolveBreaks(days, [], { [`X|${d(days, 60)}`]: { factor: 0.65 } }, always, noMkt);
  assert.equal(f.resolved[0].how, 'override');
  const ig = resolveBreaks(days, [], { [`X|${d(days, 60)}`]: { ignore: true } }, always, noMkt);
  assert.equal(ig.real.length, 1);
});

test('clean ratio helper', () => { assert.equal(cleanRatio(0.099), 0.1); assert.equal(cleanRatio(0.64), null); });

test('circular factor: accepted when the price break agrees, reported and not applied when it does not', () => {
  const days = mk(200, 20);   // 1/10 break with no action on the list
  const ok = resolveBreaks(days, [], { [`X|${d(days, 60)}`]: { factor: 0.1, circular: 'NSE/CML/1', note: 'unit split' } }, always, noMkt);
  assert.equal(ok.resolved[0].confidence, 'circular'); assert.equal(ok.unresolved.length, 0); assert.equal(ok.circularMismatch.length, 0);
  const wrong = resolveBreaks(days, [], { [`X|${d(days, 60)}`]: { factor: 0.5, circular: 'NSE/CML/2' } }, always, noMkt);   // circular says 1/2, price says 1/10
  assert.equal(wrong.resolved.length, 0); assert.equal(wrong.circularMismatch.length, 1); assert.equal(wrong.unresolved.length, 1);
});
test('a manual override outranks a circular on the same break', () => {
  const days = mk(200, 20);
  const k = `X|${d(days, 60)}`;
  const r = resolveBreaks(days, [], { [k]: { factor: 0.1, note: 'typed' } }, always, noMkt);
  assert.equal(r.resolved[0].confidence, 'override');
});
