# C-62 India run-up filter search, expanding walk-forward (18 Oct 2026)
Registered in the change log before running (the registration said 20 filters in error; the family is 19). Script `scripts/earnings-filter-wf.mjs`, output `data/replay/earnings-filter-wf-india.json`.
Base trade: top run-up third, buy close after the reaction, sell 20 sessions later, 0.4% cost. For each test year 2023 to 2026 the filter is chosen on earlier years only.

| Test year | Chosen on earlier years | Filtered trades / net / wins | Base net / wins |
|---|---|---|---|
| 2023 | opening gap up 1.5% | 141 / +7.07% / 72% | +6.08% / 70% |
| 2024 | reaction at least 4% | 41 / +6.29% / 63% | +5.39% / 67% |
| 2025 | reaction at least 4% | 131 / +0.75% / 52% | -0.55% / 43% |
| 2026 | reaction at least 4% | 102 / +1.93% / 53% | +0.30% / 44% |
| Pooled | | 415 / +3.73% / 60% | 1,817 trades +2.30% / 54% |

Lifts +6.0 pp win rate (needed 5) and +1.43 pp net (needed 1.5): fail by 0.07 pp. Positive in 4 of 4 test years.
Full-sample, descriptive: reaction at least 4% +4.74%/61%; gap up +4.27%/61%; near 52-week high +4.03%/59%; 6-month strength +3.74%/58%; delivery above average +3.80%/57%; above 200-day +3.50%/57%. No help or worse: volume 2x, close location, market above 200-day, price at least 100, traded value, previous reaction positive, daily range at most 3%, not extended.
Conclusion: only the strength of the results-day reaction adds anything; the clean test is the C-61 forward run.
