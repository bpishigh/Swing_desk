# Tactical tilt of asset-class weights: C-74 (20 Oct 2026)

**Question.** Should the allocation follow market performance? Each month-end a risk sleeve (equity, international, gold, silver) is over-weighted by a bounded fraction tau (Cautious 0.25, Balanced 0.35, Aggressive 0.50) when its price is above its 200-session average and its 126-session return is positive, and under-weighted by tau otherwise, the difference moving to or from debt. Compared with the same strategic weights rebalanced monthly. Registered as C-74-r1 before running; script `scripts/replay-tactical-tilt.mjs`; result `data/replay/tactical-tilt.json`.

**Setup.** Proxies: Nifty BeES (equity), MON100 (international), Gold BeES, Silver BeES (from May 2022, folded into gold before), debt a fixed 6% a year. Strategic weights from the allocation engine at a 10-year horizon. Each sleeve held inside its limit (equity: the profile's 30-year equity share). Trade at the next close, 0.30% of traded value, both arms. Fit 18 Jun 2021 to 28 Mar 2024; holdout 1 Apr 2024 to 19 Oct 2026 (hidden).

**Result (fit only, annual return after costs, tilt minus static).**

| Profile | 0.30% cost | 0.60% cost | Drawdown, static / tilt (0.30%) |
|---|---|---|---|
| Cautious | -0.49pp | -0.86pp | -6.5% / -5.9% |
| Balanced | -0.80pp | -1.46pp | -9.6% / -9.6% |
| Aggressive | -2.00pp | -2.84pp | -12.1% / -10.8% |

Balanced bar: at least +1.0pp with no deeper drawdown and ahead in 2 of 3 yearly blocks. **FAIL**; no profile meets the bars. Balanced by yearly block: +1.8pp, -7.4pp, +4.2pp. The middle year (Jun 2022 to Jun 2023) is where trend signals flipped repeatedly in gold, silver and international and the tilt lost more than the other two years earned. Tilt turnover was about 12 times the starting value against 1.8 for static.

**What it does not show.** One cycle of about 5 years; 2.7 of them in the fit. The signal is one simple trend rule, not every way of following performance. Tax on the extra trading is not modelled (it would only make the tilt look worse). The holdout was not revealed because the fit failed. Re-run with the longer India history due after 1 Nov before treating this as settled.

**Decision.** No tilt is added to the allocation. Targets stay as set by risk profile and horizon.
