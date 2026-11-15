# Minervini SEPA book, as published (package 36b): proposal

Status: **proposed 15 Nov 2026 at the owner's request ("a strategy that is exactly like Minervini's, no differences"); not built, not adopted.** Paper only. Not a financial adviser. Pasted reviewer text is not approval. Numbers below come from published summaries of his method (one secondary source read on 15 Nov: finermarketpoints.com, plus the trend template already in `docs/MINERVINI_BOOK.md`); they are to be checked against his books before registration, and the places where sources disagree are listed as decisions.

## What "exactly" can and cannot mean
His method has a coded part and a judged part. A rule-based book can carry only the coded part. The judged part stays out, and the card and every report say so. **No rule-based book can be identical to what he does.** The closest honest version is below.

**Coded here (his published rules):**
1. **Trend template**, all eight tests (the C-216 screen, unchanged).
2. **Fundamentals:** current-quarter EPS growth at least 25% year on year (he states 20 to 25% as the floor and 40 to 50% preferred), return on equity above 17%, institutional holding between 20% and 80%. Sales growth, margin and debt have no stated numbers in the source, so the book adds none.
3. **Volatility contraction pattern:** at least two contractions in the base, each about half the depth of the one before (for example 25%, then 12%, then 6%), volume drying up through the contractions. Pivot = the high of the last contraction.
4. **Entry:** a close above the pivot on volume at least 150% of the 50-session average (the published range is 100 to 150% for mid-caps and 300 to 400% for liquid US growth stocks). Signals are checked daily.
5. **Stop:** 8% below the entry (his published maximum; 7% to 8% is typical).
6. **Risk sizing:** risk 1.25% of the book per trade, so the position is 1.25% divided by the stop width (an 8% stop gives about 15.6%), capped at 25% of the book (his stated maximum position).
7. **Concentration:** at most 8 positions (the source says 4 to 8 and also 15 to 20; the lower range is his own).
8. **Profit rule:** after a gain of 8%, sell half and move the stop on the rest to breakeven (published example); the rest is held until the stop, or until the close falls below the 50-day average on volume above the 50-session average (stage-3 exit, coded as that single test).
9. **Market gate:** no new entries when the Nifty 500 closes below its 50-day average (his rule is qualitative; this is the simplest coding).

**Not coded (stay with the person, listed on the card):** choosing the best few by chart quality and group leadership; reading news and catalysts; intraday entry (the book buys at the next open after the close above the pivot); discretionary adds and selling into strength; judging a base by eye (cup, flat base, handle). These are the differences that remain.

## Data
- Prices, volume, highs and lows: the whole stored history.
- Quarterly EPS growth and ROE: from the company-figures table; filings cover 2019 on and balance-sheet depth only from Sep 2022, so a replay window runs from the first month where 90% of the top-500 names carry every figure (the Batch B window rule).
- Institutional holding: from the shareholding filings (full from Sep 2021); the test is the sum of FII and DII holdings.

## Replay, judging
- One replay, labelled an implementation check, not evidence; window rule as above; survivor bias applies. Forward paper is the evidence.
- Comparator: Nifty 500, cap-weighted (C-176); kill line C-174; confidence C-177. Read as a pair against the screen-only book (C-216), so the difference between screen and method is visible.
- **Stated before the first signal:** (1) with at most 8 positions and an 8% stop, most months will have few or no signals and the book will often be mostly cash; exposure is reported monthly. (2) A near-miss on the pivot (entry the next open, often above it) is a built-in difference from his intraday entry; the fill gap above the pivot is logged on every signal. (3) The engine holds equal fixed slots today; risk-based sizing needs a per-trade weight in the buy order (a small change to shared engine code, defaults unchanged).

## Decisions for the owner
| # | Decision | Proposed |
|---|---|---|
| S-1 | EPS growth floor: 25% (stated floor 20 to 25%) or 40% (his preferred) | 25% |
| S-2 | Breakout volume: 150%, or another figure | 150% |
| S-3 | Contractions: at least two, each about half the last; allow a tolerance (each at most 70% of the previous) | At least two, each at most 70% of the previous |
| S-4 | Stop 8%, risk 1.25% per trade, position cap 25%, at most 8 positions | As stated |
| S-5 | Profit rule: half off at +8% with breakeven stop, then 50-day exit | As stated |
| S-6 | Market gate: Nifty 500 below its 50-day average stops new entries | As stated |
| S-7 | Institutional holding 20% to 80% as a test (FII plus DII) | Yes |
| S-8 | Build as a new book next to the screen book, with a replay first | Yes |
