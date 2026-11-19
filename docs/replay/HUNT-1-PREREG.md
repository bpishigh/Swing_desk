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

## Results (19 Nov 2026; one run per sample, no amendments, no voids)
Discovery 2011-2018 (event level, net of 1.3%): M1 n 2,019 excess +9.8 pts, 6/8 years; M2 1,357 +14.4, 7/8; M3 1,525 +16.8, 7/8; M4 220 +14.8, 7/8. All four pass. S1 -1.7, S2 -0.8, S3 -2.1, S4 -1.0 pts excess, positive in 1-2 of 8 years: all four swing rules fail discovery and were not taken to validation.
Validation 2019-2026-06: M1 n 3,817 +16.6 pts, 7/8 years; M2 1,820 +20.8, 7/8; M3 3,260 +18.6, 6/8; M4 465 +12.6, 5/8. All four pass the pre-registered bars. Ex-best-2 means stay within 1-3 points of the mean; top-decile share 75-96%, i.e. the usual few-big-winners shape (median trade is -5% to +6%).
Descriptive portfolio replay (50 x 2%, 35% trail, cash idle, not a selection step): 2011-18 CAGR M1 15.4, M2 14.7, M3 16.5, M4 10.9 vs Nifty 500 8.9, maxDD -23/-28/-30/-23 vs -25. 2019-26 CAGR M1 10.2, M2 12.5, M3 14.1, M4 13.6 vs index 13.4, maxDD -32/-31/-32/-21 vs -38.
Reading: the event edge is real in both halves, but it is one effect (new highs in green markets, same family as the trend leaders), not four. As a portfolio with idle cash it matches the index in 2019-26 with a shallower drawdown; it does not beat the growth combo. Swing-horizon (9-15 session) versions of breakout, pullback, gap and oversold rules have no edge after 1.3% costs in India, which agrees with the swing ledger. Next tracks: US replication of M2/M3, an earnings-gap detector test, industry strength.

## US confirmation (registered 19 Nov 2026, before the run)
M1, M3, M4 unchanged (M2 not translated: its rupee liquidity band has no US equivalent). Universe tv20 >= $2m, cost 0.4% round trip, green = SPY above 200-day mean, comparator SPY, signals 2017-10-02..2026-06-30 (one sample; the store starts 2016-10, so no discovery split). Fill uses the signal-day-plus-one close (no opens in the US store), which flatters nothing but blurs entry by a day. Survivors-only store: results are biased upward and read as a direction check only. Pass: n >= 100, excess > 0, at least half the years positive.

### US result (one run, no amendments)
M1 n 4,021 excess -7.0 pts (6/10 years); M3 n 4,374 +1.9 pts (8/10 years, but median trade -10%, top-decile share 132%); M4 n 1,545 -4.2 pts (6/10). By the registered bar M3 technically passes (excess > 0, 8/10 years) but with a +1.9 point margin on a survivors-only store, which flatters it; M1 and M4 fail. Portfolio replay (label "Nifty500" in the output is SPY here): CAGR M1 5.0, M3 8.5, M4 9.0 vs SPY 13.1, maxDD about -30% vs -34%. Reading: the India new-high effect does not replicate in the US. In the US, buying 52-week highs in an up-trending market loses to simply holding SPY. No US paper book from this. India-only edge, consistent with the earlier US growth-combo finding that US needs different rules.

## Paper books (19 Nov 2026, owner go): HL-1 (M3) and HL-2 (M4), India
Frozen from the rules above, no tuning: daily signal, Nifty 500 above its 200-session mean (research gate; house light used only if index history is missing), 2% x up to 50 names, 35% trailing stop on closes with no time limit, next-open fill, 126-session re-entry gap, comparator Nifty 500, start after 2026-11-19. Two departures from the research, both disclosed: names with a one-day move over 40% in the last 126 sessions are skipped, and there is no 780-session cap. Code src/engine/new-high-leaders.ts, books bc-hl-m3 and bc-hl-m4. First check at 6 months: number of signals, breadth of winners, drawdown against the Nifty 500, return against the comparator at the same invested fraction. Expectation from the replay: about the index in 2019-26 with a shallower drawdown; the US did not replicate, so this is India only.
