import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryRotation, CR } from '../src/pm/catrotation.ts';

// synthetic world: Mid Cap funds steadily out-earn the rest with the same volatility, so the tilt must pick them and beat the mix
const mk = (cat: string, drift: number, n: number, seed: number) => {
  const sch: { code: string; isin: string; name: string; category: string }[] = [], ser = new Map<string, Record<string, number>>(); let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5);
  for (let k = 0; k < n; k++) { const code = `${cat}${k}`, nav: Record<string, number> = {}; let v = 10; for (let d = new Date('2008-01-01T00:00:00Z'); d <= new Date('2026-10-20T00:00:00Z'); d = new Date(d.getTime() + 86400000)) { if (d.getUTCDay() % 6 === 0) continue; v *= 1 + drift + 0.004 * rnd(); nav[d.toISOString().slice(0, 10)] = v; } ser.set(code, nav); sch.push({ code, isin: code, name: code, category: `Equity Scheme - ${cat} Fund` }); }
  return { sch, ser };
};
test('C-99: a category that keeps out-earning on a risk-adjusted basis is picked and beats the fixed mix; the result is deterministic', () => {
  const cats: [string, number][] = [['Large Cap', 0.0003], ['Large & Mid Cap', 0.0004], ['Mid Cap', 0.0009], ['Small Cap', 0.0004], ['Flexi Cap', 0.0004], ['Multi Cap', 0.0004], ['Focused', 0.0004], ['Value', 0.0004]];
  const sch: any[] = [], ser = new Map<string, Record<string, number>>(); cats.forEach(([c, d], i) => { const m = mk(c, d, 9, 11 + i); sch.push(...m.sch); for (const [k, v] of m.ser) ser.set(k, v); });
  const r = categoryRotation(sch, ser, { ...CR, firstYear: 2013, lastYear: 2025 }), r2 = categoryRotation(sch, ser, { ...CR, firstYear: 2013, lastYear: 2025 });
  assert.deepEqual(r, r2); assert.ok(r.counted >= 10);
  assert.ok(r.years.every((y) => y.picked.includes('Mid Cap')));
  assert.ok(r.pass, JSON.stringify({ c: r.counted, b: r.beat, m: r.medianExcess }));
});
test('C-99: too few categories or funds counts no year and never passes', () => {
  const m = mk('Mid Cap', 0.0005, 9, 3); const r = categoryRotation(m.sch, m.ser);
  assert.equal(r.counted, 0); assert.equal(r.pass, false);
});
