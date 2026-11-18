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

Validation result (one run, 35% trail, signals 2018-01-01 to 2023-12-29): 1,921 trades, mean net +25.3% (best two removed +24.0%), median -2.5%, 42% winners, excess over Nifty 500 +12.5 points, years positive 4 of 6 (2018 -12%, 2019 -10%, then +51%, +21%, +36%, +37%). Meets the validation bar. These are overlapping trades with no capital limit, so this is an event result, not a book.

## Addendum 2 (18 Nov 2026): portfolio replay, registered before the run
Rule as validated (35% trail), unchanged. Book: at most 20 names, each sized at 5% of current equity at entry, signals taken in order of 126-session return when slots are short, no leverage, cash earns nothing, cost 1.3% per round trip, marked daily on closes. One run, all signals 2011-01-03 to 2023-12-29, positions marked through the last stored close; reported for the whole span, for 2011–2017 and for 2018–2023 starts separately (two runs of the same book from each half start, equity reset), against Nifty 500 over the same dates.
Bar to propose a paper book: beats Nifty 500 CAGR in both halves; worst drawdown no worse than 35%; average invested fraction reported beside the result (comparator held at the same fraction, as in the other event books).

Portfolio result (20 names x 5%): whole span CAGR 8.3% vs Nifty 500 12.9%, max drawdown -48% vs -38%; 2011–17 start 10.1% vs 10.5% (DD -40% vs -21%); 2018–23 start 2.4% vs 12.0% (DD -48% vs -38%). 254 of 2,929 signals were taken (slots full 87% of the time), so the book mostly held the most stretched names. Fails the bar.

## Addendum 3 (18 Nov 2026): one sizing variant, registered before the run
The event edge is spread over many trades; 20 slots capture under a tenth of them. One variant, sizing only, signal order unchanged: at most 50 names, 2% each. Same span, same three starts, same bar. If it fails, the study is closed. Family of 2 for the portfolio step noted.

Sizing variant result (50 names x 2%): whole span CAGR 12.2% vs Nifty 500 12.9%, max drawdown -51% vs -38%; 2011–17 start 13.0% vs 5.5% (DD -27% vs -38%); 2018–23 start 6.2% vs 11.9% (DD -34% vs -38%). Fails the bar (loses to Nifty 500 in the later half and over the whole span; whole-span drawdown above 35%). Study closed: the event-level edge does not turn into a book that beats the index.

## Addendum 4 (18 Nov 2026): exit family, registered before the run (owner: "the issue is in when the strategy is exiting, not in how it is selecting")
Evidence from the stored IPO first-breakout events (descriptive): of 82 validation-sample trades, 46 never reached +20% and lost 16% on average; 24 peaked between +20% and +100% (average peak +53%) and a 25% trail captured about 3% of that; the 12 that reached 2x were kept well (82% captured of a 176% peak). So the leak is real in the middle group, and entries that never work cannot be fixed by any exit.
Test on the trend-leader entry (unchanged), exits only. Control: 35% trail. Family of 3 new exits, close-based, filled at next open, cap 780 sessions, cost 1.3%:
- lock: stop = highest of (entry x 0.80), (entry once any close has been 25% above entry), (highest close x 0.65).
- dead: exit if the close 60 sessions after the signal is below entry x 1.10; otherwise the 35% trail.
- atr: stop = highest close since entry minus 3 x the 20-session average true range.
Fit on signals 2011-01-03 to 2017-12-29: event study and the 50 x 2% portfolio replay (start of the discovery span). Selection: among rules whose discovery portfolio max drawdown is at most 30%, the highest mean net per trade with the best two trades removed; if none qualify, the study closes. Then one validation run on signals 2018-01-01 to 2023-12-29 (event and 50 x 2% portfolio, whole-span start 2018). Disclosure: the 2018–2023 sample was already opened once for the 35% trail; this is a second look at it, so a pass is read as weaker evidence and goes to a paper book only (no live money exists in this system anyway). Pass bar: portfolio CAGR above Nifty 500 CAGR over the same dates, worst drawdown at most 35%, at least 150 events, excess over Nifty 500 per trade at least +5 points.

Exit family, discovery result (signals 2011–2017; docs/replay/TREND-LEADERS-exits-discovery.md): per-trade mean net with the best two removed: 35% control +12.0%, lock +9.7%, dead +6.9%, atr +2.5%. Portfolio 50 x 2% from the discovery start: control 13.0% a year (max drawdown -27%), lock 14.9% (-28%), dead 16.2% (-23%), atr 11.6% (-21%). All three new rules have a drawdown at most 30%, so the registered selection picks the highest per-trade mean ex best two: lock. No exit beat the control per trade; lock helped the portfolio by under two points a year. Carried to one validation run: lock.
