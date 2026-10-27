import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runPipeline } from '../src/pm/pipeline.ts';
import type { Trade } from '../src/pm/reader.ts';

const J = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const data: any = { feed: [], demergers: [], ipos: [], amfi: [], fundOverrides: [], charges: J('data/rules/charges.json'), taxRules: J('data/rules/tax.json'), divRules: J('data/rules/dividend.json'), prices: { ABC: 120 }, pricesAsOf: '2026-10-12' };
const t = (side: 'buy' | 'sell', qty: number, price: number, date: string, id: string): Trade => ({ instrument: 'ABC LTD', symbol: 'ABC', isin: 'INE000A01011', side, qty, price, value: qty * price, date, time: '10:00', exchange: 'NSE', orderId: id, tradeId: id, kind: 'stock' });

test('pipeline: buy then part-sale, valued at the stored close', () => {
  const r = runPipeline([[t('buy', 10, 100, '2024-01-10', '1'), t('sell', 4, 150, '2025-03-10', '2')]], 'zerodha', data);
  assert.equal(r.counts.openLots, 1);
  assert.equal(r.resolver.unexplained.length, 0);
  assert.equal(r.performance.held, 6 * 120);
  assert.equal(r.performance.unrealised, 6 * 20);
  const y = r.tax.find((x) => x.fy === '2024-25')!;
  assert.ok(y.equity.ltcg > 0 && y.equity.ltcg <= 200 && y.equity.stcg === 0);
});

test('pipeline: a sell with no buy is reported, not invented', () => {
  const r = runPipeline([[t('sell', 5, 150, '2025-03-10', '9')]], 'groww', data);
  assert.equal(r.resolver.unexplained.length, 1);
  assert.equal(r.tax.reduce((a, y) => a + y.equity.stcg + y.equity.ltcg, 0), 0);
});

test('pipeline: a broker credit of demerger child shares is replaced by the demerger record, not double counted', () => {
  const dem = [{ parent: 'ABC', child: 'KID', parentIsin: 'INE000A01011', childIsin: 'INE111K01011', exDate: '2025-06-02', ratio: 1 / 4, costPct: 0.2, floorTotal: true, childSymbol: 'KID', childName: 'Kid Ltd', source: 'test' }];
  const feed = [{ symbol: 'ABC', subject: 'Demerger', exDate: '2025-06-02', recDate: '2025-06-02', faceVal: '1', series: 'EQ', isin: 'INE000A01011' }];
  const credit = { ...t('buy', 10, 0, '2025-07-01', '3'), instrument: '', symbol: '', isin: 'INE111K01011', value: 0 };
  const r = runPipeline([[t('buy', 40, 100, '2024-01-10', '1'), credit]], 'groww', { ...data, feed, demergers: dem, prices: { ABC: 100, KID: 50 } } as any);
  assert.equal(r.holdings.find((h) => h.name === 'Kid Ltd')?.qty, 10);
  assert.ok(Math.abs(r.holdings.find((h) => h.name === 'Kid Ltd')!.cost - 40 * 100 * 0.2) < 1);
  assert.ok(r.warnings.some((w) => /free shares from a demerger/.test(w)));
});

test('pipeline: valuation series follows units held and stored closes; last day equals the held value', () => {
  const ph = { dates: ['2025-03-07', '2025-03-10', '2025-03-11'], px: { ABC: [110, 150, 120] as (number | null)[] } };
  const r = runPipeline([[t('buy', 10, 100, '2024-01-10', '1'), t('sell', 4, 150, '2025-03-10', '2')]], 'zerodha', { ...data, priceHistory: ph, prices: { ABC: 120 } } as any);
  assert.deepEqual(r.series!.map((d) => d.value), [1100, 900, 720]);
  assert.equal(r.series!.at(-1)!.value, r.performance.held);
});

test('pipeline: a long price history is thinned but keeps recent days, each 31 March boundary and the last day', () => {
  const dates: string[] = []; for (let d = Date.parse('2022-04-01'); d <= Date.parse('2026-10-13'); d += 86400000) { const x = new Date(d); if (![0, 6].includes(x.getUTCDay())) dates.push(x.toISOString().slice(0, 10)); }
  const ph = { dates, px: { ABC: dates.map(() => 120) as (number | null)[] } };
  const r = runPipeline([[t('buy', 10, 100, '2022-05-10', '1')]], 'zerodha', { ...data, priceHistory: ph, prices: { ABC: 120 } } as any);
  const got = new Set(r.series!.map((d) => d.date));
  assert.ok(r.series!.length < dates.length / 2, 'thinned');
  assert.ok(got.has('2026-10-13') && got.has('2026-09-01'), 'recent days kept');
  for (const b of ['2023-03-31', '2024-03-29', '2025-03-31', '2026-03-31']) assert.ok(got.has(b), 'boundary ' + b);
});

test('pipeline: two accounts starting on different days are thinned to the same dates, so their series add up cleanly', () => {
  const dates: string[] = []; for (let d = Date.parse('2022-04-01'); d <= Date.parse('2026-10-13'); d += 86400000) { const x = new Date(d); if (![0, 6].includes(x.getUTCDay())) dates.push(x.toISOString().slice(0, 10)); }
  const ph = { dates, px: { ABC: dates.map(() => 120) as (number | null)[] } };
  const a = runPipeline([[t('buy', 10, 100, '2022-05-10', '1')]], 'zerodha', { ...data, priceHistory: ph, prices: { ABC: 120 } } as any);
  const b = runPipeline([[t('buy', 10, 100, '2022-05-13', '2')]], 'zerodha', { ...data, priceHistory: ph, prices: { ABC: 120 } } as any);
  const da = new Set(a.series!.map((d) => d.date)); const later = b.series!.filter((d) => d.date > '2022-05-20');
  assert.ok(later.length > 100 && later.every((d) => da.has(d.date)), 'every date of the later account exists in the earlier one');
});

test('pipeline: an exchange-traded unit with a fund ISIN is an ETF and gets its asset class from the AMFI scheme, whatever its listed name', () => {
  const etf = (isin: string, symbol: string): Trade => ({ ...t('buy', 10, 100, '2024-01-10', symbol), instrument: symbol, symbol, isin });
  const amfi = [['100001', 'INF247L01AB1', '-', 'Delta Nasdaq 100 ETF', 'Other Scheme - Other ETFs'], ['100002', 'INF204KB1XY2', '-', 'Nippon India ETF Nifty 50 BeES', 'Other Scheme - Index Funds']];
  const r = runPipeline([[etf('INF247L01AB1', 'MON100'), etf('INF204KB1XY2', 'NIFTYXYZ'), t('buy', 5, 100, '2024-01-10', 'z')]], 'groww', { ...data, amfi, prices: { ABC: 120, MON100: 200, NIFTYXYZ: 250 } } as any);
  const by = (n: string) => r.holdings.find((h) => h.name === n || h.symbol === n)!;
  assert.equal(by('MON100').kind, 'ETF'); assert.equal(by('MON100').assetClass, 'international');
  assert.equal(by('NIFTYXYZ').kind, 'ETF'); assert.equal(by('NIFTYXYZ').assetClass, 'index');
  assert.equal(by('ABC').kind, 'Stock'); assert.equal(by('ABC').assetClass, 'direct_equity');
});

test('pipeline: a buy on a saved shortlist line is a Swing lot with the line stop; a near buy waits for an answer and then follows it', () => {
  const sl = { lines: [{ sym: 'ABC', setup: '4', trigger: 100, limit: 101, stop: 92, signalDate: '2026-10-09' }], match: { nearSessions: 3, nearPricePct: 2 } };
  const d = { ...data, shortlist: sl };
  const exact = runPipeline([[t('buy', 10, 100.5, '2026-10-12', '1')]], 'zerodha', d);
  assert.equal(exact.books.Swing.lots, 1); assert.equal(exact.openLots[0].stop, 92); assert.equal(exact.swingProposals.length, 0);
  const near = [[t('buy', 10, 100.5, '2026-10-13', '2')]];
  const p = runPipeline(near, 'zerodha', d);
  assert.equal(p.books.Swing.lots, 0); assert.equal(p.swingProposals.length, 1);
  const key = p.swingProposals[0].key + '|' + p.swingProposals[0].date;
  const yes = runPipeline(near, 'zerodha', d, {}, { [key]: 'yes' });
  assert.equal(yes.books.Swing.lots, 1); assert.equal(yes.swingProposals.length, 0);
  const no = runPipeline(near, 'zerodha', d, {}, { [key]: 'no' });
  assert.equal(no.books.Swing.lots, 0); assert.equal(no.swingProposals.length, 0);
  assert.equal(runPipeline(near, 'zerodha', data).books.Swing.lots, 0);   // no shortlist saved: nothing is Swing
});

test('pipeline gaps: sale attribution, same-day split, size check, holidays', () => {
  const base = { lines: [{ sym: 'ABC', setup: '4', trigger: 100, limit: 101, stop: 92, signalDate: '2026-10-09' }], match: { nearSessions: 3, nearPricePct: 2, maxExactPctOfAccount: 6, addWindowSessions: 12 } };
  const d = { ...data, shortlist: base };
  const pad = { ...t('buy', 1000, 100, '2026-01-02', 'p'), instrument: 'XYZ LTD', symbol: 'XYZ', isin: 'INE000B01011' };   // makes the account big enough for the size check
  // (2) a second order of the same stock the same day, at a price inside the range, is also tied to the line (both lots Swing); a far-priced add is proposed
  const split = runPipeline([[pad, t('buy', 5, 100.2, '2026-10-12', '1'), t('buy', 5, 100.8, '2026-10-12', '2')]], 'zerodha', d);
  assert.equal(split.books.Swing.lots, split.openLots.length);
  const add = runPipeline([[pad, t('buy', 5, 100.5, '2026-10-12', '1'), t('buy', 5, 110, '2026-10-23', '2')]], 'zerodha', d);
  assert.equal(add.swingProposals.length, 1); assert.match(add.swingProposals[0].why, /add/);
  // (3) size check: a huge exact buy against a small account is demoted to a proposal
  const big = runPipeline([[pad, t('buy', 1000, 100.5, '2026-10-12', '1')]], 'zerodha', d);
  assert.equal(big.swingProposals.length, 1);
  // (4) holidays: an exchange holiday does not count as a session
  const hol = { ...base, holidays: ['2026-10-12'], extra: [] };
  const h = runPipeline([[pad, t('buy', 10, 100.5, '2026-10-13', '1')]], 'zerodha', { ...data, shortlist: hol });
  assert.equal(h.books.Swing.lots, 1);   // 12 Oct is a holiday so 13 Oct is the entry session
  // (1) sale attribution: sell the older Legacy lot first by FIFO after a Swing buy
  const buys = [pad, t('buy', 10, 80, '2026-09-01', '0'), t('buy', 10, 100.5, '2026-10-12', '1'), t('sell', 10, 105, '2026-10-20', '3')];
  const p = runPipeline([buys], 'zerodha', d);
  assert.equal(p.saleProposals.length, 1);
  const k = 'sale:' + p.saleProposals[0].key + '|' + p.saleProposals[0].date;
  assert.equal(runPipeline([buys], 'zerodha', d, {}, { [k]: 'yes' }).books.Swing.lots, 0);
  assert.equal(runPipeline([buys], 'zerodha', d, {}, { [k]: 'no' }).saleProposals.length, 0);
});

test('pipeline journal: a closed recognised buy is a scored trade, an open one is not closed, a confirmed Swing exit closes the trade', () => {
  const base = { lines: [{ sym: 'ABC', setup: '4', trigger: 100, limit: 101, stop: 90, signalDate: '2026-10-09' }], match: { nearSessions: 3, nearPricePct: 2, maxExactPctOfAccount: 6, addWindowSessions: 12 } };
  const d = { ...data, shortlist: base };
  const pad = { ...t('buy', 1000, 100, '2026-01-02', 'p'), instrument: 'XYZ LTD', symbol: 'XYZ', isin: 'INE000B01011' };
  const closed = runPipeline([[pad, t('buy', 10, 100.5, '2026-10-12', '1'), t('sell', 10, 120, '2026-10-20', '2')]], 'zerodha', d);
  assert.equal(closed.journal.length, 1); assert.equal(closed.journal[0].closed, true);
  assert.ok(Math.abs(closed.journal[0].r! - (10 * 19.5) / (10.5 * 10)) < 1e-6);   // gross profit over (entry - stop) x units
  const open = runPipeline([[pad, t('buy', 10, 100.5, '2026-10-12', '1')]], 'zerodha', d);
  assert.equal(open.journal[0].closed, false); assert.equal(open.books.Swing.lots, 1);
  // an older Legacy lot sold first by FIFO: the Swing lot stays open until the owner says that sale was the Swing exit
  const buys = [pad, t('buy', 10, 80, '2026-09-01', '0'), t('buy', 10, 100.5, '2026-10-12', '1'), t('sell', 10, 105, '2026-10-20', '3')];
  const p = runPipeline([buys], 'zerodha', d);
  assert.equal(p.journal[0].closed, false);
  const k = 'sale:' + p.saleProposals[0].key + '|' + p.saleProposals[0].date;
  const y = runPipeline([buys], 'zerodha', d, {}, { [k]: 'yes' });
  assert.equal(y.journal[0].closed, true); assert.equal(y.journal.length, 1);
  const ans = runPipeline([buys], 'zerodha', d, {}, { [k]: 'yes', ['rules:' + p.journal[0].key + '|2026-10-12']: 'no' });
  assert.equal(ans.journal[0].rulesFollowed, false);
  assert.equal(runPipeline([buys], 'zerodha', data).journal.length, 0);   // no shortlist: no journal
});

test('pipeline journal: a stopped-out trade stays in the journal when the account shrinks, and a closed trade is not offered as the base of an add', () => {
  const base = { lines: [{ sym: 'ABC', setup: '4', trigger: 100, limit: 101, stop: 90, signalDate: '2026-10-09' }], match: { nearSessions: 3, nearPricePct: 2, maxExactPctOfAccount: 6, addWindowSessions: 12 } };
  const d = { ...data, shortlist: base };
  const pad = { ...t('buy', 1000, 100, '2026-01-02', 'p'), instrument: 'XYZ LTD', symbol: 'XYZ', isin: 'INE000B01011' };
  // about 5.7% of the account while open; after the sale the account is smaller but the trade must still count (no survivorship bias)
  const open = runPipeline([[pad, t('buy', 60, 100.5, '2026-10-12', '1')]], 'zerodha', d);
  assert.equal(open.journal.length, 1);
  const stopped = runPipeline([[pad, t('buy', 60, 100.5, '2026-10-12', '1'), t('sell', 60, 90, '2026-10-14', '2')]], 'zerodha', d);
  assert.equal(stopped.journal.length, 1); assert.equal(stopped.journal[0].closed, true); assert.ok(stopped.journal[0].r! < 0);
  // a re-buy after the first trade closed is not an "add" to it
  const rebuy = runPipeline([[pad, t('buy', 10, 100.5, '2026-10-12', '1'), t('sell', 10, 105, '2026-10-14', '2'), t('buy', 10, 130, '2026-10-16', '3')]], 'zerodha', d);
  assert.equal(rebuy.swingProposals.length, 0);
});

test('pipeline history: carries every buy and sell with the full name and the realised gain', () => {
  const r = runPipeline([[t('buy', 10, 100, '2024-01-10', '1'), t('sell', 4, 150, '2025-03-10', '2')]], 'groww', data);
  assert.equal(r.history.txns.length, 2); assert.equal(r.history.stocks.length, 1);
  assert.equal(r.history.stocks[0].status, 'Partly sold'); assert.equal(r.history.stocks[0].realised, 200);
  assert.equal(r.history.stocks[0].kind, 'Stock'); assert.equal(r.history.stocks[0].book, 'Legacy');
});

test('pipeline: a typed correction changes how a stock is taxed, and a fund type cannot be put on a stock', () => {
  const trades = [[t('buy', 10, 100, '2024-01-10', '1'), t('sell', 10, 150, '2025-03-10', '2')]];
  const base = runPipeline(trades, 'zerodha', data), fixed = runPipeline(trades, 'zerodha', data, {}, {}, { INE000A01011: 'debt_fund' });
  const h = base.holdings; assert.ok(Array.isArray(h));
  assert.ok(base.tax.some((y) => y.equity.ltcg > 0));
  assert.deepEqual(fixed.tax.map((y) => y.equity.ltcg), base.tax.map((y) => y.equity.ltcg), 'a stock forced to a fund type must be ignored');
  const gold = runPipeline(trades, 'zerodha', data, {}, {}, { INE000A01011: 'gold_silver_etf' });
  assert.ok(gold.tax.some((y) => y.slabGains !== 0 || y.other.ltcgTaxable > 0 || y.other.stcg !== 0), 'treated as a gold ETF, the gain is outside the equity pool');
});
