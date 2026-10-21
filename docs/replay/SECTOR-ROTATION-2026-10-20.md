# Sector rotation sleeve vs the Nifty 500: C-75 (20 Oct 2026)

**Question.** When should sector funds be held? Each month-end a sector qualifies if its 63-session return beats the Nifty 500's, is above zero, and its close is above its 50-session average. Qualifiers are ranked by 2 x 3-month + 1-month return; the top two are held equal-weight; none qualifying means the Nifty 500. Registered as C-75-r1 before running; script `scripts/replay-sector-rotation.mjs`; result `data/replay/sector-rotation.json`.

**Setup.** 15 NSE sector price indices with history from 2020 and the Nifty 500 (price indices). Trade at the next close, 0.30% of traded value, plus 0.30% a year expense drag on the sector arm. Fit 1 Jan 2020 to 31 Dec 2023 (907 sessions from Apr 2020, after the 63-session warm-up); holdout 1 Jan 2024 to 16 Oct 2025 (hidden). The test stops at 16 Oct 2025 because the stored series has a gap to 30 Nov 2025.

**Result (fit only).**

| | Nifty 500 | Sector sleeve | Difference |
|---|---|---|---|
| Annual return after 0.30% cost | 29.32% | 28.34% | -0.98pp |
| Annual return at double cost | 29.32% | 22.91% | -6.41pp |
| Maximum drawdown | -18.5% | -36.7% | 18.2pp worse |

Bars: at least +2.0pp, drawdown within 3pp, ahead in 3 of 4 calendar years. **FAIL.** The sleeve was ahead in 3 of 4 years at the lower cost, but only by 0.3pp, 1.1pp and 16.5pp, while 2020 lagged by 39pp. The ranking favours the sectors that have just risen most (metals, PSU banks, realty), which fall hardest in reversals; the drawdown doubled. Turnover about 150 times the start value: the picks change almost every month.

**Limits.** One cycle that starts at the 2020 low, so the Nifty 500 baseline of 29% a year is unusually high. Price indices, not funds. Tax on the extra trading is not modelled. Re-run on the longer history after 1 Nov before treating it as settled.

**Decision.** No sector rule. Sector and thematic funds stay at 0% in the presets; the Custom profile remains the way to hold them as a user's own choice.
