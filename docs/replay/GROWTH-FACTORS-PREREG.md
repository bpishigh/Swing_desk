# What do stocks that grow have in common — registered 18 Nov 2026, before any run

Owner: "the strategy should be better at identifying stocks that will grow; see what common factors influence the stocks that grow". Price, volume and delivery data only (India has no earnings history to test). Paper only; not financial advice.

## Setup
- Universe on each month-end: NSE EQ stocks with 20-session average traded value of at least Rs 2 crore and at least 260 sessions of history. Prices adjusted for splits and bonuses; no rename merging.
- Outcome A: highest close in the next 756 sessions is at least 3x the month-end close ("grew exponentially"). Outcome B: highest close at least 5x. Outcome C: 12-month forward return (median and mean). Stocks that stop trading are measured to their last close.
- Factors (14, fixed): 12-1 month momentum; 6-month return; 3-month return; closeness to the 252-session high; 126-session volatility (daily return stdev); log 20-session traded value; traded-value trend (20-session value over the average of sessions t-250 to t-125); price level; 60-session average delivery %; 40-session range (high close minus low close over high close); up-day volume over down-day volume (50 sessions); age in sessions since first appearance; distance above the 200-session average; gain from the 252-session low.
- Each factor is ranked as a percentile among the universe on the same month-end, then cut into quintiles.

## Samples
- Discovery: month-ends 2011-01 to 2017-12 (36-month outcomes complete by Dec 2020). Validation: month-ends 2018-01 to 2023-11, opened once.
- Overlapping outcomes across months and stocks mean the counts are not independent; read lift, not significance.

## Reading rule
- Family of 14. A factor is useful if the top quintile (or bottom, stated by direction in discovery) has an Outcome A rate at least 1.5x the all-stock rate, the opposite quintile at most 1.0x, and Outcome C median is higher in the favourable quintile, in each of at least 5 of 7 discovery years.
- Carry at most the 3 useful factors with the largest lift into a combined rule: stock is in the favourable quintile of all of them on a month-end. Combined rule on discovery must show Outcome A lift at least 2x with at least 300 stock-months.
- Validation (once): combined rule needs Outcome A lift at least 1.5x, Outcome C median above the all-stock median by at least 5 points, with at least 300 stock-months, and a lift above 1 in at least 4 of 6 years.
- Pass leads to a registered entry rule for a portfolio replay; fail closes the question for price-only factors.
