# C-65 India momentum x desk hybrid (18 Oct 2026)
Registered in the change log before running. Script `scripts/replay-ind-hybrid.mjs`; output `data/replay/ind-hybrid.json`.
Momentum list = C-54 rule unchanged (12-1 momentum, top decile of the 500 most traded names, first session of each month, index filter), 67 monthly lists, 54 invested months.

## H1: momentum names with an ATR stop and the desk's exits, paired against a 20-session hold (net of cost)
| Window | Trades | Hold: mean / wins / worst decile | Desk exits: mean / wins / worst decile | Difference | t |
|---|---|---|---|---|---|
| All | 1,936 | +2.39% / 51% / -12.1% | +1.00% / 37% / -6.9% | -1.40 pp | -2.19 |
| Fit 2021 to 2023 | 931 | +3.56% | +2.70% | -0.86 pp | -1.12 |
| C-54 holdout 2024 to Sep 2025 | 690 | +1.74% | -0.82% | -2.55 pp | -1.89 |
| Fresh Oct 2025 to Sep 2026 | 315 | +0.39% | -0.06% | -0.45 pp | -0.47 |
Profit rule fails (better in 0 of 3 windows). Risk rule fails as registered (tail +5.2 pp, mean -1.4 pp against a 0.25 pp limit). The 20 EMA trail ended 69% of trades; taking profit on thirds cost return (1.00% with, 1.60% without). Post hoc: return per session held about equal (0.11% vs 0.12%). Stops filled at the stop price, which flatters the exits.

## H2: momentum membership inside the C-64 desk trades
| Class | Momentum trades: n / mean R / return | Others: n / mean R / return | t |
|---|---|---|---|
| Valid | 22 / +0.93 / +4.1% | 18 / -0.33 / -1.7% | 1.81 |
| Room under 3R | 156 / +0.40 / +2.2% | 272 / -0.09 / -0.4% | 1.83 |
| Stop too wide | 315 / +0.08 / +0.8% | 409 / +0.04 / +0.3% | -0.68 |
| All | 493 / +0.22 / +1.4% | 699 / -0.02 / 0.0% | 1.70 |
Right direction in every class; no class meets t above 2. The one lead, not yet significant.
