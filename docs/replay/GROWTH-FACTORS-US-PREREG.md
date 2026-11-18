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
