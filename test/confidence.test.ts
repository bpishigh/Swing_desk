import test from 'node:test';
import assert from 'node:assert/strict';
import { confidenceFromStats, confidenceOf, normCdf } from '../src/engine/confidence.ts';

const H = 0.005 / 12; // extra cost 0.5% a year
test('normCdf matches known values', () => { assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-6); assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-3); assert.ok(Math.abs(normCdf(-1) - 0.158655) < 1e-4); });
test('no evidence yet: fewer than three months gives 50%', () => { assert.equal(confidenceOf([], H).confidence, 0.5); assert.equal(confidenceOf([0.01, 0.01], H).confidence, 0.5); });
test('steady 0.3% a month, noise 1%: about 65%, 75%, 86% at 6, 12, 24 months', () => {
  const c6 = confidenceFromStats(6, 0.003, 0.01, H).confidence, c12 = confidenceFromStats(12, 0.003, 0.01, H).confidence, c24 = confidenceFromStats(24, 0.003, 0.01, H).confidence;
  assert.ok(c6 > 0.62 && c6 < 0.68, String(c6)); assert.ok(c12 > 0.72 && c12 < 0.78, String(c12)); assert.ok(c24 > 0.83 && c24 < 0.89, String(c24));
  assert.ok(c6 < c12 && c12 < c24);
});
test('profit stopping pulls confidence back; no excess stays near 50%; losses fall below', () => {
  const stopped = confidenceFromStats(12, 0.0015, 0.01, H).confidence, steady = confidenceFromStats(12, 0.003, 0.01, H).confidence, six = confidenceFromStats(6, 0.003, 0.01, H).confidence;
  assert.ok(stopped < six && stopped < steady, String(stopped));
  const flat = confidenceFromStats(12, 0, 0.01, H).confidence; assert.ok(flat < 0.5 && flat > 0.4, String(flat));
  assert.ok(confidenceFromStats(12, -0.003, 0.01, H).confidence < 0.3);
});
test('a higher hurdle lowers confidence; the noise floor stops a flat series giving certainty', () => {
  assert.ok(confidenceFromStats(12, 0.003, 0.01, 0.003).confidence < confidenceFromStats(12, 0.003, 0.01, 0).confidence);
  const lucky = confidenceOf(Array(12).fill(0.003), H); assert.ok(lucky.confidence < 0.99, String(lucky.confidence));
});
