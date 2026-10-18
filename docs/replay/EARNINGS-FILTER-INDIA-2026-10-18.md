# C-60 India run-up filter test (18 Oct 2026)
Owner request: find an extra filter that lifts both win rate and average return of the C-59 trade. Pre-registered in the change log before running: 8 fixed filters, winner picked on the fit window only, judged once on the holdout. Script `scripts/earnings-filter-test.mjs`, output `data/replay/earnings-filter-india.json`.
Trade: top run-up third, buy close after the results reaction, sell 20 sessions later, 0.4% round trip. Fit 2021 to 2023, holdout 2024 to Aug 2026.

| | Fit trades | Fit net | Fit wins |
|---|---|---|---|
| Base | 1,499 | +4.24% | 60% |
| F1 reaction up | 658 | +5.44% | 63% |
| F2 reaction at least +2% | 412 | +6.32% | 65% |
| F3 above 200-day | 1,151 | +4.94% | 62% |
| F4 above 50-day | 1,193 | +5.16% | 63% |
| F5 within 10% of 52-week high | 847 | +5.68% | 63% |
| F6 6-month return above market | 884 | +5.51% | 62% |
| F7 market proxy above 200-day | 1,388 | +4.61% | 61% |
| F8 price at least 100 | 1,219 | +3.55% | 58% |

Winner on fit: F2. Holdout: 413 trades, +1.88% net, wins 51%, against base +0.75% and 48% (market +0.50%). Lifts +3.5 pp win rate (needed 5) and +1.13 pp net (needed 1.5): fail. Positive in every year 2021 to 2026. The base itself faded in the holdout. No further combinations tried, because the holdout has been read.
