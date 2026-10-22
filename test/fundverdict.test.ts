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
  const w = fundVerdict({ name: rows[2].n }, rows, off); assert.equal(w.label, 'Watch'); assert.match(w.pending[0], /back-test/);
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
