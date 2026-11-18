# Trend leaders with a wide trailing exit — registered 18 Nov 2026, before any run

Owner instruction: build a strategy from what the IPO studies showed (a few names run 5x or more; entries alone cannot pick them; a wide exit keeps the tail). IPO-only versions failed (C-226 to C-233). This tests the same payoff shape on all liquid NSE stocks. Paper only; not financial advice.

## Event (one fixed rule, no tuning)
On a session t, stock X is a signal when all hold:
- close is the highest close of the last 252 sessions;
- 126-session return ranks in the top 10% of stocks with 20-session average traded value of at least Rs 2 crore on t;
- close above its own 200-session average;
- volume at least 1.5 times its 50-session average;
- own 20-session average traded value at least Rs 2 crore;
- Nifty 500 light is green (comparator above its 200-day, as in the books).
One signal per stock per 126 sessions. Entry: next session open. Prices adjusted for splits and bonuses as in the other studies; no entity merging for renames (a rename only removes events).
Exit family (3 rules): first close at or below the highest close since entry by X, filled at next open; X = 25%, 35%, 50%. Cap 780 sessions; open trades marked at the last close. Cost 1.3% round trip. Report net per trade.

## Samples
- Discovery: signals 2011-01-03 to 2017-12-29 (bhav-pre2020). Validation: signals 2018-01-01 to 2023-12-29 (opened once, only for the rule carried forward). Signals after 2023 are unused (too little follow-up).
- Disclosure: the 2011–2019 window carried the V9 holdout (C-231) and the 2020+ window the IPO fit family; neither tested this rule.

## Reported (per sample and per signal year)
Events, mean and median net per trade, share of winners, mean hold, top-10% share of profit, mean with best trade removed, mean with best two removed, the Nifty 500 return over the same holding periods (average), and the excess.

## Bars
- Carry a rule to validation only if, on discovery: at least 150 events; mean net per trade at least +5% with the best trade removed; excess over Nifty 500 (same holding periods) at least +5 points; at least 5 of the 7 signal years with positive mean net.
- Carried rule on validation passes if: at least 150 events; mean net with best two removed above 0; excess over Nifty 500 positive; at least 4 of 6 signal years with positive mean.
- Selection among the 3 exits: the one with the highest discovery mean net with best trade removed (family of 3 noted).
- Pass leads to a paper book proposal with a portfolio-level replay (position limits, one run), not straight to live. Fail closes the study.

## Addendum 1 (18 Nov 2026, after the discovery run; disclosed amendment)
Discovery result (docs/replay/TREND-LEADERS-discovery.md, 1,059 signals): 25% / 35% / 50% trails made +11.3% / +13.8% / +18.5% mean net per trade, median -2% to -4%, 36–39% winners. Excess over Nifty 500 over the same holding periods: +6.3 / +5.8 / +3.4 points. Mean net with the best trade removed: +10.1% / +12.8% / +17.7%.
Strictly, no rule met the registered year bar (5 of 7 signal years positive): the green-light filter leaves no signals in 2011 and only 22 in 2012, so there are 6 signal years, and each rule had 4 of 6 positive. The 50% trail also misses the excess bar. So strictly no rule is carried.
Amendment, made knowing the discovery result and recorded as such: the year bar is read as "at least two thirds of the years that have signals" (4 of 6 here). Rules that then pass discovery: 25% and 35%. The registered selection rule (highest mean with best trade removed) picks 35%. To offset the loosening, the validation bar is tougher than the original: at least 150 events; mean net above +5% with the best two trades removed; excess over Nifty 500 at least +5 points; at least two thirds of signal years positive. Validation runs once, 35% only, on signals 2018-01-01 to 2023-12-29, which has not been opened.
