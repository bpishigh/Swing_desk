# IPO base breakout replay: IN-HOLDOUT-STOP15-V9

Run 2026-11-17, sessions 2011-01-03 to 2019-12-31. One run, rule as built, no tuning (docs/replay/IPO-BASE-PREREG.md). Paper only; not a financial adviser.

IPO list: 1668 names; signals logged 62, bought 41; skipped for no slot 0, stop too wide 0.

| Months | Book since start | Nifty 500 since start | Excess | Max drawdown | Comparator max drawdown | Closed trades | Stop-outs | Net per trade | Avg exposure |
|---|---|---|---|---|---|---|---|---|---|
| 94 | 3.5% | 130.9% | -127.4% | -4.1% | -19.5% | 41 (5 a year) | 34 | 0.2% | 2.2% |

Calendar years (book, comparator): 2011 -2.3% vs 4.1%; 2012 -0.6% vs 8.0%; 2013 -0.5% vs 39.1%; 2014 -0.2% vs 1.0%; 2015 0.0% vs 11.1%; 2016 -0.0% vs 22.0%; 2017 5.9% vs -4.4%; 2018 -1.8% vs 10.7%; 2019 0.3% vs 1.9%

## Pre-registered pass rule

1. Net return per trade above zero: yes. 2. Book return above the comparator scaled by average exposure (2.9%): yes. 3. Max drawdown no worse than 1.5x the comparator's (-29.2%): yes. 4. At least 60 closed trades in total (candidate rule, see the addendum): no. **Result: FAIL.**

**Labels.** India 2020 to 2026 prices have been seen in other tests (not for this rule); the IPO list uses the entity table, built with later knowledge; relistings and demergers can look like listings; the market light is the comparator index against its own 200-session average (no light history is stored); costs include an extra 0.6% round trip; cash earns nothing.
