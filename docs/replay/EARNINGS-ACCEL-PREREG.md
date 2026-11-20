# EARNINGS-ACCEL: do accelerating quarterly results find the stocks that go on to win? — registered 20 Nov 2026, before the run
Owner direction: keep digging for multibagger identifiers. Only fundamentals family not yet tested on India is earnings acceleration. Paper only; not financial advice.
## Data and limits
India quarterly results from the filings store, as of the filing date (asOfResults, original filings, consolidated where filed; usable from 2019-01). Survivor-biased (delisted companies have little or no filings), so levels of outcome are inflated for everyone; the control below cancels most of it. Universe each month-end: liquid (20-session traded value >= Rs 2 crore, raw price >= Rs 20) with at least the latest two quarters of year-on-year growth available on one basis.
## Events (month-end states; family of 4, fixed)
- E0 control, plain growth: latest-quarter PAT growth (year on year) >= 25% and revenue growth >= 10%.
- E1 profit acceleration: E0 and the previous quarter's PAT growth >= 25% and latest growth exceeds the previous quarter's by >= 5 points.
- E2 revenue acceleration: latest revenue growth >= 15%, exceeds the previous quarter's by >= 5 points, and the previous quarter also exceeded the one before it (three-quarter rise); PAT growth positive.
- E3 broad acceleration: PBT and revenue and PAT all accelerating on the latest quarter (each growth above its previous-quarter growth) with all three growth rates >= 15%.
Growth values come from the view's yoy figures (a quarter whose growth is null on basis or base grounds is not scored; a stock with a null in the needed quarters is excluded).
## Outcomes
A: 12-month forward excess = stock's close 252 sessions later (last stored close if delisted/stopped) over the month-end close, minus the median of all liquid stocks on the same month-end. B: 3x within 756 sessions (month-ends to 2023-11 only), against the all-liquid rate. C: share of events in the top quintile of 12-month return among liquid stocks.
## Samples
Discovery month-ends 2019-01 to 2022-06; validation 2022-07 to 2024-11 (12-month outcomes complete). Events overlap in time and stock, so counts are not independent; read lifts and consistency. One run.
## Bar (per event, in both halves; validation is the single scored look)
n >= 300 stock-months per half; median excess (A) >= +5 points; top-quintile share >= 1.3x the 20% base; ex-best-5% mean excess still positive; beats E0 (the plain-growth control) on median excess in each half (acceleration must add something over growth itself, which also cancels the survivor bias); positive median excess in at least 4 of the 6 calendar-year entry groups (2019-2024) pooled across halves. B lift reported (>= 1.3x) where available but not required. Pass means worth a registered rule on this data; the short history (about 6 years, one crash) caps how much weight it can carry, and a pass would be paper-book only and flagged as thin evidence.

## Results (one run, no reruns; raw output docs/replay/EARNINGS-ACCEL-output.txt)
62,196 liquid stock-months, 2019-01 to 2024-11; base 3x-in-756-sessions rate 27.3% (survivor-inflated). Median 12-month excess over the same-month liquid median (discovery / validation), with n:
- E0 plain growth: -0.8% / +4.0% (4,239 / 6,481)
- E1 profit acceleration: -1.9% / +2.7% (1,322 / 1,902)
- E2 revenue acceleration: -2.7% / +3.3% (1,651 / 1,537)
- E3 broad acceleration: -0.8% / +4.9% (1,952 / 2,736)
Verdict: all three FAIL (none reaches +5 in discovery; none beats the plain-growth control in both halves; E1, E2 positive in only 2 of 6 entry years, E3 4 of 6). Top-quintile shares are 19-21% in discovery (base 20%) and 24% in validation. The excess that exists is a 2023-24 effect that plain growth gets equally, so acceleration adds nothing over growth. 3x rates: E1 22.9% / 28.0%, E2 23.9% / 30.5%, E3 25.9% / 30.2% against base 27.3%: no lift.
Closes earnings acceleration for this data (6 years, one crash, survivors only). Weak test by construction; says "no usable signal found", not "proved none".
