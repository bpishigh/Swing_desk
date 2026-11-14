import test from 'node:test';
import assert from 'node:assert/strict';
import { magicRanked, LIQUID_BASIS } from '../src/engine/batch-b.ts';
import type { BCtx } from '../src/engine/batch-a.ts';

const mk = (o: Partial<{ ebit: number; ev: number; roc: number; fin: boolean; basis: string; ind: string }>) => ({ financial: o.fin ?? false, ttm: { operatingEbit: o.ebit ?? 100 }, enterpriseValue: o.ev ?? 1000, returnOnCapital: o.roc ?? 0.2, bs: { liquidBasis: o.basis ?? LIQUID_BASIS } }) as never;
test('magic formula: ranks on earnings yield and return on capital, sum lowest first', () => {
  const fund = { A: mk({ ebit: 100, ev: 1000, roc: 0.10 }), B: mk({ ebit: 100, ev: 2000, roc: 0.40 }), C: mk({ ebit: 100, ev: 500, roc: 0.05 }), D: mk({ ebit: 100, ev: 1500, roc: 0.30 }) } as Record<string, never>;
  const el = ['A', 'B', 'C', 'D'].map((sym, i) => ({ sym, value: 100 - i }));
  const r = magicRanked({ el, fund, group: () => null } as unknown as BCtx);
  // yield order C, A, D, B (ranks 1..4); roc order B, D, A, C: sums A 2+3=5, B 4+1=5, C 1+4=5, D 3+2=5: all tie, so higher traded value first
  assert.deepEqual(r.map((x) => x.sym), ['A', 'B', 'C', 'D']); assert.ok(r.every((x) => x.s === 5));
});
test('magic formula: skips financials, Power, cash-only balance sheets, non-positive EBIT or enterprise value', () => {
  const fund = { OK: mk({}), FIN: mk({ fin: true }), PWR: mk({}), OLD: mk({ basis: 'cash only' }), NEG: mk({ ebit: -5 }), EV0: mk({ ev: -10 }), NOROC: mk({ roc: 0 }) } as Record<string, never>;
  const el = Object.keys(fund).map((sym) => ({ sym, value: 1 }));
  const r = magicRanked({ el, fund, group: (s: string) => (s === 'PWR' ? 'Power' : null) } as unknown as BCtx);
  assert.deepEqual(r.map((x) => x.sym), ['OK']);
});

import { piotroskiScore, piotroskiRanked, fullQualityRanked } from '../src/engine/batch-b.ts';
const blk = (o: Record<string, number | null>) => ({ end: '2026-03-31', assets: 1000, equity: 400, borrowings: 200, currentAssets: 500, currentLiabilities: 300, revenue: 800, ebit: 100, pat: 60, cfo: 90, ...o });
const fy = (cur: Record<string, number | null>, prev: Record<string, number | null>, shareRatio: number | null = 1) => ({ financial: false, marketCap: 500, fy: { cur: blk(cur), prev: blk({ assets: 1000, pat: 40, borrowings: 250, currentAssets: 450, revenue: 700, ebit: 70, cfo: 50, ...prev }), shareRatio } }) as never;
test('piotroski: all nine tests pass for an improving name', () => {
  const r = piotroskiScore(fy({}, {})); assert.equal(r?.f, 9);
});
test('piotroski: each failure costs a point; missing figure or shares means not scored', () => {
  assert.equal(piotroskiScore(fy({ cfo: 50 }, {}))?.f, 8);        // operating cash flow below profit fails test 4 only
  assert.equal(piotroskiScore(fy({}, {}, 1.05))?.f, 8);           // dilution above 2%
  assert.equal(piotroskiScore(fy({ pat: null }, {})), null);
  assert.equal(piotroskiScore(fy({}, {}, null)), null);
});
test('piotroski: cheapest 30% by book-to-market, then score 8 or more, best first', () => {
  const mkf = (bm: number, good: boolean) => ({ financial: false, marketCap: 1000, fy: { ...(fy({ equity: bm * 1000 }, good ? {} : { assets: 1000, pat: 100, cfo: 200, borrowings: 100, currentAssets: 900, revenue: 900, ebit: 200 }) as never as { fy: unknown }).fy as object } }) as never;
  const fund: Record<string, never> = {}; const syms = 'ABCDEFGHIJ'.split('');
  syms.forEach((s, i) => { fund[s] = mkf(2 - i * 0.1, i !== 1); });   // A highest book-to-market; B is poor
  const el = syms.map((sym) => ({ sym, value: 1 }));
  const r = piotroskiRanked({ el, fund, group: () => null } as unknown as BCtx);
  assert.deepEqual(r.map((x) => x.sym), ['A', 'C']);   // pool = top 3 (A, B, C); B scores below 8
});
test('full quality: needs the liquid-investment balance sheet and positive EBIT', () => {
  const x = { financial: false, bs: { liquidBasis: 'cash only', assets: 1 }, ttm: { operatingEbit: 5 }, netDebt: 1, returnOnCapital: 0.1, cashFlowFy: [{ cfo: 1 }], quarterlyEbitMargin: [], margin: {}, growth: {} };
  const fund = { X: x } as unknown as Record<string, never>;
  assert.deepEqual(fullQualityRanked({ el: [{ sym: 'X', value: 1 }], fund, group: () => null } as unknown as BCtx), []);
});
