# HUNT-1 pre-registration (19 Nov 2026): multibagger and swing event studies, India
Written and committed before any run. Paper only, not advice. One run per rule on each sample. No re-testing spent data.

## Data and harness
scripts/lib/study-harness.mjs (split/bonus-adjusted closes, opens put on the adjusted scale, index spliced BSE 500 -> Nifty 500, cost 1.3% round trip, fill at next open after the signal close, universe tv20 >= Rs 2 crore).
Harness check: reproduces the trend-leaders event study to within a few percent (1,206 signals, +35.1% mean vs 1,059 and +33.2% earlier; difference is the index splice letting 2011-12 signals through). This does not decide anything.
Discovery signals 2011-01 to 2018-12. Validation signals 2019-01 to 2026-06 (validation opened once, only for rules that pass discovery). A name can signal again only after a 60-session gap (multibagger family 126).

## Family (8 rules, no others)
Multibagger family (hold with 35% trailing stop on closes, max 780 sessions; green house light = index above 200-day mean):
- M1 Base breakout: close at a 252-day high, volume >= 2x 50-day mean, 60-session range (high/low) <= 1.35, close above 200-day mean, green light.
- M2 Small-cap leader: M1 plus tv20 between Rs 2 crore and Rs 15 crore.
- M3 Relative-strength new high: close at a 252-day high, 126-session return in the top 10% of the liquid universe, green light, no volume rule.
- M4 Quiet new high: close at a 252-day high, 20-session average range under 60% of 100-session average range, close above 200-day mean, green light.
Swing family (hold 15 sessions, or 8% trailing stop on closes if hit first; no light filter):
- S1 20-day-high breakout: close above prior 20-day high, volume >= 1.5x 50-day mean, close above 50-day mean.
- S2 Pullback in uptrend: close above 200-day mean, 50-day mean above 200-day mean, 3 closes down in a row ending within 8% of the 60-day high, close below 10-day mean.
- S3 Gap-up on volume: open >= 4% above prior close, volume >= 3x 50-day mean, close above open.
- S4 Oversold bounce: close above 200-day mean, 5-session return <= -12%, close above prior close.
Selection (family-wide, same for all): a rule passes discovery if n >= 150, mean net excess over the index on the same dates >= +3.0 points for the multibagger family, >= +0.8 points for the swing family, mean excluding best 2 trades still positive in excess, and at least 60% of discovery years with positive excess. A rule passes overall if it also passes validation with n >= 100, excess > 0, and at least half the validation years positive. A pass means "worth a paper book", not tradable.
Reported for every rule regardless: n, mean net, median, winners, hold, ex-best-2, excess, years, top-decile share. Portfolio replay only for passers.

## Not in this run (declared)
Earnings-gap detector for setup 3 (separate, needs filings asOf). US version (only after an India pass). Industry strength. Lower liquidity floors.
