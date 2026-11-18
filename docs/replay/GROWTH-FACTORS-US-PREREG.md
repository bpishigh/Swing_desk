# Growth combo in the US as a confirmation test — registered 19 Nov 2026, before any run

Does the India finding (cheap price + strong 6-month return + rising traded value) show up in a different market? US books are a confirmation market (C-179). Paper only; not financial advice.

## Setup
- Data: data/us/hist (2,310 symbols, history from late 2016), bars are close, high, low, volume; survivors only (names still listed), so every rate is inflated and the test is lift against the same-market base rate, not the level. No opens, so no portfolio replay here.
- Same definitions as docs/replay/GROWTH-FACTORS-PREREG.md: month-end universe of stocks with 20-session average traded value of at least $2 million (about the same real size as Rs 2 crore plus margin) and enough history; outcomes: 3x within 756 sessions, 5x, 12-month return; the same 13 price/volume factors (delivery % does not exist here).
- Rule under test, frozen from India (no US tuning): bottom fifth of price AND top fifth of 126-session return AND top fifth of traded-value trend, ranked inside the US universe on each month-end.
- Samples: month-ends 2017-10 to 2020-12 (first half) and 2021-01 to 2023-11 (second half). Both are reported; neither is used to tune anything.

## Bar
- Combined rule lift in the 3x rate of at least 1.5x in each half, with at least 150 stock-months in each, and the 12-month median above the all-stock median in each half.
- Also reported: the single-factor table for context (13 factors, no selection from it).
- Pass: the finding replicates in the US (confidence in the India book goes up). Fail: it does not; the India result is read as local or as a small-cap/size effect, and the book stays a paper record. Neither outcome changes the India book's rules.

## Result (19 Nov 2026, one run per half, rule frozen from India)
First half (2017-10 to 2020-12): 1,144 stock-months, 3x rate 38.0% against 11.7% for all US stocks (lift 3.25), 5x 20.3%, 12-month median +22.4% against +9.9%; above base in all 4 years. Second half (2021-01 to 2023-11): 1,379 stock-months, 34.8% against 10.4% (lift 3.36), 5x 16.1%, 12-month median +12.2% against +2.2%; above base in all 3 years. Meets the bar in both halves: the finding replicates in the US.
Reading: single factors agree on the main drivers (low price lift 2.1x and 2.3x in the cheapest fifth, 6-month return 1.4x to 1.5x, traded-value trend 1.3x to 1.5x). Cautions: survivors only (rates inflated, lift is the evidence); the 3x-in-three-years outcome favours volatile stocks mechanically (the highest-volatility fifth has lifts of 2.3x to 2.8x but a lower 12-month median), so lift on the 3x outcome overstates what a portfolio earns; there are no opens, so no costs or portfolio replay were run for the US.
