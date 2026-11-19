# VALUE-1: "extremely valuable but cheap" — registered 19 Nov 2026, before any run
Owner: "add to this where we identify stocks that are extremely valuable but cheap to get; this should also come from historical trends." Paper only; not advice.

## Data and its limits
India only. Quarterly results from data/india/filings with broadcast times (as-of, no look-ahead), figures through src/engine/fundamentals-asof.ts exactly as the nightly table builds them; market cap = RAW close on the day (not the back-adjusted close; see GROWTH-FACTORS-PREREG addendum RAWPRICE) times the share count of the filing, with splits dated on or before the day only. Month-ends 2017-07 to 2023-11 (four quarters of results needed; 756-session outcome window). Liquid group: 20-session traded value >= Rs 2 crore, raw price >= Rs 20.
Limits, stated now: (1) the filings list covers names still listed more completely than names that later vanished (see BATCH-A-REPLAY labels), so cheap-and-failed companies are under-represented and every value result is an upper bound; the evidence read is lift against the covered-stock rate, not a level. (2) Balance sheets only exist from Sep 2022, so no price-to-book, no net-debt enterprise value and no return on capital in this run. (3) The US cannot be done: its bars are adjusted to today and carry no raw prices, so market cap would be wrong (the US nightly table blocks split-like names for the same reason).

## Factors (computed per stock per month-end, non-null only; quintile cut points inside the covered stocks of that month-end)
EY earnings yield (TTM profit after tax / market cap); SY sales yield (TTM revenue / market cap); BY EBIT yield (TTM operating EBIT / market cap); GR revenue growth (TTM over TTM a year earlier); MG pre-exceptional profit margin (TTM pbtPre / TTM revenue); IC interest cover.
## Combinations (frozen now, nothing else is tried)
V1 cheap, growing, profitable: EY top fifth AND GR >= 10% AND MG at or above the covered median.
V2 cheap quality: EY top fifth AND EBIT margin top half AND IC >= 3 (non-financial only).
V3 growth at a low price: SY top fifth AND GR top half AND MG > 0.
## Outcomes
A: close at least 3x within 756 sessions; B: 5x; 12-month return (median and mean) minus the median of all liquid stocks that month ("excess").
## Bar (each half separately; halves: month-ends 2017-07..2020-12 and 2021-01..2023-11)
Combination: n >= 150 stock-months, A-rate lift >= 1.5 against the covered-stock rate, 12-month median above the covered median, mean excess > 0, and at least half the calendar years in the half with positive median excess. Single factors: reported only (top and bottom fifth lifts), no selection from them.
Pass: both halves meet the bar for the combination. A pass means "worth a paper book", read with the survivor limit above. The halves are not independent of 2020 (second half carries the rebound); the 2020 months are also reported on their own.
