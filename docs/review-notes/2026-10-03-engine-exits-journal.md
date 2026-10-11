# Review note: engine, exit rules, trade arithmetic, risk halving and Journal Test (3 Oct 2026)

Implements: Engine Rules "Exits, journal and review" (the nine exit rules, India and US differences, journal and fresh-money test) and the equity-basis, risk-halving and MAE/MFE parts of "Entry mechanics and book rules". Ported from v9 `evaluate`, `held`, `avgCost`, `tradePnl`, `tradeR`, `equityCurve`, `halvingState`, `statsFor`, `freshMoney`.

## Result
51 tests pass (35 earlier plus 16 new). `tools/make-v9-exits-golden.mjs` runs the ORIGINAL v9 code: 700 seeded open-trade cases through `evaluate` (every action, its class and its text must match; rule coverage in the grid: rule 1 215, rule 2 119, rule 3 only 4, rule 4 122, add 68, rule 5 59, rule 6 trail 53, rule 7 19, rule 8 77, rule 9 86) and 250 seeded closed-trade sets through the journal functions (equity, drawdown, halving state, statistics, Journal Test result). The TypeScript matches on every case. One rule-level test per exit rule, plus tests of tradeR, halving and the Journal Test gate.

## Design choices and things to check
- `evaluate` is pure: today's date, market and the regime-drop flag are arguments. v9 reads the clock and the tracker; here the caller supplies them.
- Rule 3 (failed breakout) has thin replay coverage (4 cases); its rule-level test covers the boundaries (within 3 sessions, breakout setups only).
- Kept from v9 and not stated in the rules text:
  1. Sessions are weekdays, not exchange sessions (holidays not subtracted); weeks 1 to 7 are `days < 49` calendar days since entry.
  2. Rule 6 in India compares the close, not the low, with the 20 EMA; with no 20 EMA entered it prints an instruction line instead of acting.
  3. Rule 9 raises the stop to the higher of today's low and the 10 EMA only when the trade is below +1R and the candidate is above the current stop.
  4. `tradeR` divides by R per share times the planned full size (1 if absent), so a trade not fully filled still scores against the planned size.
  5. Halving ends after two winners close, counted only after the streak trigger; the 5%-below-peak halving has no such counter (it ends when drawdown recovers).
  6. The Journal Test is the 20-trade, 90-day gate with four tests. The 100-trade tier is Proposed C-31 and is NOT implemented.
- Intraday MAE/MFE (C-32) is Proposed and not implemented; MAE/MFE here would remain close-based.

## Not covered
- Legacy book rules and its own 3% open-risk budget, the open-risk number (`openRiskRs`), VIX halving, proven-Green 1% (all need the app state), India price-band and circuit checks at exit, corporate-action GTT checks.
