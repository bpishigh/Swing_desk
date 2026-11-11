# C-170 base rates and C-171 lift (India, price only)

Run once on 12 Nov 2026 under docs/replay/C170-C171-PREREG.md. Data: 4180 sessions, 2010-01-04 to 2026-11-11, 4435 symbols, snapshot b1870fc60668. Paper study; not investment advice.

Start events: 121662 eligible stock-months from 131 monthly starts (Jan 2011 to 2021-11); 119997 kept; 1665 paths dropped for a one-day change of 2x or more (see the table by year).

## C-170: base rates

Reaching 3x within five years: 35.71% (90% interval 28.59% to 43.61%). Reaching 5x: 16.92% (12.10% to 22.45%). Intervals come from resampling the 11 start years, so they say how much the answer depends on when you started.

| Start year | Events | Hit 3x | Hit 5x | Dropped |
|---|---:|---:|---:|---:|
| 2011 | 8768 | 24.78% | 10.23% | 312 |
| 2012 | 8357 | 33.48% | 15.20% | 253 |
| 2013 | 7897 | 46.21% | 23.52% | 179 |
| 2014 | 9698 | 35.99% | 15.18% | 155 |
| 2015 | 10692 | 23.07% | 8.55% | 166 |
| 2016 | 11859 | 24.65% | 8.97% | 183 |
| 2017 | 13010 | 21.00% | 7.96% | 103 |
| 2018 | 12981 | 22.53% | 8.72% | 79 |
| 2019 | 11521 | 50.07% | 25.58% | 74 |
| 2020 | 11724 | 68.01% | 40.66% | 90 |
| 2021 | 13490 | 44.14% | 21.85% | 71 |

| Price band at start | Events | Hit 3x | Hit 5x |
|---|---:|---:|---:|
| under Rs 50 | 27361 | 45.83% | 27.57% |
| Rs 50 to 200 | 46613 | 38.23% | 17.95% |
| Rs 200 to 1,000 | 35928 | 27.95% | 10.53% |
| Rs 1,000 and over | 10095 | 24.30% | 6.01% |

| Liquidity band at start (20-session traded value) | Events | Hit 3x | Hit 5x |
|---|---:|---:|---:|
| under Rs 1 crore | 41659 | 43.12% | 23.38% |
| Rs 1 to 5 crore | 33960 | 35.99% | 17.15% |
| Rs 5 to 25 crore | 23440 | 32.82% | 13.52% |
| Rs 25 crore and over | 20938 | 23.77% | 7.51% |

## C-171: lift on reaching 5x

Lift is the feature's 5x rate over the 5x rate of all eligible start events. An effect is called only if the per-year lower bound exceeds 1 in at least 60% of start years. Five features carry the call, so one of them passing by luck is plausible; weigh that.

| Feature | Events | 5x with feature | 5x overall | Lift | Pooled 90% interval | Years passing | Called |
|---|---:|---:|---:|---:|---|---:|---|
| F1 near the 52-week high, MAX names excluded | 31341 | 13.01% | 16.92% | 0.77 | 0.63 to 0.93 | 0 of 11 | no effect called |
| F2 liquidity under Rs 1 crore | 41659 | 23.38% | 16.92% | 1.38 | 1.32 to 1.48 | 11 of 11 | EFFECT |
| F2 liquidity Rs 1 to 5 crore | 33960 | 17.15% | 16.92% | 1.01 | 0.96 to 1.07 | 2 of 11 | no effect called |
| F2 liquidity Rs 5 to 25 crore | 23440 | 13.52% | 16.92% | 0.80 | 0.68 to 0.87 | 0 of 11 | no effect called |
| F2 liquidity Rs 25 crore and over | 20938 | 7.51% | 16.92% | 0.44 | 0.34 to 0.50 | 0 of 11 | no effect called |

Information only (not part of the call):

| Feature | Events | Lift | Pooled 90% interval | Years passing |
|---|---:|---:|---|---:|
| Price under Rs 50 (information only) | 27361 | 1.63 | 1.57 to 1.70 | 11 of 11 |
| Price Rs 50 to 200 (information only) | 46613 | 1.06 | 1.01 to 1.12 | 4 of 11 |
| Price Rs 200 to 1,000 (information only) | 35928 | 0.62 | 0.55 to 0.67 | 0 of 11 |
| Price Rs 1,000 and over (information only) | 10095 | 0.36 | 0.29 to 0.44 | 0 of 11 |

Per-year lift for each feature is in data/replay/c170-c171.json.

## Limits

- Size band was not tested: no market capitalisation as of each start date is stored (stated in the pre-registration).
- Monthly starts overlap in time, so events are not independent; the interval resamples whole years for that reason.
- Survivorship: delisted names are included at their last close, but the price files may miss some delistings; the true base rate for the whole market could be lower.
- Corporate-action resolution is the desk's own; paths with a one-day move of 2x or more are dropped, which also drops real jumps (counted by year above).
- Price only: dividends are not counted.

## Reading (written after the run; not part of the pre-registered call)

- About one stock in three reached 3x at some point in five years, and about one in six reached 5x. The measure is the highest close in the window, not the close at the end, so it overstates what a holder kept; and the windows that start in 2019 to 2021 (the 2020 to 2025 rise) carry far higher rates than the 2015 to 2018 starts. Any multibagger claim should be set against that spread of 8% to 41% for 5x by start year, not against the average.
- The only feature called an effect is the thinnest liquidity band (traded value under Rs 1 crore a day), which is below the desk's own floor of Rs 5 crore (C-160 shared terms), so it is not a stock the books can hold. Within the bands the books can trade, no feature is called: Rs 5 to 25 crore and Rs 25 crore and over have lift below 1.
- Near the 52-week high, with MAX names excluded, has lift 0.77 (0 of 11 years above 1): such stocks reached 5x less often than all eligible stocks. This is a measure of reaching 5x from the start date, which is not the same question as whether a momentum book earns more than its comparator; it does not test C-161.
- Price follows liquidity: names under Rs 50 had lift 1.63. Cheap and thinly traded names are the same names, so the two readings are one finding.

