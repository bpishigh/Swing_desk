import test from 'node:test';
import assert from 'node:assert/strict';
import { normCategory, scoreAll, cagr, replaceCandidate, SETTINGS } from '../src/pm/fundscore.ts';

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const series = (growth: number, years = 6): Record<string, number> => { const o: Record<string, number> = {}; const end = Date.parse('2026-10-16T00:00:00Z'); const days = Math.round(365 * years); for (let i = days; i >= 0; i--) o[ymd(new Date(end - i * 86400000))] = 100 * Math.pow(1 + growth, (days - i) / 365); return o; };
test('categories fold to one key', () => {
  assert.equal(normCategory('Equity Scheme - Mid Cap Fund'), normCategory('Equity Schemes - Mid Cap Fund'));
  assert.equal(normCategory('Equity Schemes - ELSS- Tax Saver Fund'), 'ELSS');
});
test('cagr matches a constant growth rate and refuses a short history', () => {
  const nav = series(0.12); const d = Object.keys(nav).sort();
  assert.ok(Math.abs(cagr(d, nav, '2026-10-16', 3)! - 12) < 0.2);
  const young = series(0.12, 2); assert.equal(cagr(Object.keys(young).sort(), young, '2026-10-16', 5), null);
});
test('ranks a category by score and bands the ends', () => {
  const schemes = [], map = new Map<string, Record<string, number>>();
  for (let i = 0; i < 10; i++) { schemes.push({ code: 'C' + i, isin: 'I' + i, name: 'Fund ' + i, category: 'Equity Scheme - Mid Cap Fund' }); map.set('C' + i, series(0.08 + i * 0.01)); }
  const r = scoreAll(schemes, map, '2026-10-16');
  const top = r.find((x) => x.code === 'C9')!, bot = r.find((x) => x.code === 'C0')!;
  assert.equal(top.rank, 1); assert.equal(top.band, 'Strong'); assert.equal(bot.rank, 10); assert.equal(bot.band, 'Weak'); assert.ok(top.score! > bot.score!);
});
test('too few peers is not ranked', () => {
  const map = new Map([['A', series(0.1)]]); const r = scoreAll([{ code: 'A', isin: 'x', name: 'A', category: 'Equity Scheme - Mid Cap Fund' }], map, '2026-10-16');
  assert.equal(r[0].score, null); assert.match(r[0].note!, /need 8/);
});
test('replace only after three Weak months in a row', () => {
  assert.equal(replaceCandidate({ '2026-08': { A: 'Weak' }, '2026-09': { A: 'Weak' } }, 'A'), false);
  assert.equal(replaceCandidate({ '2026-08': { A: 'Weak' }, '2026-09': { A: 'Weak' }, '2026-10': { A: 'Weak' } }, 'A'), true);
  assert.equal(SETTINGS.weakMonthsToReplace, 3);
});
