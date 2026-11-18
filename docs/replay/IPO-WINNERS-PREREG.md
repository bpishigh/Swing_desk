# IPO winners study — definitions fixed before any run (18 Nov 2026)

Question (owner): which IPOs went on to grow exponentially, when did each have its first big breakout after listing, and is there a strategy in it?
Descriptive study first. No strategy is run in this step. Paper only; not financial advice.

## Samples
- Discovery: NSE EQ listings first seen 2020-01-02 to 2022-12-31 (bhav-hist), at least 250 sessions of follow-up each. Same IPO list rule as C-226 (EQ only, renames removed, mass-move days >20 dropped).
- Validation: NSE EQ listings first seen in bhav-pre2020 (2010–2018). Not opened until a strategy rule is registered. Disclosure: this window was used once for the V9 holdout (C-231) on a different rule; no look at winners or timing.
- Post-2022 listings are left unused (too little follow-up). US is not in scope (survivors-only history makes winners look too common).

## Definitions
- Session 0 = first appearance. Reference price = close at session 30 (the listing pop is excluded).
- Peak multiple = highest close within sessions 30–780 (or end of data) divided by the session-30 close. Winner: 5x or more. Big winner: 10x or more. Moderate: 3x to under 5x.
- First big breakout = the first session s >= 20 where: close > highest high of sessions 1..s-1 (day 0 excluded); volume >= 2x the mean of the prior 20 sessions; 20-session mean traded value >= Rs 1 crore. Entry reference = the next session's open.
- Recorded per first breakout: sessions since listing, close vs session-0 close, close vs session-30 close, base length and depth (from highest high in 1..s-1 back to the lowest low since that high's session), volume ratio, 63-session return vs Nifty 500, Nifty-500 regime (above/below 200-day), delivery %, forward returns at 60/120/250 sessions from entry open, max drawdown in the first 60 sessions, peak multiple from entry, whether the breakout was 5x+ winner.
- Also recorded: IPOs with no qualifying breakout; base rate of winners among all IPOs; precision (share of first breakouts that became 5x winners, and that reached 2x from entry within 250 sessions).

## Reading rule
- Report winners and non-winners side by side; any feature is judged by precision across all first-breakouts, never by winners alone.
- Family size for any feature cut: at most 6 single-feature splits (sessions since listing, base depth, volume ratio, relative strength, regime, size of day-0 pop). Chosen cut points are the tercile or median of the discovery sample, set by rule, not by eye.
- A strategy is proposed only if a split lifts the 2x-in-250-sessions rate by at least 15 points with at least 30 events on each side. Otherwise the finding is "no usable edge" and is reported as that.
- Any strategy proposed gets its own registered rule, then one validation run on the 2010–2018 listings; pass bar set at that time. Nothing live changes without the owner's go.
