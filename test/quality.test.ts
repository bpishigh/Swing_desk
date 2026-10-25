import { test } from 'node:test'; import assert from 'node:assert/strict';
import { parseQuality, qualityFlags } from '../src/pm/holdingsparse.ts';
const page = (d: unknown) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { mfServerSideData: d } } })}</script>`;
const d = { fund_manager_details: [{ person_name: 'A B', date_from: '2023-12-21T18:30:00.000Z' }, { person_name: 'C D', date_from: '2026-08-01T18:30:00.000Z' }], aum: '1000.5', benchmark_name: 'NIFTY 500 TRI', expense_ratio: '0.69', portfolio_turnover: '30', launch_date: '24-May-2013', exit_load: '1%', historic_exit_loads: [{ as_on_date: '2021-11-15T00:00:00', note: 'x' }], historic_fund_expense: [{ expense_ratio: 0.7, as_on_date: '2025-01-02T00:00:00' }, { expense_ratio: 0.7, as_on_date: '2025-01-03T00:00:00' }, { expense_ratio: 0.69, as_on_date: '2025-06-01T00:00:00' }] };
test('parseQuality reads facts and compresses the expense history', () => {
  const q = parseQuality(page(d))!; assert.equal(q.managers.length, 2); assert.equal(q.managers[0].since, '2023-12-22'); assert.equal(q.aum, 1000.5); assert.equal(q.expense, 0.69);
  assert.deepEqual(q.expenseChanges, [{ from: '2025-01-02', ratio: 0.7 }, { from: '2025-06-01', ratio: 0.69 }]); assert.equal(parseQuality('<html>'), null);
});
test('flags are facts only', () => {
  const q = parseQuality(page(d))!; const f = qualityFlags(q, null, '2026-10-25'); assert.equal(f.length, 1); assert.equal(f[0].kind, 'new-manager');
  const p = { ...q, managers: [q.managers[0]], expense: 0.8 }; const g = qualityFlags(q, p, '2026-10-25').map((x) => x.kind); assert.ok(g.includes('manager-added') && g.includes('expense'));
});
