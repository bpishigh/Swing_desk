# Minervini book: holdout test of three candidate changes (pre-registration, C-217)

Registered 15 Nov 2026, before any run, at the owner's word ("yes all three"). Paper only. Not a financial adviser. Written to `claude/strategy-build-standard.md`.

**Why a holdout.** The C-216 replay used 2021 to 2026 prices, which have been seen. Any change tuned on them would be partly fitted to them. The stored prices from 2010 give a period this book has never been run on: **1 Jan 2011 to 31 Dec 2019** (the first 260 sessions are needed for history). Each candidate runs **once** there, next to the unchanged book as the control, in one pass. No other runs, no changed settings after the first look.

**Candidates (three, fixed now).** Everything else is exactly C-216.
- **G, market gate.** At each monthly review, if the Nifty 500 closes below its own 200-day average, sell every holding and buy nothing; otherwise as the control. Targets the drawdowns of weak markets.
- **B, exit buffer.** A held name that fails the template is sold only if it also failed at the previous review (two failed reviews in a row); a name that passes again resets the count. New buys as the control. Targets turnover and sell-then-rebuy churn.
- **V, the registered variant.** 200-day average rising over 84 sessions (4 months) instead of 21, and relative-strength rank at least 80 instead of 70.

Counted as three rules tried (C-179 counts once across markets), plus the control.

**Pass rule (fixed before the run).** A candidate goes to a forward paper book next to the control only if, on the holdout, all of these hold:
1. Total return since start beats the control's.
2. Maximum drawdown is smaller (less negative) than the control's, except for B, where the second test is fewer closed trades a year than the control instead.
3. Its excess over the Nifty 500 is positive.
A candidate that fails any of them is dropped and not re-tried on this period. The control keeps running unchanged in any case.

**Labels on the result.** (1) Survivor bias is heavy: names that were delisted before 2026 are mostly absent (the company list is today's), so absolute returns lean favourable; the comparison between candidate and control is the point. (2) Cash earns nothing in the replay. (3) Prices before 2020 come from the older stored files; split handling uses the stored corporate-action history from 2010. (4) A pass here is permission to paper-trade forward, not evidence of an edge.
