import test from 'node:test';
import assert from 'node:assert/strict';
import { allFundsTilt, AT, type Member } from '../src/pm/alltilt.ts';

const world = (drifts: Record<string, [number, number, string, string]>) => {   // group -> [drift, noise, class, type]
  const members: Member[] = [], series = new Map<string, Record<string, number>>(); let s = 5; const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5);
  for (const [g, [drift, noise, cls, type]] of Object.entries(drifts)) for (let k = 0; k < 6; k++) { const code = `${g}${k}`, nav: Record<string, number> = {}; let v = 10; for (let d = new Date('2008-01-01T00:00:00Z'); d <= new Date('2026-10-20T00:00:00Z'); d = new Date(d.getTime() + 86400000)) { if (d.getUTCDay() % 6 === 0) continue; v *= 1 + drift + noise * rnd(); nav[d.toISOString().slice(0, 10)] = v; } series.set(code, nav); members.push({ code, group: g, cls, type }); }
  return { members, series };
};
const W = { index: 0.4, debt: 0.4, gold: 0.2 };
test('C-100: a group that keeps out-earning per unit of risk is picked every year, counted by type, and beats a flat preset', () => {
  const w = world({ 'debt:Liquid': [0.00015, 0.0003, 'liquid', 'debt'], 'idx:Nifty 50': [0.0004, 0.006, 'index', 'idx'], 'idx:Midcap': [0.0004, 0.006, 'index', 'idx'], 'debt:Short': [0.00025, 0.0005, 'debt', 'debt'], 'gold:Gold': [0.0003, 0.007, 'gold', 'idx'], 'mf:Star': [0.0012, 0.004, 'active_equity_fund', 'mf'], 'mf:Dull': [0.0002, 0.008, 'active_equity_fund', 'mf'] });
  const r = allFundsTilt(w.members, w.series, W, { ...AT, firstYear: 2013 }), r2 = allFundsTilt(w.members, w.series, W, { ...AT, firstYear: 2013 });
  assert.deepEqual(r, r2); assert.ok(r.counted >= 10);
  assert.ok(r.years.every((y) => y.picked.includes('mf:Star')));
  assert.ok((r.pickedByType.mf ?? 0) >= r.counted); assert.ok(r.parts.vsPreset);
});
test('C-100: without a liquid group or enough groups no year counts and nothing passes', () => {
  const w = world({ 'idx:A': [0.0004, 0.006, 'index', 'idx'], 'mf:B': [0.0006, 0.006, 'active_equity_fund', 'mf'] });
  const r = allFundsTilt(w.members, w.series, W); assert.equal(r.counted, 0); assert.equal(r.pass, false);
});
