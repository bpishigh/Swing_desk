# C-170 and C-171: pre-registration (written 12 Nov 2026, before the run)

Paper study on stored India prices. Not investment advice. One run, no tuning: the thresholds below are fixed here and the script is not changed after the run.

## Data
`loadIndia('data/india', { pre2020: true, allSymbols: true })`: stored sessions 2010 to the latest file, corporate actions resolved over the whole history, fully adjusted closes (what a holder earned). Delisted names are kept; a name with no close for the rest of the window counts at its last close.
Instruments are company shares only: series EQ or BE, and not a name matching BEES, ETF, LIQUID, GILT, NIFTY or SENSEX.

## Start events (both studies)
One start per eligible stock on the first session of each month, from January 2011 to the last month whose 5-year window the data covers (about November 2021). Eligible at the start: a close on the start date; at least 252 earlier sessions with a close; close of at least Rs 10; 20-session average traded value of at least Rs 10 lakh.
Outcome window: the close on the start date to the last close on or before the same calendar date five years later. Hit 3x or hit 5x: the highest close in the window divided by the start close reaches 3 or 5. A path is dropped and counted if any one-day change between consecutive closes in the window is 2.0 times or more, or 0.5 times or less (a split or consolidation the resolver missed would show up like this); dropped paths are reported by year.

## C-170 (base rate)
Share of start events hitting 3x and 5x: overall, by start year, by price band (under Rs 50, 50 to 200, 200 to 1,000, 1,000 and over) and by liquidity band (20-session average traded value under Rs 1 crore, 1 to 5 crore, 5 to 25 crore, 25 crore and over). 90% intervals from resampling start years. Reported only.

## C-171 (lift)
Features, known at the start date only:
- F1 near-high without MAX: close at least 90% of the highest close of the last 252 sessions, and not a MAX name (largest one-day return of the last 21 sessions in the top tenth of that month's eligible list).
- F2a to F2d: the four liquidity bands above, each against all start events of the same months.
- Size band: not tested. The store has no market capitalisation as of each start date, and today's Nifty lists would add look-ahead; this is stated in the report. Price bands are reported as information only.
Outcome: hit 5x. Lift = hit rate with the feature divided by the hit rate of all eligible start events.
Pooled interval: 4,000 resamples of start years, 90%. Per-year interval: 2,000 resamples of stocks within the year, 90%. A feature is called an effect only if its per-year lower bound exceeds 1 in at least 60% of start years (years with no 5x hit among all events count as not passing). Seed 20261112. Five features carry the effect call (F1 and F2a to F2d); that count is reported next to every result because five readings were taken.
