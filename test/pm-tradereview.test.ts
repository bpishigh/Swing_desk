import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewTrade, patterns, type ReviewIn, type Series } from '../src/pm/tradereview.ts';

// 400 business-day-ish dates from 2025-01-01; closes from a function of the index
const dates: string[] = []; { let t = Date.parse('2025-01-01'); while (dates.length < 400) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) dates.push(new Date(t).toISOString().slice(0, 10)); t += 86400000; } }
const mk = (f: (i: number) => number): Series => ({ dates, px: dates.map((_, i) => f(i)) });
const flat = (nav = 100): Record<string, number> => Object.fromEntries(dates.map((d) => [d, nav]));
const base = (o: Partial<ReviewIn> = {}): ReviewIn => {
  const r: ReviewIn = { name: 'X Ltd', firstBuy: dates[200], lastSell: dates[230], status: 'Closed', days: 42, invested: 1000, proceeds: 1100, realised: 100, soldCost: 1000, series: mk(() => 100), bench: flat(), ...o };
  // one buy at the cost of the units sold and one sale at the proceeds, unless a test gives its own
  r.buys ??= [{ date: r.firstBuy, qty: 10, price: r.proceeds - r.realised > 0 ? (r.proceeds - r.realised) / 10 : 100 }]; r.sells ??= [{ date: r.lastSell, qty: 10, price: r.proceeds / 10 }];
  return r;
};

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

import { stopSummary } from '../src/pm/tradereview.ts';
const volOf = (f: (i: number) => number) => ({ dates, v: dates.map((_, i) => f(i)), d: dates.map(() => 40) });

test('stop what-if: a stock that keeps falling shows money saved; one that dips through the stop and recovers shows the cost; one that never dips shows nothing', () => {
  // buy day 200 at 100, falls 1% a session to day 230 (about 74), sold there: loss; a 10% stop triggers about day 211
  const fall = mk((i) => (i <= 200 ? 100 : 100 * Math.pow(0.99, i - 200)));
  const r = reviewTrade(base({ series: fall, realised: -260, proceeds: 740 }));   // cost 1000, result -26%
  const s10 = r.stops.find((x) => x.lvl === 0.1)!;
  assert.equal(s10.hit, true); assert.ok(s10.exitRet! <= -0.1 && s10.exitRet! > -0.12); assert.ok(s10.saved! > 100 && s10.saved! < 160);   // 1000 x (-0.105 - -0.26)
  // dips 12% then recovers to +20% by the sale: the 10% stop would have cost money
  const dip = mk((i) => (i <= 200 ? 100 : i < 210 ? 100 - (i - 200) * 1.3 : 87 + (i - 210) * 1.65));
  const r2 = reviewTrade(base({ series: dip, realised: 200, proceeds: 1200 }));
  assert.ok(r2.stops.find((x) => x.lvl === 0.1)!.saved! < 0);
  const calm = reviewTrade(base());
  assert.ok(calm.stops.every((x) => !x.hit && x.saved === null));
  const sum = stopSummary([{ r }, { r: r2 }, { r: calm }]);
  assert.ok(sum[1].saved > 0 && sum[1].cost < 0); assert.equal(sum[1].hit, 2); assert.equal(Math.round(sum[1].net), Math.round(sum[1].saved + sum[1].cost));
});
test('holding is named as the main issue when a 10% stop would have saved most of the loss and the stock was held 10+ sessions after', () => {
  const fall = mk((i) => (i <= 200 ? 100 : 100 * Math.pow(0.985, i - 200)));
  const r = reviewTrade(base({ series: fall, realised: -260, proceeds: 740 }));
  assert.equal(r.issue?.kind, 'holding'); assert.match(r.issue!.text, /10% below the buy-day close/);
  assert.equal(reviewTrade(base()).issue, null);   // a profitable trade has no issue
});
test('entry facts and reads come from price and volume before the buy: chase, breakout, ordinary', () => {
  const run = mk((i) => (i < 190 ? 100 : i <= 200 ? 100 + (i - 190) * 3 : 130));   // +30% in the 10 sessions to the buy
  const spike = volOf((i) => (i === 200 ? 5000 : 1000));
  const a = reviewTrade(base({ series: run, vol: spike }));
  assert.match(a.entry!.read, /chasing a move.*run up fast on heavy volume that day/); assert.ok(a.entry!.facts.some((f) => /5\.0x/.test(f)));
  const quiet = reviewTrade(base({ series: mk(() => 100), vol: volOf(() => 1000) }));
  assert.match(quiet.entry!.read, /No sign of chasing/);
  assert.equal(reviewTrade(base({ series: mk(() => 100), vol: null })).n.volRatio, null);
  assert.equal(reviewTrade(base({ fund: true, series: mk(() => 100), vol: spike })).n.volRatio, null);   // funds have no volume
});
test('same-day clusters are named', () => {
  const r = reviewTrade(base({ cluster: { buys: 2, sells: 3 } }));   // a cluster is a neutral note, not a fault
  assert.ok(reviewTrade(base({ cluster: { buys: 3, sells: 4 } })).notes.some((x) => /3 other stocks in this account were bought the same day and 4 others were sold the same day/.test(x)));
  assert.equal(reviewTrade(base({ cluster: { buys: 2, sells: 1 } })).notes.length, 0);   // fewer than 3 others is not a cluster
  assert.ok(!r.bad.some((x) => /same day/.test(x)));
});

test('stop what-if: units sold before the stop would have fired are not credited; several buy days are not tested; a split in the volume window drops volume figures', () => {
  const fall = mk((i) => (i <= 200 ? 100 : 100 * Math.pow(0.99, i - 200)));   // 10% below at about day 211
  // sold half on day 205 (before any 10% stop) at about 95 and half at day 230 at about 74: only the second half is credited
  const part = reviewTrade(base({ series: fall, buys: [{ date: dates[200], qty: 10, price: 100 }], sells: [{ date: dates[205], qty: 5, price: 95 }, { date: dates[230], qty: 5, price: 74 }], realised: -155, proceeds: 845 }));
  const s10 = part.stops.find((x) => x.lvl === 0.1)!;
  assert.ok(s10.tested && s10.hit); assert.ok(s10.saved! > 5 * (89 - 74) - 3 && s10.saved! < 5 * (91 - 74) + 3);   // 5 units x (stop price ~90 - 74)
  const several = reviewTrade(base({ series: fall, buys: [{ date: dates[200], qty: 5, price: 100 }, { date: dates[210], qty: 5, price: 90 }] }));
  assert.ok(several.stops.every((x) => !x.tested && x.saved === null));
  assert.equal(stopSummary([{ r: several }]).every((x) => x.trades === 0), true);   // untested trades are not counted as "not triggered"
  assert.equal(reviewTrade(base({ series: mk(() => 100), vol: volOf(() => 1000), volSplit: true })).n.volRatio, null);
});
test('volume is read for a weekend buy from the previous session; the main issue is the market when the index fell as much', () => {
  const wk = dates.findIndex((d) => new Date(d + 'T00:00:00Z').getUTCDay() === 1 && dates.indexOf(d) > 100);   // a Monday
  const sat = new Date(Date.parse(dates[wk]) - 2 * 86400000).toISOString().slice(0, 10);
  const r = reviewTrade(base({ firstBuy: sat, lastSell: dates[wk + 30], series: mk(() => 100), vol: volOf((i) => (i === wk - 1 ? 4000 : 1000)) }));
  assert.ok(r.n.volRatio !== null && r.n.volRatio > 3);
  const fall = mk((i) => (i <= 200 ? 100 : 100 * Math.pow(0.99, i - 200)));
  const down: Record<string, number> = Object.fromEntries(dates.map((d, i) => [d, i <= 200 ? 100 : 100 * Math.pow(0.992, i - 200)]));
  const m = reviewTrade(base({ series: fall, bench: down, realised: -260, proceeds: 740 }));
  assert.equal(m.issue?.kind, 'market');
});

test('entry wording separates the buy-day volume from an earlier surge, and says what delivery means', () => {
  // at the high, big volume 3 sessions before, quiet on the buy day, delivery below usual
  const hi = mk((i) => (i < 295 ? 100 : 100 + (i - 294)));
  const v = { ...volOf((i) => (i === 297 ? 8000 : i === 300 ? 800 : 1000)), d: Array.from({ length: dates.length }, (_, i) => (i === 300 ? 29 : 40)) };
  const a = reviewTrade(base({ firstBuy: dates[300], lastSell: dates[330], series: hi, vol: v })).entry!;
  assert.match(a.read, /breakout entry.*volume on your buy day was quiet.*joined after the move/);
  assert.ok(a.facts.some((f) => /volume on the buy day was 0\.7x its average of the 50 sessions before \(light\)/.test(f)));
  assert.ok(a.facts.some((f) => /busiest of the last 5 sessions up to your buy was 7\.0x/.test(f)));
  assert.ok(a.facts.some((f) => /delivery on the buy day was 29% of shares traded, against a usual 40% \(lower than usual\)/.test(f)));
  assert.match(a.read, /Delivery was below its usual level/);
  // sharp bounce, still well below the high, heavy volume on the buy day: chasing
  const bounce = mk((i) => (i < 250 ? 140 : i < 290 ? 100 : i <= 300 ? 100 + (i - 290) * 2 : 120));
  const b = reviewTrade(base({ firstBuy: dates[300], lastSell: dates[330], series: bounce, vol: volOf((i) => (i === 300 ? 2000 : 1000)) })).entry!;
  assert.match(b.read, /chasing a move.*run up fast on heavy volume that day/);
  assert.ok(b.facts.some((f) => /below its 1-year high/.test(f)));
  assert.ok(b.facts.some((f) => /price rose \d+\.\d% in the 5 trading days before your buy/.test(f)));
});
