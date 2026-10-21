import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from '../src/pm/resolver.ts';
import { replay } from '../src/pm/ledger.ts';
import type { Trade } from '../src/pm/reader.ts';
const T = (side: 'buy' | 'sell', key: string, date: string, qty: number, price: number): Trade => ({ instrument: key, isin: key, side, qty, price, value: qty * price, date, time: '', exchange: 'NSE', orderId: '', tradeId: '', kind: 'stock' });
const none = { facts: [], candidates: [] };

test('split: a sell of post-split quantity is a break without the record, balanced with it, cost spread, holding period unchanged', () => {
  const trades = [T('buy', 'SPL', '2022-01-10', 100, 1000), T('sell', 'SPL', '2024-03-01', 500, 250)];
  assert.equal(replay(trades).breaks.length, 1);
  const r = resolve(trades, { facts: [{ type: 'split', key: 'SPL', ratio: 10, date: '2023-06-01', source: 'NSE circular' }], candidates: [] });
  assert.equal(r.replay.breaks.length, 0);
  assert.equal(r.replay.realised[0].cost, 100000 / 1000 * 500); assert.equal(r.replay.realised[0].long, true); assert.equal(r.replay.open[0].qty, 500);
});
test('bonus (bonus): extra shares have nil cost, holding period from allotment', () => {
  const trades = [T('buy', 'BON', '2023-05-09', 120, 80), T('sell', 'BON', '2025-09-22', 180, 130)];
  const r = resolve(trades, { facts: [{ type: 'bonus', key: 'BON', num: 1, den: 2, date: '2024-03-14', source: 'NSE announcement' }], candidates: [] });
  assert.equal(r.replay.breaks.length, 0);
  const bonus = r.replay.realised.find((x) => x.buyDate === '2024-03-14')!;
  assert.equal(bonus.qty, 60); assert.equal(bonus.cost, 0); assert.equal(bonus.long, true);
});
test('demerger (parent and child): child lots take the published cost percent and the parent purchase dates; parent cost falls by the same amount', () => {
  const trades = [T('buy', 'DMP', '2022-10-12', 140, 250), T('buy', 'DMP', '2022-11-18', 30, 280), T('sell', 'DMPC', '2025-04-03', 17, 190)];
  assert.equal(replay(trades).breaks.length, 1);
  const r = resolve(trades, { facts: [{ type: 'demerger', parent: 'DMP', child: 'DMPC', ratio: 0.1, costPct: 0.12, date: '2024-12-01', source: 'company filing to NSE' }], candidates: [] });
  assert.equal(r.replay.breaks.length, 0);
  const sold = r.replay.realised.filter((x) => x.key === 'DMPC');
  assert.equal(sold.reduce((a, x) => a + x.qty, 0), 17); assert.equal(sold[0].buyDate, '2022-10-12'); assert.equal(sold[0].long, true);
  const childCost = (140 * 250 + 30 * 280) * 0.12; const parentOpen = r.replay.open.filter((l) => l.key === 'DMP').reduce((a, l) => a + l.qty * l.unitCost, 0);
  assert.ok(Math.abs(parentOpen - (140 * 250 + 30 * 280) * (1 - 0.12)) < 1e-6);
  const allChildCost = r.replay.realised.filter((x) => x.key === 'DMPC').reduce((a, x) => a + x.cost, 0) + r.replay.open.filter((l) => l.key === 'DMPC').reduce((a, l) => a + l.qty * l.unitCost, 0);
  assert.ok(Math.abs(allChildCost - childCost) < 1e-6);
});
test('IPO allotment: applied when the first trade is near the listing, a whole number of lots, and the record is sourced', () => {
  const trades = [T('sell', 'IPO1', '2025-03-17', 15, 700)];
  const cand = { kind: 'ipo' as const, key: 'IPO1', date: '2025-03-11', unitCost: 640, lotSize: 7, windowDays: 14, source: 'NSE IPO record' };
  const none15 = resolve(trades, { facts: [], candidates: [{ ...cand, lotSize: 7 }] });
  assert.equal(none15.applied.length, 0); assert.equal(none15.unexplained.length, 1);   // 15 is not a multiple of 7: does not close, so not applied
  const ok = resolve(trades, { facts: [], candidates: [{ ...cand, lotSize: 5 }] });
  assert.equal(ok.applied.length, 1); assert.equal(ok.unexplained.length, 0); assert.equal(ok.replay.realised[0].cost, 15 * 640);
});
test('an estimated record is only proposed, a record dated after the first trade is ignored, and the unexplained case stays in the queue', () => {
  const t1 = [T('sell', 'EST', '2025-03-17', 10, 100)];
  const est = resolve(t1, { facts: [], candidates: [{ kind: 'ipo', key: 'EST', date: '2025-03-14', unitCost: 90, windowDays: 14, source: 'first-day price split', estimate: true }] });
  assert.equal(est.applied.length, 0); assert.equal(est.proposed.length, 1);
  const t2 = [T('buy', 'EST', '2025-02-01', 5, 100), T('sell', 'EST', '2025-03-17', 15, 100)]; // a record dated after the first trade cannot explain it
  const far = resolve(t2, { facts: [], candidates: [{ kind: 'ipo', key: 'EST', date: '2025-06-01', unitCost: 90, windowDays: 14, source: 'x' }] });
  assert.equal(far.applied.length + far.proposed.length, 0); assert.equal(far.unexplained.length, 1);
  const unex = resolve([T('buy', 'UNX', '2022-01-01', 100, 50), T('sell', 'UNX', '2024-01-01', 130, 200)], none);
  assert.equal(unex.unexplained.length, 1); assert.equal(unex.unexplained[0].qty, 30); assert.equal(unex.replay.realised.reduce((a, x) => a + x.qty, 0), 100);
});
test('a typed override is applied like a fact and never asked again', () => {
  const trades = [T('sell', 'UNX', '2024-01-01', 30, 200)];
  const r = resolve(trades, none, [{ type: 'grant', key: 'UNX', date: '2023-01-01', qty: 30, unitCost: 55, source: 'owner, allotment record' }]);
  assert.equal(r.unexplained.length, 0); assert.equal(r.replay.breaks.length, 0);
});
test('rename moves lots to the new key so an ISIN or symbol change does not break the chain', () => {
  const trades = [T('buy', 'OLD', '2022-01-01', 10, 100), T('sell', 'NEW', '2024-01-01', 10, 200)];
  const r = resolve(trades, { facts: [{ type: 'rename', from: 'OLD', to: 'NEW', date: '2023-01-01', source: 'NSE symbol change' }], candidates: [] });
  assert.equal(r.replay.breaks.length, 0); assert.equal(r.replay.realised[0].buyDate, '2022-01-01');
});

test('an IPO shortfall spread over two sells is one allotment of one lot, applied even long after listing when no purchase exists', () => {
  const trades = [T('sell', 'IPX', '2024-02-08', 5, 410), T('sell', 'IPX', '2024-02-22', 10, 415)];
  const r = resolve(trades, { facts: [], candidates: [{ kind: 'ipo', key: 'IPX', date: '2022-09-14', unitCost: 520, lotSize: 15, windowDays: 14, source: 'IPO record' }] });
  assert.equal(r.applied.length, 1); assert.equal(r.replay.breaks.length, 0); assert.equal(r.replay.realised.reduce((a, x) => a + x.qty, 0), 15);
});
test('a rights entitlement symbol whose parent was held is proposed at nil cost, not applied silently', () => {
  const trades = [T('buy', 'PARENT', '2024-02-12', 100, 17), { ...T('sell', 'PRT-RE', '2024-06-18', 8, 5.25), instrument: 'PRT-RE', symbol: 'PRT-RE' }];
  trades[0] = { ...trades[0], instrument: 'PRT', symbol: 'PRT' };
  const r = resolve(trades, none);
  assert.equal(r.proposed.length, 1); assert.equal(r.applied.length, 0); assert.equal(r.replay.realised[0].cost, 0);
});

test('swap merger with fractions paid in cash: whole shares on the total, cost carried over in full, holding period inherited', () => {
  const trades = [T('buy', 'MRG', '2022-03-09', 10, 37), T('buy', 'MRG', '2022-03-09', 25, 37), T('buy', 'MRG', '2022-03-09', 40, 37), T('sell', 'MRGN', '2024-09-18', 5, 210)];
  const r = resolve(trades, { facts: [{ type: 'demerger', parent: 'MRG', child: 'MRGN', ratio: 1 / 15, costPct: 1, floorTotal: true, date: '2022-06-20', source: 'merger scheme' }], candidates: [] });
  assert.equal(r.replay.breaks.length, 0); assert.equal(r.replay.open.filter((l) => l.key === 'MRG').length, 0);
  assert.equal(r.replay.realised.reduce((a, x) => a + x.qty, 0), 5); assert.equal(r.replay.realised[0].long, true);
  const cost = r.replay.realised.reduce((a, x) => a + x.cost, 0) + r.replay.open.filter((l) => l.key === 'MRGN').reduce((a, l) => a + l.qty * l.unitCost, 0);
  assert.ok(cost > 0 && cost <= 75 * 37 + 1e-6);
});

test('owner decisions: confirm applies the estimate, a typed price changes the cost, reject leaves the sells unexplained', () => {
  const trades = [T('sell', 'EST', '2025-03-17', 10, 100)];
  const cat = { facts: [], candidates: [{ kind: 'ipo' as const, key: 'EST', date: '2025-03-14', unitCost: 90, windowDays: 14, source: 'first-day price split', estimate: true }] };
  const conf = resolve(trades, cat, [], 365, { EST: { action: 'confirm' } });
  assert.equal(conf.proposed.length, 0); assert.equal(conf.applied.length, 1); assert.equal(conf.replay.realised[0].cost, 900);
  const priced = resolve(trades, cat, [], 365, { EST: { action: 'price', unitCost: 95 } });
  assert.equal(priced.applied.length, 1); assert.equal(priced.replay.realised[0].cost, 950); assert.match(priced.applied[0].why, /price entered by the owner/);
  const rej = resolve(trades, cat, [], 365, { EST: { action: 'reject' } });
  assert.equal(rej.proposed.length + rej.applied.length, 0); assert.equal(rej.unexplained.length, 1);
  const rights = resolve([T('buy', 'ABC', '2024-01-01', 10, 100), T('sell', 'ABC-RE', '2024-05-01', 4, 20)], none, [], 365, { 'ABC-RE': { action: 'confirm' } });
  assert.equal(rights.proposed.length, 0); assert.equal(rights.applied.length, 1);
});
