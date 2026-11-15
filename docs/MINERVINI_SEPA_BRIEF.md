# Minervini SEPA work: brief for review

Date: 16 Nov 2026. Paper only; not a financial adviser. Written for an outside reviewer. Everything below is in the repo (`bpishigh/Swing_desk`) and the Trading project; file names are given so each claim can be checked.

## 1. What was asked and what was done
The owner asked for a strategy "exactly like Minervini's, no differences". Two books exist:
- **bd-m1-minervini (C-216, running):** his eight-test trend template only, every passer held at 1%, monthly review. Renamed "Trend template screen" because it is the screen, not his method.
- **bd-m2-sepaflat (C-218, now PAUSED):** his flat-base setups only, built on the owner's "go" 15 Nov 2026 and paused by the owner 16 Nov after two negative replays. Code, tests and logs are kept.

## 2. Where the rules come from, and the main limit
The rule wording is the owner's source sheet (`docs/MINERVINI_SEPA.md` v3): a reviewer's extraction of *Trade Like a Stock Market Wizard* (2013) and *Think & Trade Like a Champion* (2017), marked "not an approval". **The builder never saw the book text.** Any error in the sheet is in the build. A spot check of the figures against the books is the single most useful review step.

## 3. Rules built (C-218)
- **Stock:** eight trend tests (low test 25%, Book 2); RS rank at least 70 (desk calculation: weighted four-quarter return, percentile across stored stocks, not his published ranking); latest quarter's profit up at least 25% year on year with the two before it above zero (missing figure = no signal).
- **Setup:** flat base 20 to 35 sessions, at most 15% deep, after a 30% rise, volume in the 10 sessions before below the 50-session average.
- **Buy:** first close above the base top, at most 5% above, on volume at least 150% of the 50-session average.
- **Size and stop:** risk 1.25% of the book per trade; stop at the base low, at most 10% below the fill; position at most 25%; six names; no cash, no trade.
- **Exits:** stop tested on the daily low; sell half at twice the stop distance then breakeven; the rising 50-day average becomes the stop once at or above entry; a one-day fall larger than any since the 52-week low sells at the next open.
- **Left out:** market gate (neither book gives one), ROE and institutional holding (not in his books), contraction (VCP) bases, the manual review, comparison with past winners, earnings surprises, reading charts by eye.
- **Desk figures, not his:** 150% volume, 5% distance, stop at the base low, RS calculation, the 52-week-low reading of "largest fall since stage 2", 25% earnings floor (his range is 20% to 25%), six names (his range is 4 to 8).

## 4. Results (all in `docs/TEST_REGISTER.md`, rows C-217 to C-220)
| Run | What it showed |
|---|---|
| C-217 holdout, trend-template book, 2011–2019 | Control +5.5% vs Nifty 500 +130.9%. Three candidate changes all failed the pre-registered rule and were dropped. |
| Count of contraction bases (SEPA-COUNT) | 0 to 7 breakout name-days a year, 2012–2026. The desk's 2% swing filter splits bases into seven or more swings, so this is probably a measuring fault; no conclusion on the pattern. Parked. |
| Count of flat bases (SEPA-FLAT-COUNT) | 17 to 38 trades a year taken in 2021–2025 on a six-slot calendar with assumed exits; pre-set line of 20 met in 4 of 5 years. Counts only. |
| C-219 replay, 2021–Nov 2026, one run | Book -18.8% vs Nifty 500 +78.2%, drawdown -33.1%. 194 full exits: 32.5% winners, average win +19.7%, average loss -9.1%, about +0.3% per trade before costs. |
| C-220 stop holdout, 2012–2019, price-only | 10% control -75.7% (net -3.8% per trade, 345 trades, 7 of 8 years negative); 7% stop -83.3%. Pre-registered pass rule failed; 7% dropped. |

Labels on all replays: survivor bias (delisted names mostly missing), cash earns nothing, prices 2020–2026 seen before, one market era per window.

## 5. Mistakes made and corrected
- The C-219 write-up said "79% stopped out"; it was a miscount (194 full exits over 246 legs including 52 half sales). Corrected in the register and `docs/replay/sepaflat/DIAGNOSTIC.md`.
- A first C-220 run printed zero trades because the wide stock list was not built for the new books. It was void, read for nothing and re-run after the fix.
- A contraction-base bug (the flat-base check hid a valid contraction base) was fixed before the count.
- The card's wording "the register's own results predict no edge" was stronger than the evidence; the accurate wording is "no evidence of an edge".

## 6. Honest reading
Two negative replays on different eras, no positive evidence, and a diagnostic showing the 10% stop cap binds on most trades (median loss -10.0% against his published 5% to 7% average). A tighter stop did not help. The one thing not tested is whether the setup, as he actually trades it (judgment, group leadership, by-eye bases), differs from what can be coded; the sheet itself lists those as not codable.

## 7. Questions for the reviewer
1. Do the figures on the source sheet match the books (flat base 10% to 15% and 4 to 7 weeks; the 25% low; stop and half-sale rules; the 50-day rule)?
2. Is "stop at the base low, capped at 10%" a fair reading of his stop placement, or does he place stops by percentage below the buy?
3. Is "largest one-day fall since the 52-week low" a fair coding of his exit?
4. Should the contraction counter be tried by his method (deepest fall first, no percentage filter) on his worked examples? Those need price files for NFLX (2009) and MELI (2007), which the desk does not hold.
5. Is the RS calculation close enough to his published ranking to matter?

## 8. State now
bd-m2-sepaflat paused (startAfter 2099-12-31); bd-m1-minervini running; contraction bases parked; pre-registration `docs/SEPA_STOP_PREREG.md` closed (failed). Nothing else is pending on this package.
