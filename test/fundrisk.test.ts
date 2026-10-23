import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRisk, riskStats, debtGroup, intlGroup } from '../src/pm/fundrisk.ts';

function nav(drift: number, noise: number, seed: number, crash?: { on: string; by: number }) {
  const o: Record<string, number> = {}; let v = 10, s = seed; const d = new Date('2020-01-01T00:00:00Z');
  while (d.toISOString().slice(0, 10) <= '2026-10-20') {
    const k = d.toISOString().slice(0, 10), w = d.getUTCDay();
    if (w !== 0 && w !== 6) { s = (s * 1103515245 + 12345) % 2147483648; v *= 1 + drift + (s / 2147483648 - 0.5) * noise; if (crash && k === crash.on) v *= crash.by; o[k] = v; }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return o;
}
test('riskStats: a one-day 10% fall shows as the worst day and the worst fall', () => {
  const r = riskStats(nav(0.0002, 0.002, 7, { on: '2025-03-12', by: 0.9 }), '2026-10-20')!;
  assert.ok(r.wd < -9 && r.dd < -9, JSON.stringify(r));
  assert.equal(riskStats(nav(0.0002, 0.002, 7), '2019-12-01'), null);
});
test('a group below the minimum is listed as not ranked; a full group gets bands, ranks and a flag on the fund with the crash', () => {
  const schemes = Array.from({ length: 8 }, (_, i) => ({ code: 'D' + i, isin: '', name: 'Debt ' + i, category: 'Income/Debt Oriented Schemes - Short Term Fund' }));
  const series = new Map(schemes.map((s, i) => [s.code, nav(0.0001 + i * 0.00002, 0.001, i + 1, i === 0 ? { on: '2025-03-12', by: 0.97 } : undefined)]));
  const ter = new Map(schemes.map((s, i) => [s.code, 0.3 + i * 0.1]));
  const out = scoreRisk(schemes, series, '2026-10-20', (s) => debtGroup(s.category), ter, () => 5, () => true);
  assert.equal(out.length, 8);
  assert.ok(out.every((x) => x.band && x.score !== null && x.rank));
  assert.match(out.find((x) => x.code === 'D0')!.flag ?? '', /worst single day/);
  assert.ok(out.find((x) => x.code === 'D7')!.rank! < out.find((x) => x.code === 'D0')!.rank!);
  const few = scoreRisk(schemes.slice(0, 3), series, '2026-10-20', (s) => debtGroup(s.category), ter, () => 5);
  assert.ok(few.every((x) => x.band === null && /not ranked/.test(x.note!)));
});
test('groups: debt categories map to a peer group; index, ETF and fixed term are skipped; overseas funds group by what they hold', () => {
  assert.equal(debtGroup('Income/Debt Oriented Schemes - Liquid Fund'), 'Liquid');
  assert.equal(debtGroup('Debt Scheme - Banking and PSU Fund'), 'Banking and PSU');
  assert.equal(debtGroup('Index Funds - Debt Funds'), null);
  assert.equal(debtGroup('Equity Scheme - Mid Cap Fund'), null);
  assert.equal(intlGroup('Edelweiss US Technology Equity FoF Direct Growth', 'Other Scheme - FoF Overseas'), 'Other US');
  assert.equal(intlGroup('Edelweiss Europe Dynamic Equity Offshore Fund', 'Other Scheme - FoF Overseas'), 'Europe');
  assert.equal(intlGroup('Motilal Oswal Nasdaq 100 FoF', 'Other Scheme - FoF Overseas'), 'Nasdaq 100 and US tech giants');
  assert.equal(intlGroup('Axis Small Cap Fund', 'Equity Scheme - Small Cap Fund'), null);
});
