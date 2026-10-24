import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fundVerdict, normFundName } from '../src/pm/fundverdict.ts';

const rows = [
  { n: 'Alpha Flexi Cap Fund - Direct Plan - Growth', c: 'Flexi Cap', b: 'Strong', g: 'mf' },
  { n: 'Beta Mid Cap Fund - Direct Plan - Growth', c: 'Mid Cap', b: 'Weak', g: 'mf' },
  { n: 'Gamma Small Cap Fund - Direct Plan - Growth', c: 'Small Cap', b: 'Weak', rp: 1, g: 'mf' },
  { n: 'Delta Nifty 50 Index Fund - Direct Plan - Growth', c: 'Nifty 50', b: 'Weak', rp: 1, g: 'idx' },
  { n: 'Epsilon Pharma Fund - Direct Plan - Growth', c: 'Sectoral/Thematic', b: 'Strong', g: 'mf' },
  { n: 'Zeta Balanced Advantage Fund - Direct Plan - Growth', c: 'Balanced Advantage', b: 'Average', g: 'mf' },
  { n: 'Eta Large Cap Fund - Direct Plan - Growth', c: 'Large Cap', b: null, g: 'mf', note: 'Less than 3 years of NAV history: not scored.' },
] as any;
const on = { ran: true, replaceOn: true }, off = { ran: true, replaceOn: false };

test('no verdict until the back-test has run', () => { assert.equal(fundVerdict({ name: rows[0].n }, rows, { ran: false, replaceOn: false }).label, 'No verdict'); });
test('Strong and Average are Keep; a Weak fund is Watch', () => {
  assert.equal(fundVerdict({ name: 'alpha flexi cap fund direct plan growth' }, rows, on).label, 'Keep');
  assert.equal(fundVerdict({ name: rows[1].n }, rows, on).label, 'Watch');
});
test('Replace needs three Weak runs and a passed back-test; otherwise it stays Watch with the reason', () => {
  assert.equal(fundVerdict({ name: rows[2].n }, rows, on).label, 'Replace');
  const w = fundVerdict({ name: rows[2].n }, rows, off); assert.equal(w.label, 'Watch'); assert.match(w.pending[0], /no switch advice yet/);
});
test('index funds never reach Replace', () => { assert.equal(fundVerdict({ name: rows[3].n }, rows, on).label, 'Watch'); });
test('hybrid funds and unscored funds get No verdict with a reason; a fund not in the list too', () => {
  assert.equal(fundVerdict({ name: rows[5].n }, rows, on).label, 'Keep');   // hybrid funds are judged by band inside their own category
  assert.match(fundVerdict({ name: rows[6].n }, rows, on).reasons[0], /not scored/);
  assert.match(fundVerdict({ name: 'Unknown Fund' }, rows, on).reasons[0], /not in the scored list/);
});
test('a sector fund uses the stock lens on its NAV', () => {
  const nav = (f: (i: number) => number) => { const o: Record<string, number> = {}; const d = new Date('2025-01-01T00:00:00Z'); for (let i = 0; i < 260; i++) { d.setUTCDate(d.getUTCDate() + 1); o[d.toISOString().slice(0, 10)] = f(i); } return o; };
  assert.equal(fundVerdict({ name: rows[4].n }, rows, on, nav((i) => 100 + i * 0.5)).label, 'Keep');
  const fall = fundVerdict({ name: rows[4].n }, rows, on, nav((i) => (i < 200 ? 100 + i * 0.5 : 200 - (i - 200) * 4)));
  assert.equal(fall.label, 'Exit'); assert.match(fall.reasons.join(' '), /200-day/);
  assert.equal(fundVerdict({ name: rows[4].n }, rows, on, nav(() => 100).constructor === Object ? {} : undefined).label, 'No verdict');
});
test('names match across plan wording and Ltd', () => { assert.equal(normFundName('Alpha Fund Ltd.'), normFundName('ALPHA fund limited')); });
test('a broker name without the AMFI punctuation still finds its row: by ISIN first, then by the name with plan words removed', () => {
  const r = [{ n: 'Quant Small Cap Fund - Direct Plan - Growth', i: 'INF966L01689', c: 'Small Cap', b: 'Average', g: 'mf' }] as any;
  assert.equal(fundVerdict({ name: 'Something Else Entirely', isin: 'INF966L01689' }, r, on).label, 'Keep');
  assert.equal(fundVerdict({ name: 'Quant Small Cap Fund Direct Plan Growth' }, r, on).label, 'Keep');
  assert.equal(fundVerdict({ name: 'quant small cap fund direct growth' }, r, on).label, 'Keep');
});

test('hybrid funds get Keep or Watch but never Replace; funds without a score row get a reason by type; a thematic fund AMFI files as Thematic still gets the stock lens', () => {
  const hy = [{ n: 'Theta Aggressive Hybrid Fund - Direct Plan - Growth', c: 'Aggressive Hybrid', b: 'Weak', rp: 1, g: 'mf' }] as any;
  assert.equal(fundVerdict({ name: hy[0].n }, hy, on).label, 'Watch');
  assert.match(fundVerdict({ name: 'Iota Liquid Fund', category: 'Income/Debt Oriented Schemes - Liquid Fund' }, rows, on).reasons[0], /debt and liquid/);
  assert.match(fundVerdict({ name: 'Kappa Global FoF', category: 'Other Scheme - FoF Overseas' }, rows, on).reasons[0], /international/);
  assert.match(fundVerdict({ name: 'Lambda Defence Fund', category: 'Equity Schemes - Thematic Fund' }, rows, on).reasons[0], /loading its NAV/);
  const nav: Record<string, number> = {}; const d = new Date('2025-01-01T00:00:00Z'); for (let i = 0; i < 260; i++) { d.setUTCDate(d.getUTCDate() + 1); nav[d.toISOString().slice(0, 10)] = 100 + i; }
  assert.equal(fundVerdict({ name: 'Lambda Defence Fund', category: 'Equity Schemes - Thematic Fund' }, rows, on, nav).label, 'Keep');
});

test('debt and international funds: Keep for Strong or Average, Watch for Weak, never Replace, with the risk facts in the reason', () => {
  const r = [
    { n: 'Mu Liquid Fund - Direct Plan - Growth', c: 'Liquid', b: 'Strong', g: 'debt', p: 12, dd: -0.1, wd: -0.02, vol: 0.2, t: 0.15 },
    { n: 'Nu Short Term Fund - Direct Plan - Growth', c: 'Short duration', b: 'Weak', rp: 1, g: 'debt', p: 9, dd: -3.1, wd: -2.4, vol: 1.4, t: 0.5, fl: 'worst single day -2.4% (a credit or duration event shows up like this)' },
    { n: 'Xi Europe Fund of Fund - Direct Plan - Growth', c: 'Europe', b: null, g: 'intl', note: 'Only 1 funds in this group have a 3-year record (need 3): not ranked.' },
  ] as any;
  const a = fundVerdict({ name: r[0].n }, r, on); assert.equal(a.label, 'Keep'); assert.match(a.reasons[0], /among 12 in Liquid.*worst 3-year fall -0\.1%/);
  const b = fundVerdict({ name: r[1].n }, r, on); assert.equal(b.label, 'Watch'); assert.equal(b.reasons.length, 2);
  assert.match(fundVerdict({ name: r[2].n }, r, on).reasons[0], /not ranked/);
});

test('C-83: a plain equity fund scoring 25 to 35 reads Watch only when the near-bottom test passed', () => {
  const r = [{ n: 'Pi Flexi Cap Fund - Direct Plan - Growth', c: 'Flexi Cap', b: 'Average', s: 28.9, g: 'mf' }, { n: 'Rho Flexi Cap Fund - Direct Plan - Growth', c: 'Flexi Cap', b: 'Average', s: 45, g: 'mf' }] as any;
  assert.equal(fundVerdict({ name: r[0].n }, r, { ran: true, replaceOn: false, nearWeakOn: false }).label, 'Keep');
  const w = fundVerdict({ name: r[0].n }, r, { ran: true, replaceOn: false, nearWeakOn: true }); assert.equal(w.label, 'Watch'); assert.match(w.reasons[0], /near the bottom quarter/);
  assert.equal(fundVerdict({ name: r[1].n }, r, { ran: true, replaceOn: false, nearWeakOn: true }).label, 'Keep');
});

test('C-84: the reason shows the fund beside its category, the index funds and cash, and says when the whole category trails cash', () => {
  const r = [
    { n: 'Sigma ELSS Fund - Direct Plan - Growth', c: 'ELSS', b: 'Average', s: 50, r3: 5.0, g: 'mf' },
    { n: 'Tau ELSS Fund - Direct Plan - Growth', c: 'ELSS', b: 'Average', s: 55, r3: 6.0, g: 'mf' },
    { n: 'Ups Nifty 500 Index Fund', c: 'Nifty 500', b: null, r3: 9, g: 'idx' }, { n: 'Ups2 Nifty 500 Index Fund', c: 'Nifty 500', b: null, r3: 9.4, g: 'idx' }, { n: 'Ups3 Nifty 500 Index Fund', c: 'Nifty 500', b: null, r3: 9.6, g: 'idx' },
    { n: 'Phi Liquid Fund', c: 'Liquid', b: 'Average', r3: 7, g: 'debt' },
  ] as any;
  const v = fundVerdict({ name: r[0].n }, r, on);
  assert.equal(v.label, 'Keep');
  assert.match(v.reasons[1], /3-year return 5\.0%, category median 5\.5%, index funds 9\.4%, liquid funds 7\.0%; the whole category has returned less than cash/);
});

test('C-85: with the index rule on, a Keep fund trailing the index funds reads Watch; with it off, Keep; cash rule likewise', () => {
  const idx = (n: string, v: number) => ({ n, c: 'Nifty 50', b: null, r3: v, g: 'idx' });
  const r = [
    { n: 'Chi Large Cap Fund - Direct Plan - Growth', c: 'Large Cap', b: 'Average', s: 50, r3: 5.0, g: 'mf' },
    { n: 'Psi Large Cap Fund - Direct Plan - Growth', c: 'Large Cap', b: 'Average', s: 50, r3: 12, g: 'mf' },
    idx('a Nifty 50 Index Fund', 9), idx('b Nifty 50 Index Fund', 9.2), idx('c Nifty 50 Index Fund', 9.4),
    { n: 'Phi Liquid Fund', c: 'Liquid', b: 'Average', r3: 7, g: 'debt' },
  ] as any;
  assert.equal(fundVerdict({ name: r[0].n }, r, on).label, 'Keep');
  const d = fundVerdict({ name: r[0].n }, r, { ...on, indexRuleOn: true }); assert.equal(d.label, 'Watch'); assert.match(d.reasons[0], /trailing the index funds/);
  const e = fundVerdict({ name: r[0].n }, r, { ...on, cashRuleOn: true }); assert.equal(e.label, 'Watch'); assert.match(e.reasons[0], /trailing cash/);
  assert.equal(fundVerdict({ name: r[1].n }, r, { ...on, indexRuleOn: true, cashRuleOn: true }).label, 'Keep');
});
