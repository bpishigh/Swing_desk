import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistories, runScan, type Day } from '../src/ingest/us-scan.ts';
import { sicGroup, SCAN } from '../src/ingest/us-scan-settings.ts';
import { parseSecTickers, parseSecSic, parseMassiveSic, secSubmissionsUrl } from '../src/ingest/sic.ts';

const N = 300;
const dates = Array.from({ length: N }, (_, i) => new Date(Date.parse('2025-01-01') + i * 86400000).toISOString().slice(0, 10));
type Gen = (i: number) => { c: number; h: number; l: number; v: number };
function days(gens: Record<string, Gen>): Day[] {
  return dates.map((date, i) => ({ date, rows: Object.entries(gens).map(([t, g]) => { const x = g(i); return [t, x.c, x.h, x.l, x.v] as [string, number, number, number, number]; }) }));
}
// A leader: steady 0.4% a day climb, wide bars until the last 12 sessions, then a tight base.
const leader = (k: number): Gen => (i) => { const c = 100 * Math.pow(1 + 0.004 + k * 0.0002, i); const r = i > N - 13 ? 0.0015 : 0.015; return { c, h: c * (1 + r), l: c * (1 - r), v: 1e6 }; };
const flat = (k: number): Gen => (i) => { const c = 50 + Math.sin(i / 7 + k) * 2 + k * 0.01; return { c, h: c * 1.01, l: c * 0.99, v: 1e6 }; };
const setup = () => {
  const g: Record<string, Gen> = {}, types = new Map<string, string>(), sic = new Map<string, number>();
  for (let k = 0; k < 8; k++) { g['L' + k] = leader(k); types.set('L' + k, 'CS'); sic.set('L' + k, 3674); }
  for (let k = 0; k < 30; k++) { g['F' + k] = flat(k); types.set('F' + k, 'CS'); sic.set('F' + k, 2000); }
  g.PENNY = () => ({ c: 4, h: 4.1, l: 3.9, v: 1e7 }); types.set('PENNY', 'CS');       // under $10
  g.THIN = (i) => ({ c: 60 + i * 0.1, h: 61 + i * 0.1, l: 59 + i * 0.1, v: 10 }); types.set('THIN', 'CS');   // no dollar volume
  g.NEW = (i) => (i >= N - 30 ? { c: 80, h: 81, l: 79, v: 1e6 } : { c: NaN, h: NaN, l: NaN, v: NaN }); types.set('NEW', 'CS');   // 30 sessions only
  return { g, types, sic };
};
const run = (light: 'green' | 'yellow' | 'red' = 'green', prev = {}) => {
  const { g, types, sic } = setup();
  const dd = days(g).map((d) => ({ ...d, rows: d.rows.filter((r) => !Number.isNaN(r[1])) }));
  const hist = buildHistories(dd, [], new Set(types.keys()));
  return runScan({ hist, types, sic, light, prev });
};

test('splits are applied to earlier bars and a long gap starts a new history', () => {
  const dd: Day[] = Array.from({ length: 60 }, (_, i) => ({ date: dates[i], rows: [['S', i < 30 ? 200 : 100, i < 30 ? 202 : 101, i < 30 ? 198 : 99, 1000]] as Day['rows'] }));
  const h = buildHistories(dd, [['S', dates[30], 1, 2]], new Set(['S']));
  assert.equal(h.series.get('S')!.c[0], 100); assert.equal(h.series.get('S')!.v[0], 2000);   // 2-for-1: earlier price halves, earlier volume doubles
  const gap: Day[] = dates.slice(0, 80).map((date, i) => ({ date, rows: (i >= 10 && i < 50 ? [] : [['G', 10 + i, 11 + i, 9 + i, 1]]) as Day['rows'] }));
  const g = buildHistories(gap, [], new Set(['G'])).series.get('G')!;
  assert.ok(Number.isNaN(g.c[5]) && !Number.isNaN(g.c[60]));   // the pre-gap bars belong to another history
});

test('the universe applies the floors, the rank, and the 65-session minimum', () => {
  const o = run();
  const syms = new Set([...o.ready, ...o.watch].map((c) => c.sym));
  assert.ok(!syms.has('PENNY') && !syms.has('THIN') && !syms.has('NEW'));
  assert.equal(o.funnel.passFloors, 38);      // 8 leaders + 30 laggards; penny, thin and new are out
  assert.equal(o.funnel.universe, 38);
});

test('leaders pass the relative-strength gate and the template; laggards do not', () => {
  const o = run();
  assert.ok(o.funnel.rsGate >= 7 && o.funnel.rsGate <= 9);
  assert.equal(o.funnel.template, o.funnel.rsGate);
  const all = [...o.ready, ...o.watch].map((c) => c.sym);
  assert.ok(all.every((s) => s.startsWith('L')));
});

test('a tight base near the pivot gives a base breakout setup with trigger, limit and stop', () => {
  const o = run();
  assert.ok(o.ready.length > 0, JSON.stringify(o.funnel));
  const c = o.ready[0]; assert.equal(c.setup!.id, '1');
  assert.ok(c.setup!.trigger > c.setup!.basis && c.setup!.limit > c.setup!.trigger && c.setup!.stop < c.setup!.trigger);
  assert.ok(c.setup!.stopWidthPct <= 8); assert.ok(c.tags.includes('results date not checked'));
  assert.ok(o.ready.length <= SCAN.top && o.ready.length <= SCAN.maxPerIndustry);       // at most 3 per industry
});

test('the group step needs a SIC; a stock with none stays out of the shortlist and is counted', () => {
  const { g, types } = setup();
  const dd = days(g).map((d) => ({ ...d, rows: d.rows.filter((r) => !Number.isNaN(r[1])) }));
  const o = runScan({ hist: buildHistories(dd, [], new Set(types.keys())), types, sic: new Map(), light: 'green', prev: {} });
  assert.equal(o.ready.length + o.watch.length, 0); assert.ok(o.noGroup.qualified >= 7);
});

test('only the top groups for the light pass: yellow allows 2, and a thin group (under 5 members) cannot', () => {
  const { g, types, sic } = setup();
  for (let k = 0; k < 3; k++) { g['T' + k] = leader(9 + k); types.set('T' + k, 'CS'); sic.set('T' + k, 7370); }   // 3 strong stocks in a group of 3
  const dd = days(g).map((d) => ({ ...d, rows: d.rows.filter((r) => !Number.isNaN(r[1])) }));
  const o = runScan({ hist: buildHistories(dd, [], new Set(types.keys())), types, sic, light: 'yellow', prev: {} });
  assert.ok(!o.groups.some((x) => x.group === 'Software and IT services'));
  assert.ok(o.thinGroup.qualified >= 3);
  assert.ok(o.groups.filter((x) => x.passes).length <= 2);
});

test('hysteresis: a stock that fails one night stays qualified (flagged); two nights drops it', () => {
  const base = run('green');
  const sym = base.ready[0].sym;
  // make the group fail by using Red with no setups irrelevant: instead force failure by marking prev and removing the stock from the leaders via an empty sic map
  const { g, types } = setup();
  const dd = days(g).map((d) => ({ ...d, rows: d.rows.filter((r) => !Number.isNaN(r[1])) }));
  const h = buildHistories(dd, [], new Set(types.keys()));
  const night1 = runScan({ hist: h, types, sic: new Map(), light: 'green', prev: { [sym]: { in: true, fails: 0 } } });
  const kept = [...night1.ready, ...night1.watch].find((c) => c.sym === sym);
  assert.ok(kept && kept.diag.failingNights === 1 && kept.tags.some((t) => t.includes('failed qualification 1')));
  const night2 = runScan({ hist: h, types, sic: new Map(), light: 'green', prev: night1.state });
  assert.ok(![...night2.ready, ...night2.watch].some((c) => c.sym === sym));
});

test('the IPO path ranks a 100-day-old stock on its 3-month return and uses the shorter template', () => {
  const { g, types, sic } = setup();
  g.IPO = (i) => { const j = i - (N - 120); const c = 20 * Math.pow(1.006, Math.max(j, 0)); const r = i > N - 13 ? 0.002 : 0.01; return i < N - 120 ? { c: NaN, h: NaN, l: NaN, v: NaN } : { c, h: c * (1 + r), l: c * (1 - r), v: 1e6 }; };
  types.set('IPO', 'CS'); sic.set('IPO', 3560);
  for (let k = 0; k < 5; k++) { g['M' + k] = flat(40 + k); types.set('M' + k, 'CS'); sic.set('M' + k, 3560); }   // a rankable group of its own (green keeps the top 4 groups)
  const dd = days(g).map((d) => ({ ...d, rows: d.rows.filter((r) => !Number.isNaN(r[1])) }));
  const o = runScan({ hist: buildHistories(dd, [], new Set(types.keys())), types, sic, light: 'green', prev: {} });
  const ipo = [...o.ready, ...o.watch].find((c) => c.sym === 'IPO');
  assert.ok(ipo && ipo.path === 'ipo' && ipo.tags.some((t) => t.includes('IPO path')));
  if (ipo.setup) assert.equal(ipo.setup.id, '1ipo');
});

test('SIC parsing and the group map', () => {
  const m = parseSecTickers({ '0': { cik_str: 320193, ticker: 'aapl', title: 'Apple' }, '1': { cik_str: '789019', ticker: 'MSFT' }, '2': { cik_str: 0, ticker: 'BAD' } });
  assert.equal(m.get('AAPL'), 320193); assert.equal(m.get('MSFT'), 789019); assert.equal(m.has('BAD'), false);
  assert.equal(secSubmissionsUrl(320193), 'https://data.sec.gov/submissions/CIK0000320193.json');
  assert.deepEqual(parseSecSic({ sic: '3571', sicDescription: 'Electronic Computers' }), { sic: 3571, desc: 'Electronic Computers' });
  assert.equal(parseSecSic({ sic: '' }), null); assert.equal(parseSecSic(null), null);
  assert.deepEqual(parseMassiveSic({ results: { sic_code: '7372', sic_description: 'SERVICES-PREPACKAGED SOFTWARE' } }), { sic: 7372, desc: 'SERVICES-PREPACKAGED SOFTWARE' });
  assert.equal(sicGroup(7372), 'Software and IT services'); assert.equal(sicGroup(2834), 'Pharma and biotech'); assert.equal(sicGroup(3674), 'Semiconductors and components');
  assert.equal(sicGroup(6021), 'Banks'); assert.equal(sicGroup(null), null);
});
