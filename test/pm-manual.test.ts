import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanManual, makeManual, reconcile, tradesOf, type ManualTrade } from '../src/pm/manual.ts';
import { runPipeline } from '../src/pm/pipeline.ts';
import { openRiskOf } from '../src/pm/swingorders.ts';
import type { Trade } from '../src/pm/reader.ts';

const J = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const data: any = { feed: [], demergers: [], ipos: [], amfi: [], fundOverrides: [], charges: J('data/rules/charges.json'), taxRules: J('data/rules/tax.json'), divRules: J('data/rules/dividend.json'), prices: { ABC: 120, NEWCO: 55 }, pricesAsOf: '2026-10-12' };
const t = (side: 'buy' | 'sell', qty: number, price: number, date: string, id: string, extra: any = {}): Trade => ({ instrument: 'ABC LTD', symbol: 'ABC', isin: 'INE000A01011', side, qty, price, value: qty * price, date, time: '10:00', exchange: 'NSE', orderId: id, tradeId: id, kind: 'stock', ...extra });
const man = (o: Partial<ManualTrade> = {}): ManualTrade => ({ id: 'm1', symbol: 'ABC', instrument: 'ABC LTD', isin: 'INE000A01011', side: 'buy', qty: 10, price: 100, date: '2026-10-20', addedAt: '2026-10-20T10:00:00Z', ...o });

test('cleanManual keeps only the whitelisted fields and rejects bad entries', () => {
  const ok = cleanManual([{ ...man({ stop: 90, fromOrder: true }), extra: 'x', pan: 'ABCDE1234F' }]) as ManualTrade[];
  assert.deepEqual(Object.keys(ok[0]).sort(), ['addedAt', 'date', 'fromOrder', 'id', 'instrument', 'isin', 'price', 'qty', 'side', 'stop', 'symbol']);
  for (const bad of [{ ...man(), qty: 0 }, { ...man(), side: 'hold' }, { ...man(), date: '20/10/2026' }, { ...man(), price: -1 }, { ...man(), id: 'a b' }, { ...man(), symbol: '' }]) assert.equal(typeof cleanManual([bad]), 'string');
  assert.equal(typeof cleanManual('x'), 'string'); assert.equal(typeof cleanManual(Array.from({ length: 201 }, () => man())), 'string');
});
test('makeManual copies the name and ISIN from the account\'s own trades, else uses the company name, else the symbol', () => {
  const a = makeManual({ symbol: 'abc', side: 'buy', qty: 5, price: 101, date: '2026-10-21' }, [t('buy', 1, 1, '2026-01-01', '1')]);
  assert.equal(a.symbol, 'ABC'); assert.equal(a.instrument, 'ABC LTD'); assert.equal(a.isin, 'INE000A01011');
  const b = makeManual({ symbol: 'NEWCO', side: 'buy', qty: 5, price: 55, date: '2026-10-21', stop: 50 }, [], { NEWCO: 'New Co Limited' });
  assert.equal(b.instrument, 'New Co Limited'); assert.equal(b.isin, ''); assert.equal(b.stop, 50);
  assert.equal(makeManual({ symbol: 'ZZZ', side: 'sell', qty: 1, price: 1, date: '2026-10-21' }, []).instrument, 'ZZZ');
});
test('a hand-added trade after the last upload is counted, with its stop', () => {
  const r = reconcile([t('buy', 10, 100, '2026-09-01', '1')], [man({ stop: 90 })]);
  assert.equal(r.effective.length, 2); assert.equal(r.notes[0].status, 'pending'); assert.deepEqual(r.stops, { 'ABC LTD': 90 }); assert.equal(r.lastUploadDate, '2026-09-01');
  assert.equal(reconcile([t('buy', 10, 100, '2026-09-01', '1')], []).effective.length, 1);
});
test('upload matches the hand-added trade: dropped, a price difference over 0.5% is listed', () => {
  const same = reconcile([t('buy', 10, 100.2, '2026-10-20', 'b1')], [man()]);
  assert.equal(same.effective.length, 1); assert.equal(same.notes[0].status, 'matched');
  const off = reconcile([t('buy', 10, 103, '2026-10-20', 'b1')], [man()]);
  assert.equal(off.effective.length, 1); assert.equal(off.notes[0].status, 'difference'); assert.match(off.notes[0].text, /You typed 100\.00 a share, the broker has 103\.00/);
  const next = reconcile([t('buy', 10, 100, '2026-10-21', 'b1')], [man()]);   // the broker dated it a day later
  assert.equal(next.notes[0].status, 'matched');
});
test('a different quantity is a difference and the broker\'s figure wins; split fills add up', () => {
  const d = reconcile([t('buy', 8, 100, '2026-10-20', 'b1')], [man()]);
  assert.equal(d.notes[0].status, 'difference'); assert.match(d.notes[0].text, /typed 10, the broker shows 8/); assert.equal(d.effective.length, 1);
  const split = reconcile([t('buy', 6, 100, '2026-10-20', 'b1'), t('buy', 4, 100, '2026-10-20', 'b2')], [man()]);
  assert.equal(split.notes[0].status, 'matched'); assert.equal(split.effective.length, 2);
});
test('an upload that covers the date and has no such trade leaves it out and lists it to check', () => {
  const r = reconcile([t('buy', 10, 100, '2026-10-25', '1', { symbol: 'XYZ', instrument: 'XYZ LTD', isin: 'INE111' })], [man()]);
  assert.equal(r.notes[0].status, 'check'); assert.match(r.notes[0].text, /has no such trade/); assert.equal(r.effective.length, 1);
});
test('the company name in the broker file matches the symbol through the names file; other sides and stocks do not match', () => {
  const up = t('buy', 10, 100, '2026-10-20', 'b1', { instrument: 'Syrma SGS Technology Limited', symbol: undefined, isin: 'INE-SYRMA' });
  assert.equal(reconcile([up], [man({ symbol: 'SYRMA', instrument: 'SYRMA', isin: '' })], { SYRMA: 'Syrma SGS Technology Ltd' }).notes[0].status, 'matched');
  assert.equal(reconcile([up], [man({ symbol: 'SYRMA', instrument: 'SYRMA', isin: '' })]).notes[0].status, 'check');
  assert.equal(reconcile([t('sell', 10, 100, '2026-10-20', 'b1')], [man()]).notes[0].status, 'check');
});
test('pipeline: a hand-added buy is an open lot, and its stop counts as open risk once the swing book holds it', () => {
  const up = [t('buy', 10, 100, '2026-09-01', '1')], r = tradesOf({ trades: up, manual: [man({ symbol: 'NEWCO', instrument: 'NEWCO', isin: '', qty: 20, price: 50, date: '2026-10-10', stop: 45 })] });
  const rep = runPipeline([r.effective], 'zerodha', data);
  assert.equal(rep.counts.openLots, 2); assert.ok(rep.holdings.some((h) => h.symbol === 'NEWCO' && h.qty === 20));
  assert.equal(runPipeline([up], 'zerodha', data).counts.openLots, 1);
  const lots = [{ name: 'NEWCO', book: 'Swing', qty: 20, unitCost: 50 }];
  assert.equal(openRiskOf(lots, r.stops).openRisk, 20 * 5);
});
test('a hand-added sell reduces the holding', () => {
  const r = tradesOf({ trades: [t('buy', 10, 100, '2026-09-01', '1')], manual: [man({ side: 'sell', qty: 4, price: 130, date: '2026-10-10' })] });
  const rep = runPipeline([r.effective], 'zerodha', data);
  assert.equal(rep.holdings.find((h) => h.symbol === 'ABC')!.qty, 6);
});

import { saveAccount, cleanManualPatch, applyManual, pathFor } from '../functions/_lib/store.ts';
const fakeGithub = () => {
  const files = new Map<string, { sha: number; text: string }>(); let n = 0;
  const fetchFn = (async (url: string, init: any = {}) => {
    const p = decodeURIComponent(new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
    if (!init.method || init.method === 'GET') { const f = files.get(p); return f ? new Response(JSON.stringify({ sha: String(f.sha), content: Buffer.from(f.text).toString('base64') }), { status: 200 }) : new Response('{}', { status: 404 }); }
    const body = JSON.parse(init.body); files.set(p, { sha: ++n, text: Buffer.from(body.content, 'base64').toString() }); return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { files, fetchFn, read: (label: string) => JSON.parse(files.get(pathFor(label))!.text) };
};
const env = { GITHUB_TOKEN: 'x', REPO: 'o/r' };
test('cleanManualPatch and applyManual: add replaces by id, remove deletes, bad input is refused', () => {
  assert.equal(cleanManualPatch(undefined), undefined); assert.equal(typeof cleanManualPatch({ add: [{ ...man(), qty: 0 }] }), 'string'); assert.equal(typeof cleanManualPatch({ remove: ['a b'] }), 'string');
  const a = man({ id: 'a' }), b = man({ id: 'b' }), p = cleanManualPatch({ add: [{ ...b, qty: 99 }, man({ id: 'c' })], remove: ['a'] }) as any;
  assert.deepEqual(applyManual([a, b], p).map((m) => m.id + ':' + m.qty), ['b:99', 'c:10']);
});
test('save: a hand-added trade is stored with the account; a settings-only save keeps the last-upload date; an upload moves it; a move does not', async () => {
  const g = fakeGithub();
  await saveAccount(env, 'Main', 'zerodha', [t('buy', 10, 100, '2026-09-01', '1')], g.fetchFn, new Date('2026-09-02T10:00:00Z'));
  assert.equal(g.read('Main').uploadedAt, '2026-09-02T10:00:00.000Z'); assert.equal(g.read('Main').manual, undefined);
  await saveAccount(env, 'Main', 'zerodha', [], g.fetchFn, new Date('2026-10-20T10:00:00Z'), undefined, {}, [], undefined, { add: [man()] });
  const acc = g.read('Main'); assert.equal(acc.savedAt, '2026-10-20T10:00:00.000Z'); assert.equal(acc.uploadedAt, '2026-09-02T10:00:00.000Z', 'a settings or manual save is not an upload'); assert.equal(acc.manual.length, 1); assert.equal(acc.trades.length, 1);
  await saveAccount(env, 'Main', 'zerodha', [t('buy', 5, 100, '2026-10-21', '2')], g.fetchFn, new Date('2026-11-01T10:00:00Z'));
  assert.equal(g.read('Main').uploadedAt, '2026-11-01T10:00:00.000Z'); assert.equal(g.read('Main').manual.length, 1, 'the entry stays until the owner removes it; matching is worked out on every read');
  await saveAccount(env, 'Main', 'zerodha', [], g.fetchFn, new Date('2026-11-02T10:00:00Z'), undefined, {}, [], undefined, { remove: ['m1'] });
  assert.equal(g.read('Main').manual, undefined);
  await saveAccount(env, 'Other', 'zerodha', [t('buy', 1, 1, '2026-09-01', '3')], g.fetchFn, new Date('2026-09-02T10:00:00Z'));
  await saveAccount(env, 'Other', 'zerodha', [t('buy', 1, 1, '2026-10-01', '4')], g.fetchFn, new Date('2026-11-05T10:00:00Z'), undefined, {}, [], undefined, undefined, false);
  assert.equal(g.read('Other').uploadedAt, '2026-09-02T10:00:00.000Z');   // a first save still gets a date; the flag only stops a later move from refreshing it
});
