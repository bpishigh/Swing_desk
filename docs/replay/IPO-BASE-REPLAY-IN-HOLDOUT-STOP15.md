# IPO base breakout replay: IN-HOLDOUT-STOP15

Run 2026-11-17, sessions 2011-01-03 to 2019-12-31. One run, rule as built, no tuning (docs/replay/IPO-BASE-PREREG.md). Paper only; not a financial adviser.

IPO list: 1668 names; signals logged 250, bought 110; skipped for no slot 0, stop too wide 8.

| Months | Book since start | Nifty 500 since start | Excess | Max drawdown | Comparator max drawdown | Closed trades | Stop-outs | Net per trade | Avg exposure |
|---|---|---|---|---|---|---|---|---|---|
| 94 | -8.4% | 130.9% | -139.3% | -12.1% | -19.5% | 109 (14 a year) | 97 | -2.0% | 5.1% |

Calendar years (book, comparator): 2011 -0.8% vs 9.3%; 2012 -1.8% vs 2.0%; 2013 0.3% vs 45.0%; 2014 -0.6% vs -3.4%; 2015 -1.3% vs 5.9%; 2016 -3.3% vs 29.3%; 2017 5.1% vs -0.5%; 2018 -7.7% vs 7.7%; 2019 -0.9% vs 0.6%

## Pre-registered pass rule

1. Net return per trade above zero: no. 2. Book return above the comparator scaled by average exposure (6.7%): no. 3. Max drawdown no worse than 1.5x the comparator's (-29.2%): yes. 4. At least 60 closed trades in total (candidate rule, see the addendum): yes. **Result: FAIL.**

**Labels.** India 2020 to 2026 prices have been seen in other tests (not for this rule); the IPO list uses the entity table, built with later knowledge; relistings and demergers can look like listings; the market light is the comparator index against its own 200-session average (no light history is stored); costs include an extra 0.6% round trip; cash earns nothing.
