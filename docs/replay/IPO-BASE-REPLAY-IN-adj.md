# IPO base breakout replay: IN-adj

Run 2026-11-18, sessions 2020-01-02 to 2026-11-18. One run, rule as built, no tuning (docs/replay/IPO-BASE-PREREG.md). Paper only; not a financial adviser.

IPO list: 1091 names; signals logged 1230, bought 54; skipped for no slot 0, stop too wide 1109.

| Months | Book since start | Nifty 500 since start | Excess | Max drawdown | Comparator max drawdown | Closed trades | Stop-outs | Net per trade | Avg exposure |
|---|---|---|---|---|---|---|---|---|---|
| 73 | -0.3% | 145.9% | -146.2% | -3.8% | -18.0% | 54 (9 a year) | 48 | -0.3% | 4.9% |

Calendar years (book, comparator): 2020 1.7% vs 20.2%; 2021 -1.1% vs 30.2%; 2022 -0.4% vs 3.0%; 2023 0.4% vs 25.8%; 2024 -0.7% vs 15.2%; 2025 0.5% vs 5.3%; 2026 -0.7% vs 0.0%

## Pre-registered pass rule

1. Net return per trade above zero: no. 2. Book return above the comparator scaled by average exposure (7.2%): no. 3. Max drawdown no worse than 1.5x the comparator's (-27.0%): yes. 4. At least 30 closed trades a year: no. **Result: FAIL.**

**Labels.** India 2020 to 2026 prices have been seen in other tests (not for this rule); the IPO list uses the entity table, built with later knowledge; relistings and demergers can look like listings; the market light is the comparator index against its own 200-session average (no light history is stored); costs include an extra 0.6% round trip; cash earns nothing.
