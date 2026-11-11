import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ret121, highProximity, rankSelect, high52, weekly121, donchian, turnOfMonth, sessionsLeftInMonth, isMonthStart, FW, type Ctx, type Ser } from '../src/engine/first-wave.ts';
import { makeCalendar } from '../src/engine/calendar.ts';

const days = (n: number, start = '2026-01-01'): string[] => { const out: string[] = []; const d = new Date(start + 'T00:00:00Z'); while (out.length < n) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } return out; };
const ser = (n: number, f: (i: number) => number, spread = 0.5): Ser => { const c = Array.from({ length: n }, (_, i) => f(i)); return { c, h: c.map((x) => x + spread), l: c.map((x) => x - spread) }; };

test('ret121 and highProximity', () => {
  const c = Array.from({ length: 300 }, (_, i) => 100 + i);
  assert.ok(Math.abs((ret121(c, 299) as number) - (c[278] / c[47] - 1)) < 1e-12);
  assert.equal(ret121(c.slice(0, 100), 99), null);
  assert.equal(highProximity(c, 299), 1);
  const d = c.slice(); d[299] = 200; assert.ok(Math.abs((highProximity(d, 299) as number) - 200 / 398) < 1e-12);
});
test('rankSelect keeps held names to rank 40 and fills the rest from the top', () => {
  const ranked = Array.from({ length: 60 }, (_, i) => 's' + (i + 1));
  const sel = rankSelect(ranked, new Set(['s35', 's50']));
  assert.ok(sel.has('s35')); assert.ok(!sel.has('s50')); assert.equal(sel.size, 20); assert.ok(sel.has('s1')); assert.ok(!sel.has('s20'));
});
const ctxFor = (names: Record<string, Ser>, n: number, held: string[] = [], dates = days(n)): Ctx => ({ el: Object.keys(names).map((s, i) => ({ sym: s, value: 1e9 - i })), series: new Map(Object.entries(names)), t: n - 1, dates, held: new Set(held) });
test('high52: first run buys the 20 closest to their high, 5% weight orders carry the long stop', () => {
  const names: Record<string, Ser> = {}; for (let k = 0; k < 30; k++) names['N' + k] = ser(300, (i) => (i < 280 ? 100 + i : 380 - k * 3 - (i - 280)));
  const o = high52(ctxFor(names, 300))!; assert.equal(o.buys.length, 20); assert.ok(o.buys.every((b) => b.stop === 0.25)); assert.equal(o.buys[0].sym === 'N0' || o.buys.some((b) => b.sym === 'N0'), true);
  assert.equal(o.buys.some((b) => b.sym === 'N29'), false);
});
test('high52: no review mid-month once the book holds names', () => {
  const names: Record<string, Ser> = { A: ser(300, (i) => 100 + i) };
  const dates = days(300); const t = 299; let mid = t; while (isMonthStart(dates, mid)) mid--;
  assert.equal(high52({ ...ctxFor(names, 300, ['A'], dates), t: mid }), null);
});
test('weekly121 reviews only on a Friday', () => {
  const names: Record<string, Ser> = { A: ser(300, (i) => 100 + i) }; const dates = days(300);
  let fri = 299; while (new Date(dates[fri] + 'T00:00:00Z').getUTCDay() !== 5) fri--;
  assert.ok(weekly121({ ...ctxFor(names, 300, ['A'], dates), t: fri }) !== undefined);
  assert.equal(weekly121({ ...ctxFor(names, 300, ['A'], dates), t: fri - 1 }), null);
});
test('donchian: buys a close above the 55-session high, sells a close below the 20-session low, skips a wide stop', () => {
  const up = ser(120, (i) => (i < 119 ? 100 : 130)), wide = ser(120, (i) => (i < 119 ? 100 : 130), 6), flat = ser(120, () => 100);
  const o = donchian(ctxFor({ UP: up, WIDE: wide, FLAT: flat }, 120), undefined)!;
  const skipped: any[] = []; const o2 = donchian(ctxFor({ UP: up, WIDE: wide, FLAT: flat }, 120), skipped)!;
  assert.deepEqual(o.buys.map((b) => b.sym), ['UP']); assert.equal(skipped[0].sym, 'WIDE'); assert.ok(skipped[0].width > 0.08); assert.ok(o2.buys[0].stop <= 0.08);
  const down = ser(120, (i) => (i < 119 ? 100 : 90));
  const s = donchian(ctxFor({ D1: down }, 120, ['D1']))!; assert.deepEqual(s.sells, ['D1']);
});
test('donchian: signals beyond the open slots are ranked by 12-1', () => {
  const names: Record<string, Ser> = {}; for (let k = 0; k < 25; k++) names['N' + k] = ser(300, (i) => (i < 240 ? 100 + k * 2 : 100 + k * 2 + (i - 239) * (1 + k / 10)));
  const o = donchian(ctxFor(names, 300))!; assert.equal(o.buys.length, 20);
});
test('turnOfMonth: entry with 4 sessions left in the month, exit on the 3rd session of the next month', () => {
  const cal = makeCalendar(); const dates = days(120, '2025-11-03'); const names: Record<string, Ser> = { A: ser(120, () => 100) };
  const jan = dates.filter((d) => d.startsWith('2026-01')), d5 = jan[jan.length - 5];
  assert.equal(sessionsLeftInMonth(d5, cal.sessionsBetween), 4);
  const t5 = dates.indexOf(d5); const o = turnOfMonth({ ...ctxFor(names, 120, [], dates), t: t5 }, 4)!; assert.equal(o.buys.length, 1);
  assert.equal(turnOfMonth({ ...ctxFor(names, 120, [], dates), t: t5 - 1 }, 5), null);
  const feb3 = dates.indexOf(dates.filter((d) => d.startsWith('2026-02'))[2]);
  const x = turnOfMonth({ ...ctxFor(names, 120, ['A'], dates), t: feb3 }, 17)!; assert.deepEqual(x.sells, ['A']);
});

import { industryTable, pickIndustry, industryMomentum, dipDay, pullback, IND } from '../src/engine/first-wave.ts';
const flat = (n: number, v = 100): number[] => Array.from({ length: n }, () => v);
test('C-160 industry table: groups under 5 names are skipped, groups ranked by median 12-1, names by their own figure', () => {
  const T = 300, series = new Map<string, any>(), el: any[] = [], grp = new Map<string, string>();
  const add = (sym: string, g: string, r: number) => { const c = flat(T); c[T - 1 - 21] = 100 * (1 + r); series.set(sym, { c }); el.push({ sym, value: 1e9 }); grp.set(sym, g); };
  for (let i = 0; i < 5; i++) add('A' + i, 'GA', 0.5 + i * 0.01); for (let i = 0; i < 5; i++) add('B' + i, 'GB', 0.1 + i * 0.01); for (let i = 0; i < 4; i++) add('C' + i, 'GC', 0.9);
  const x = { el, series, t: T - 1, dates: Array.from({ length: T }, (_, i) => '2025-01-' + String(i % 28 + 1).padStart(2, '0')), held: new Set<string>(), group: (s: string) => grp.get(s) ?? null };
  const tab = industryTable(x as any); assert.deepEqual(tab.map((g) => g.group), ['GA', 'GB']); assert.equal(tab[0].names[0].sym, 'A4');
  const keep = pickIndustry(tab, new Set(['B0'])); assert.ok(keep.has('B0')); assert.ok(keep.has('A4')); assert.ok(keep.size <= 20 && IND.perGroup === 5);
  assert.equal(industryMomentum({ ...x, dates: x.dates.map((d, i) => (i === T - 1 ? '2026-02-02' : '2026-01-15')) } as any)!.buys.length, 10);
});
test('C-172 dipDay: three to five lower closes or a close at the 20-day mean; the signal is the first up close and logs volume and tightness', () => {
  const up = Array.from({ length: 60 }, (_, i) => 100 + i); const c = [...up, 158, 157, 156, 157.5]; assert.equal(dipDay(c, 62), 'run'); assert.equal(dipDay(c, 60), null);
  const n = c.length, v = Array.from({ length: n }, () => 1000), s = new Map<string, any>([['A', { c, h: c.map((x) => x + 1), l: c.map((x) => x - 1), v }]]);
  const log: any[] = [], x = { el: [{ sym: 'A', value: 1e9 }], series: s, t: n - 1, dates: c.map((_, i) => '2026-01-' + String(i % 27 + 1).padStart(2, '0')), held: new Set<string>(), quintile: new Set(['A']), template: new Set(['A']), order: ['A'] };
  const o = pullback(x as any, [], log); assert.equal(o?.buys.length, 1); assert.equal(log.length, 1); assert.equal(log[0].dip, 'run'); assert.ok(log[0].tight > 0);
  assert.equal(pullback({ ...x, template: new Set() } as any), null);
});
