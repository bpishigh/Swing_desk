import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildEntities, eventKind } from '../src/ingest/entities.ts';

const asOf = '2026-11-06';
const base = { nameChanges: [], actions: [], asOf };

test('a ticker change keeps one entity and one history', () => {
  const t = buildEntities({ ...base, spans: { OLD: { first: '2015-01-01', last: '2020-05-29' }, NEW: { first: '2020-06-01', last: asOf } }, symbolChanges: [{ oldSymbol: 'OLD', newSymbol: 'NEW', date: '2020-06-01' }] });
  assert.equal(t.entities.length, 1); const e = t.entities[0];
  assert.equal(e.id, 'OLD'); assert.deepEqual(e.symbols.map((u) => [u.symbol, u.from, u.to]), [['OLD', '2015-01-01', '2020-05-31'], ['NEW', '2020-06-01', null]]);
  assert.equal(e.status, 'active'); assert.equal(t.review.length, 0);
});
test('a chain of changes is followed to the end', () => {
  const t = buildEntities({ ...base, spans: { A: { first: '2010-01-01', last: '2012-12-31' }, B: { first: '2013-01-01', last: '2018-12-31' }, C: { first: '2019-01-01', last: asOf } }, symbolChanges: [{ oldSymbol: 'B', newSymbol: 'C', date: '2019-01-01' }, { oldSymbol: 'A', newSymbol: 'B', date: '2013-01-01' }] });
  assert.equal(t.entities.length, 1); assert.deepEqual(t.entities[0].symbols.map((u) => u.symbol), ['A', 'B', 'C']);
});
test('changes of funds and other non-equity symbols are ignored', () => {
  const t = buildEntities({ ...base, spans: { X: { first: '2020-01-01', last: asOf } }, symbolChanges: [{ oldSymbol: 'FUND1', newSymbol: 'FUND2', date: '2021-01-01' }] });
  assert.equal(t.entities.length, 1); assert.equal(t.counts.linked, 0);
});
test('a name change is recorded on the entity, not a new entity', () => {
  const t = buildEntities({ ...base, spans: { Z: { first: '2020-01-01', last: asOf } }, symbolChanges: [], nameChanges: [{ symbol: 'Z', oldName: 'Zed Ltd', newName: 'Zed Industries Ltd', date: '2023-04-01' }] });
  assert.deepEqual(t.entities[0].names.map((n) => n.name), ['Zed Ltd', 'Zed Industries Ltd']);
});
test('a new symbol that already traded as its own company is not merged and goes to review', () => {
  const t = buildEntities({ ...base, spans: { P: { first: '2010-01-01', last: asOf }, Q: { first: '2010-01-01', last: asOf } }, symbolChanges: [{ oldSymbol: 'P', newSymbol: 'Q', date: '2020-01-01' }] });
  assert.equal(t.entities.length, 2); assert.equal(t.counts.linked, 0); assert.equal(t.review[0].kind, 'new symbol traded before the change date');
});
test('a new symbol already taken by another link is not merged and goes to review', () => {
  const t = buildEntities({ ...base, spans: { A: { first: '2010-01-01', last: '2020-01-01' }, B: { first: '2010-01-01', last: '2020-01-01' }, Q: { first: '2020-01-02', last: asOf } }, symbolChanges: [{ oldSymbol: 'A', newSymbol: 'Q', date: '2020-01-02' }, { oldSymbol: 'B', newSymbol: 'Q', date: '2020-01-03' }] });
  assert.equal(t.counts.linked, 1); assert.equal(t.review[0].kind, 'new symbol already in use');
});
test('an old symbol that keeps trading after its change date is flagged', () => {
  const t = buildEntities({ ...base, spans: { M: { first: '2010-01-01', last: asOf }, N: { first: '2020-01-02', last: asOf } }, symbolChanges: [{ oldSymbol: 'M', newSymbol: 'N', date: '2020-01-01' }] });
  assert.ok(t.review.some((r) => r.kind === 'old symbol traded after the change date'));
});
test('a symbol that stopped trading long ago is vanished; recent ones are active', () => {
  const t = buildEntities({ ...base, spans: { GONE: { first: '2010-01-01', last: '2023-07-12' }, LIVE: { first: '2010-01-01', last: asOf } }, symbolChanges: [] });
  assert.equal(t.entities.find((e) => e.id === 'GONE')?.status, 'vanished'); assert.equal(t.entities.find((e) => e.id === 'LIVE')?.status, 'active');
});
test('demerger and scheme events attach to the entity in force on the ex-date, once', () => {
  const t = buildEntities({ ...base, spans: { OLD: { first: '2015-01-01', last: '2025-10-23' }, NEW: { first: '2025-10-24', last: asOf } }, symbolChanges: [{ oldSymbol: 'OLD', newSymbol: 'NEW', date: '2025-10-24' }],
    actions: [{ symbol: 'NEW', subject: ' Demerger', exDate: '2025-10-14' }, { symbol: 'NEW', subject: 'Demerger', exDate: '2025-10-14' }, { symbol: 'NEW', subject: 'Dividend - Rs 2', exDate: '2025-01-01' }] });
  assert.equal(t.entities.length, 1); assert.equal(t.entities[0].events.length, 1); assert.equal(t.entities[0].events[0].kind, 'demerger');
});
test('event kinds: bonus-by-scheme and dividend-by-scheme are not structure events', () => {
  assert.equal(eventKind(' Demerger'), 'demerger'); assert.equal(eventKind('De-Merger'), 'demerger'); assert.equal(eventKind('Scheme Of Amalgamation'), 'scheme');
  assert.equal(eventKind('Scheme Of Arangement- Bonus - 1 Debenture For 1 Equity Share Held'), null); assert.equal(eventKind('Dividend - Rs 12.50 Per Share Pursuant To Scheme'), null); assert.equal(eventKind('Buy Back'), null);
});
const real = new URL('../data/india/entities.json', import.meta.url);
test('stored table: Tata Motors history runs TELCO to TATAMOTORS to TMPV with its 2025 demerger; Zomato became Eternal', { skip: !existsSync(real) }, () => {
  const t = JSON.parse(readFileSync(real, 'utf8'));
  const tm = t.entities.find((e: any) => e.symbols.some((u: any) => u.symbol === 'TMPV')); assert.deepEqual(tm.symbols.map((u: any) => u.symbol), ['TELCO', 'TATAMOTORS', 'TMPV']);
  assert.ok(tm.events.some((x: any) => x.kind === 'demerger' && x.date === '2025-10-14'));
  const z = t.entities.find((e: any) => e.id === 'ZOMATO'); assert.deepEqual(z.symbols.map((u: any) => u.symbol), ['ZOMATO', 'ETERNAL']);
  const ids = new Set(t.entities.map((e: any) => e.id)); assert.equal(ids.size, t.entities.length);
});
