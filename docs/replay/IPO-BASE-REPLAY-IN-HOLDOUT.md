# IPO base breakout replay: IN-HOLDOUT

Run 2026-11-17, sessions 2011-01-03 to 2019-12-31. One run, rule as built, no tuning (docs/replay/IPO-BASE-PREREG.md). Paper only; not a financial adviser.

IPO list: 1668 names; signals logged 250, bought 30; skipped for no slot 0, stop too wide 168.

| Months | Book since start | Nifty 500 since start | Excess | Max drawdown | Comparator max drawdown | Closed trades | Stop-outs | Net per trade | Avg exposure |
|---|---|---|---|---|---|---|---|---|---|
| 87 | 0.4% | 119.2% | -118.7% | -3.9% | -19.5% | 30 (4 a year) | 27 | 0.4% | 1.6% |

Calendar years (book, comparator): 2012 0.2% vs 5.3%; 2013 0.0% vs 3.6%; 2014 0.0% vs 37.8%; 2015 0.0% vs -0.7%; 2016 0.1% vs 3.8%; 2017 3.9% vs 35.9%; 2018 -2.4% vs -3.4%; 2019 -1.2% vs 7.7%

## Pre-registered pass rule

1. Net return per trade above zero: yes. 2. Book return above the comparator scaled by average exposure (1.9%): no. 3. Max drawdown no worse than 1.5x the comparator's (-29.2%): yes. 4. At least 30 closed trades a year: no. **Result: FAIL.**

**Labels.** India 2020 to 2026 prices have been seen in other tests (not for this rule); the IPO list uses the entity table, built with later knowledge; relistings and demergers can look like listings; the market light is the comparator index against its own 200-session average (no light history is stored); costs include an extra 0.6% round trip; cash earns nothing.
