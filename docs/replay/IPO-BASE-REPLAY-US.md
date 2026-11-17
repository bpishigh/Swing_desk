# IPO base breakout replay: US

Run 2026-11-17, sessions 2017-01-03 to 2026-11-16. One run, rule as built, no tuning (docs/replay/IPO-BASE-PREREG.md). Paper only; not a financial adviser.

IPO list: 707 names; signals logged 724, bought 105; skipped for no slot 0, stop too wide 519.

| Months | Book since start | SPY since start | Excess | Max drawdown | Comparator max drawdown | Closed trades | Stop-outs | Net per trade | Avg exposure |
|---|---|---|---|---|---|---|---|---|---|
| 118 | 4.1% | 225.2% | -221.1% | -5.8% | -24.8% | 103 (10 a year) | 82 | 0.8% | 6.4% |

Calendar years (book, comparator): 2017 2.6% vs 17.3%; 2018 -3.4% vs -6.3%; 2019 -0.6% vs 28.8%; 2020 -1.1% vs 16.2%; 2021 1.5% vs 27.0%; 2022 0.0% vs -19.5%; 2023 2.7% vs 24.3%; 2024 4.7% vs 23.3%; 2025 -2.3% vs 16.4%; 2026 0.1% vs 8.5%

## Pre-registered pass rule

1. Net return per trade above zero: yes. 2. Book return above the comparator scaled by average exposure (14.5%): no. 3. Max drawdown no worse than 1.5x the comparator's (-37.2%): yes. 4. At least 30 closed trades a year: no. **Result: FAIL (US run is an implementation check, never evidence).**

**Labels.** Survivor bias is heavy (all stored US symbols still trade, so failed IPOs are absent); no opens are stored, so fills use the fill session's close; first appearances include spin-offs, SPAC mergers and ticker changes; the market light is the comparator index against its own 200-session average (no light history is stored); costs include an extra 0.6% round trip; cash earns nothing.
