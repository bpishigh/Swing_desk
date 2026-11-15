import test from 'node:test';
import assert from 'node:assert/strict';
import { baseAt, contractions, breakoutVolume, SEPA } from '../src/engine/sepa.ts';
// A synthetic tightening base: up 100% to 100, then pullbacks of 24%, 11%, 5%, then a close above the last swing high.
const build = () => {
  const px: number[] = []; for (let i = 0; i < 300; i++) px.push(50 + (50 * i) / 299);         // climb to 100 over 300 sessions
  const leg = (from: number, to: number, n: number) => { for (let i = 1; i <= n; i++) px.push(from + ((to - from) * i) / n); };
  leg(100, 76, 12); leg(76, 95, 10); leg(95, 84.55, 8); leg(84.55, 94, 8); leg(94, 89.3, 5); leg(89.3, 93, 5); leg(93, 95.5, 1);  // contractions 24%, 11%, 5%; close above 94? pivot is the 94 swing
  return px;
};
test('contractions: zigzag finds shrinking pullbacks from the base high', () => {
  const px = build(), h = px.map((v) => v * 1.002), l = px.map((v) => v * 0.998), ih = 299, cs = contractions(h, l, ih, px.length - 1);
  assert.ok(cs.length >= 2); for (let k = 1; k < cs.length; k++) assert.ok(cs[k][2] < cs[k - 1][2]);
});
test('baseAt: a tightening base with a close above the last swing high is found', () => {
  const px = build(), c = Float64Array.from(px), h = c.map((v) => v * 1.002), l = c.map((v) => v * 0.998), t = px.length - 1;
  const b = baseAt({ c, h, l }, t); assert.equal(b?.kind, 'contraction'); assert.equal(b?.contractions.length, 3); assert.ok(b!.pivot > 0 && b!.depth <= SEPA.maxDepth);
});
test('baseAt: a steady uptrend with no pullbacks has no base', () => { const c = Float64Array.from({ length: 400 }, (_, i) => 50 + i * 0.3); assert.equal(baseAt({ c, h: c, l: c }, 399), null); });
test('flat base: tight sideways range then a close above it, after a 30% advance', () => {
  const px: number[] = []; for (let i = 0; i < 400; i++) px.push(i < 370 ? 60 + (38 * i) / 369 : 98 + ((i * 7) % 5) * 0.5);   // up to 98, then 30 sessions between ~98 and ~100
  px.push(102.5); const c = Float64Array.from(px), h = c.map((v) => v * 1.003), l = c.map((v) => v * 0.997), b = baseAt({ c, h, l }, px.length - 1);
  assert.equal(b?.kind, 'flat');
});
test('breakout volume needs 150% of the prior 50-session average', () => { const v = Float64Array.from({ length: 60 }, (_, i) => (i === 59 ? 160 : 100)); assert.equal(breakoutVolume(v, 59), true); v[59] = 140; assert.equal(breakoutVolume(v, 59), false); });
