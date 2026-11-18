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

## Addendum 1 (18 Nov 2026, after the first discovery run)
The first run (no filter) listed winners such as SERVOTECH, RAJRATAN, ACCURACY, GODHA, MGEL and HARDWYN. These are SME-to-mainboard migrations or thin names: the stored files hold no SME rows, so a migrated stock looks like a new listing, its "listing" day trades ~Rs 0.2 crore, and its history before that is missing. This also affects the IPO list used in C-226 to C-231 (disclosed there).
The fix is chosen for data reasons, not performance: real mainboard IPOs trade tens of crores on day 0. Filter: day-0 traded value (close x volume) of at least Rs 3 crore. Both the unfiltered and filtered result are reported. The family size and reading rule above are unchanged.

## Addendum 2 (18 Nov 2026): can the payoff shape carry it? Owner asked to build a strategy anyway
Idea: the filter on entry found nothing, but the winners are fat-tailed (11% reach 5x). A wide trailing exit might keep the tail and cut the rest. Registered family, 3 rules, one run each, on the discovery-ipo cohort (same filter as addendum 1) only:
- Entry: every first big breakout, at next open. Exit: first close at or below the highest close since entry by X, filled at next open; X = 25%, 35%, 50%. Hold at most 520 sessions; open trades are marked at the last close. Cost 1.3% per round trip.
- Reported: mean and median net return per trade, share of trades above zero, share of total profit from the top 10% of trades, mean holding sessions, and the same numbers with the single best trade removed.
- Pass bar for taking one rule to the 2010–2018 listings (one run, same filter): mean net per trade at least +5% with the best trade removed, and at least 60 trades. If none pass, the study is closed as no edge. Family-of-3 noted for selection.

Result of the discovery run (addendum 2): all three rules pass the bar on the 89 trades (mean net +25% / +28% / +30%; best trade removed +19% / +24% / +26%; top 10% of trades make 82–84% of profit). Rule carried to validation: 35% trail (the middle of the family, chosen before the validation run; the other two print alongside and are not used for the verdict). Validation: listings 3 Jan 2011 to 31 Dec 2018, same filter, one run. Bar: 60 trades or more, mean net per trade at least +5% with the best trade removed, and net above zero with the best two removed.
