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
