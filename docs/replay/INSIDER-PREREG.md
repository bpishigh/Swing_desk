# INSIDER: do promoter and insider market purchases find stocks that go on to win? — registered 21 Nov 2026, before the run
Data: SEBI PIT disclosures, market-wide, 2016-2025, promoter / promoter group / director / KMP / relative rows (data/india/pit, loaded by the backfill-pit job on 20-21 Nov 2026). Each row carries the disclosure date; signals use only rows disclosed on or before the month-end. Unlike the filings, these include names that later delisted (as long as the symbol matches the price history; coverage of the match is reported). Paper only; not financial advice.
## Events (month-end states, trailing 90 calendar days by disclosure date; family of 4, fixed)
Rows are counted only when the mode is an open-market purchase or sale ("Market Purchase" / "Market Sale"); gifts, ESOP, pledges, off-market and inter-se transfers are ignored. Values are the rupee value in the disclosure.
- P1 promoter buying: promoter / promoter-group net open-market purchase >= Rs 25 lakh (purchases minus sales).
- P2 promoter creeping up: P1 and at least 2 separate purchase disclosures and summed holding gain (after minus before, in % points of the company) >= 0.5.
- P3 insider (non-promoter) buying: director / KMP / relative net open-market purchase >= Rs 10 lakh, and no promoter net sale >= Rs 25 lakh in the same window.
- P4 promoter selling (negative side): promoter / promoter-group net open-market sale >= Rs 1 crore.
## Universe, outcomes, samples
Each month-end: liquid stocks (20-session traded value >= Rs 2 crore, raw price >= Rs 20). Reported only (not scored): the same at Rs 50 lakh. Outcomes as in EARNINGS-ACCEL: A 12-month excess over the liquid median on that month-end (stocks with no price from session +150 onward are left out, which understates losers; disclosed); B 3x within 756 sessions (to 2023-11); C top-quintile share. Discovery month-ends 2016-06 to 2020-12; validation 2021-01 to 2024-11. One run.
## Bar (P1-P3, both halves)
n >= 300 stock-months per half; median excess >= +5 points; top-quintile share >= 1.3x (26%); ex-top-5% mean excess > 0; positive median excess in at least 6 of 9 entry years. P4 is a read-only check: pass if median excess <= -3 points in both halves (a sell-side warning, useful as an exclusion filter for other books). Pass of P1-P3 means a registered rule and a paper book next; the signal may be clustered in the 2020-21 wave, so the by-year line is read before anything else.

## Results (one run; raw output docs/replay/INSIDER-output.txt)
65,164 open-market rows, 95.9% matched to price history (delisted names included). Rs 2 crore floor, median 12-month excess (discovery 2016-06..2020 / validation 2021..2024-11), n:
- P1 promoter net buying: +6.4% / +1.5% (2,228 / 2,001); positive in 7 of 9 years.
- P2 promoter creeping up (2+ buys, >= 0.5 pt gain): +10.0% / +5.3% (480 / 380); top-quintile share 24.8% / 25.0%; 3x rate 26.9% / 33.3% vs base 21.4%; ex-top-5% mean +13.2% / +10.7%; positive in 7 of 9 years. Year medians swing: 2020 +43.7%, 2024 -19.2%.
- P3 insider buying: +8.7% / -0.1% (859 / 684); positive in 8 of 9 years.
- P4 promoter selling: +3.0% / -1.4%: no sell-side warning (fails).
Verdict on the registered bar: P1, P2, P3 FAIL (P1/P3 validation median below +5; P2 misses the top-quintile share bar by about 1 point in both halves, 24.8% / 25.0% against 26%). At the reported-only Rs 50 lakh floor P2 clears every number (median +10.0 / +5.5, top-quintile 27.2 / 26.4%), but that floor was not the scored view and is not used to rescue it.
Reading: strongest lead found in the whole programme (consistent sign by year, excess survives removing the top 5%, delisted names included), concentrated in 2020. Not a pass. Next: a one-look check of P2 only on months never scored (addendum below).

## Addendum 1 (21 Nov 2026), registered before the run: P2 on unseen months
Sample: month-ends 2024-12 to the last month with a 252-session outcome (about 2025-10); never scored above (the earlier run stopped at 2024-11). Same P2 definition, floor Rs 2 crore, outcome A and C as above, one run. Bar: n >= 150, median excess >= +5 points, top-quintile share >= 26%, ex-top-5% mean > 0. A pass makes P2 a registered rule with a forward paper book flagged "thin, one clustered year, passed only on the final sample". A fail closes it.

### Addendum 1 result (one run; docs/replay/INSIDER-holdout-output.txt)
Month-ends 2024-12 to 2025-10: 65 P2 events (below the n >= 150 bar), median excess -3.8%, mean +10.3%, ex-top-5% +3.7%, top-quintile share 21.5%. P1 median -2.0% (n 497), P3 -1.4% (n 138). FAIL. The discovery-and-validation edge (+10 / +5) did not hold on unseen months; it was carried by 2020 and the earlier years. Closed: no rule, no book. The PIT data stays in the repo for any later registered idea (it is the only deep history we hold on insiders).
