import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewTrade, patterns, type ReviewIn, type Series } from '../src/pm/tradereview.ts';

// 400 business-day-ish dates from 2025-01-01; closes from a function of the index
const dates: string[] = []; { let t = Date.parse('2025-01-01'); while (dates.length < 400) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) dates.push(new Date(t).toISOString().slice(0, 10)); t += 86400000; } }
const mk = (f: (i: number) => number): Series => ({ dates, px: dates.map((_, i) => f(i)) });
const flat = (nav = 100): Record<string, number> => Object.fromEntries(dates.map((d) => [d, nav]));
const base = (o: Partial<ReviewIn> = {}): ReviewIn => ({ name: 'X Ltd', firstBuy: dates[200], lastSell: dates[230], status: 'Closed', days: 42, invested: 1000, proceeds: 1100, realised: 100, soldCost: 1000, series: mk(() => 100), bench: flat(), ...o });

test('a profit against a flat index is "Went well" and says it beat the index', () => {
  const r = reviewTrade(base());
  assert.equal(r.grade, 'good'); assert.ok(r.good.some((x) => /^Ahead of the Nifty 50 index fund/.test(x)));
});
test('a loss is "Did not go well"; behind the index is Mixed when profitable', () => {
  assert.equal(reviewTrade(base({ realised: -100, proceeds: 900 })).grade, 'poor');
  const up: Record<string, number> = Object.fromEntries(dates.map((d, i) => [d, 100 + i]));   // index rises ~15% over the 30 sessions
  assert.equal(reviewTrade(base({ realised: 20, proceeds: 1020, bench: up })).grade, 'mixed');
});
test('late entry, deep dip, giving back the gain and an early sale are each named from the prices', () => {
  // flat 100 to day 180, ramp to 130 by day 199 (a 30% run), buy at day 200, spike to 150, fall to 110 at the sale, then rise to 140
  const s = mk((i) => (i < 180 ? 100 : i < 200 ? 100 + (i - 180) * 1.5 : i < 215 ? 130 + (i - 200) * (20 / 15) : i <= 230 ? 150 - (i - 215) * (40 / 15) : 110 + (i - 230) * 1.5));
  const r = reviewTrade(base({ series: s, realised: -50, proceeds: 950 }));
  assert.ok(r.n.runUp20! > 0.25); assert.ok(r.bad.some((x) => /late entry/.test(x)));
  assert.ok(r.n.gaveBack! > 0.5); assert.ok(r.bad.some((x) => /Gave back|then fell below it/.test(x)));
  assert.ok(r.n.after20! > 0.15); assert.ok(r.bad.some((x) => /sold early/.test(x)));
});
test('a series that does not cover the holding or is missing gives only the result and index lines', () => {
  const r = reviewTrade(base({ series: null }));
  assert.equal(r.n.worstDip, null); assert.equal(r.n.runUp20, null);
  const early = reviewTrade(base({ firstBuy: '2024-06-01', lastSell: '2024-07-01', series: mk(() => 100) }));
  assert.equal(early.n.worstDip, null);   // the stored prices start after the buy
});
test('swing trades: a loss near 1R is as planned, a bigger one is past the stop; rule answers are echoed', () => {
  const a = reviewTrade(base({ realised: -100, proceeds: 900, swing: { stop: 90, entry: 100, rulesFollowed: true } }));
  assert.ok(a.good.some((x) => /near 1R/.test(x))); assert.ok(a.good.some((x) => /following the rules/.test(x)));
  const b = reviewTrade(base({ realised: -300, proceeds: 700, swing: { stop: 90, entry: 100, rulesFollowed: false } }));
  assert.ok(b.bad.some((x) => /past the planned stop/.test(x))); assert.ok(b.bad.some((x) => /breaking the exit rules/.test(x)));
});
test('patterns need 5 trades in each group before they are stated', () => {
  const mkR = (result: number, days: number, runUp = 0.05) => ({ result, days, r: { ...reviewTrade(base()), n: { ...reviewTrade(base()).n, runUp20: runUp, bench: 0 } } });
  assert.equal(patterns([mkR(0.1, 20), mkR(-0.1, 60)]).length, 0);
  const many = [...Array.from({ length: 5 }, () => mkR(0.1, 20)), ...Array.from({ length: 5 }, () => mkR(-0.1, 60))];
  assert.ok(patterns(many).some((p) => /losers are held longer/.test(p.text)));
  const late = [...Array.from({ length: 5 }, () => mkR(-0.1, 20, 0.3)), ...Array.from({ length: 5 }, () => mkR(0.1, 20, 0.05))];
  assert.ok(patterns(late).some((p) => /run of over 20%/.test(p.text)));
});

test('no cost basis gives no result and a mixed grade; a break-even trade is mixed, not poor', () => {
  const a = reviewTrade(base({ gainKnown: false }));
  assert.equal(a.n.result, null); assert.equal(a.grade, 'mixed'); assert.ok(a.bad.some((x) => /no cost/.test(x)));
  const f = reviewTrade(base({ realised: 0.5, proceeds: 1000.5 }));
  assert.equal(f.grade, 'mixed'); assert.ok(f.good.some((x) => /break-even/.test(x)));
});
test('a fund gets no 20-session or year-high figures; a price that peaks then ends below the buy is worded as such, not as a percentage over 100', () => {
  const fund = reviewTrade(base({ fund: true, series: mk((i) => 100 + i * 0.1) }));
  assert.equal(fund.n.runUp20, null); assert.equal(fund.n.after20, null); assert.equal(fund.n.belowHigh, null); assert.notEqual(fund.n.worstDip, null);
  // up to 130 by the sale window's middle, then down to 90 at the sale
  const s = mk((i) => (i < 200 ? 100 : i < 215 ? 100 + (i - 200) * 2 : 130 - (i - 215) * 2.67));
  const r = reviewTrade(base({ series: s, realised: -100, proceeds: 900 }));
  assert.ok(r.n.gaveBack! > 1); assert.ok(r.bad.some((x) => /then fell below it/.test(x))); assert.ok(!r.bad.some((x) => /\d{3}% of the best gain/.test(x)));
});
test('a buy before the stored prices begin, or the year-high window shorter than 250 sessions, gives no price figures; the ends of the series are safe', () => {
  const short = reviewTrade(base({ firstBuy: dates[150], lastSell: dates[170] }));
  assert.equal(short.n.belowHigh, null);   // fewer than 250 sessions before the buy
  const edge = reviewTrade(base({ firstBuy: dates[380], lastSell: dates[399] }));
  assert.equal(edge.n.after20, null);       // no 20 sessions after the last close
  const weekend = reviewTrade(base({ firstBuy: '2025-03-01', lastSell: '2025-03-30' }));   // a Saturday and a Sunday: the last close before each is used
  assert.notEqual(weekend.n.worstDip, null);
});
test('winners and losers exclude flat trades from the hold-time pattern', () => {
  const mkR = (result: number, days: number) => ({ result, days, r: reviewTrade(base()) });
  const rs = [...Array.from({ length: 5 }, () => mkR(0.1, 20)), ...Array.from({ length: 5 }, () => mkR(0, 90))];
  assert.equal(patterns(rs).filter((p) => /held/.test(p.text)).length, 0);   // only 0 losers
});
