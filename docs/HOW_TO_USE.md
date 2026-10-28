# How to use the Repo Desk

The Repo Desk is one site with two jobs. The **desk** (Market, Funds, Scans, Engine Rules, Docs) shows the nightly market data and the Swing Desk screen. The **Portfolio** tab is the Portfolio Manager: you add your broker files and it tells you, stock by stock and fund by fund, what to keep, sell, reduce or move. Nothing on this site places an order. It gives verdicts and numbers; you place the trade.

## The 5-minute evening routine
1. **Market tab.** Read the regime light (Green, Amber or Red). It sets how much risk a new Swing trade may carry and which setups are allowed. Check the "fresh" chips at the top: if the data is old, the nightly job has not run yet, so wait.
2. **Scans tab.** Read tonight's shortlist. Each line has a trigger (the price that confirms the entry), a limit (the most you will pay) and a stop (where the trade is wrong). A line tagged *over cap* or *room fail* is one the desk itself would not take as listed.
3. **Portfolio tab, Overview.** The "What to do" card lists what needs action today: stocks to sell, to promote, to harvest, to trim. If it says nothing, do nothing.

## The Portfolio Manager, tab by tab
- **＋ Add files.** Add a tradebook (CSV or Excel) for each account, one at a time. Files are read in your browser. Add a holdings statement (stocks, and separately funds) on the **Data** tab to check that the trades add up to what the broker shows.
- **Overview.** Value, return, the trend line against the Nifty 500, and the "What to do" card.
- **Holdings.** Every holding with its verdict, book (Swing, Legacy or Long-term) and cap size. Click a row for the numbers behind the verdict. Filter by verdict to see only what needs action.
- **Trades.** Every buy and sell, with the book each lot was put in. Near-matches to a shortlist line ask you to confirm "Swing" or "Legacy".
- **Tax.** Gains per person (the exemption and loss set-off belong to one PAN), the estimate for equity and non-equity gains, the Schedule CG working file, and the Harvest and Sell-after cards.
- **Income.** Dividends and interest received.
- **Allocation.** Where the money sits against your target mix, including a look-through into what your funds own.
- **Limits & goals.** Your caps (single company, sector, region, per-person) and the drawdown check.
- **Data.** What is loaded, what is missing, the statement checks and the corrections screen (fix a holding's type, move a transaction to another account).

## What each verdict means, and what you do
The first rule that fires wins, in this order: **Exit, Promote, Harvest, Trim, Keep.**

| Label | Meaning | What you do |
|---|---|---|
| **Exit** | Closed below its 200-day average or below its last major swing low. | Sell. Tax never delays an Exit. |
| **Promote** | Passes the exit test and is on tonight's Swing shortlist. | Optional: give the lot the shortlist's stop and treat it as a Swing trade. The card says how many shares move in each account under the Swing rules (taken from the oldest lots); the rest stays Legacy. |
| **Harvest** | Passes the exit test, but a loss lot is worth booking: the tax saved beats the cost of selling and buying back by 25%. | Sell the loss lot, buy back the next day or later. Lots and numbers are on the Tax tab. |
| **Trim** | Passes the exit test but is outside your ten strongest stocks, at two weekly checks in a row. | Reduce gradually, weakest first, at most two names at a time. Not an order to sell at once. |
| **Keep** | Passes the exit test and is inside the ten-name target. | Nothing. The test keeps watching. |
| **Sell after <date>** | A gain close to its one-year date: waiting for the lower long-term rate saves more than the price risk. | Hold the sale until that date, unless the stock turns Exit. |
| **Replace · Watch** | Funds only, from the published fund scores. | Watch: weakening. Replace: a clearly better fund exists. |
| **No verdict** | Not enough clean price history, or an unadjusted corporate action. | Read the reason on hover. |

Every verdict is written to the verdict log with the price it rested on, and is judged later against rules written down in advance (3, 6 and 12 months).

**Books.** A Swing lot older than 120 sessions (provisional) is shown as Legacy. A sale made within 5 sessions of a close at or below a Swing lot's stop is treated as that lot's exit; any other partial sale of a stock that has Swing lots asks you yes or no on the Trades tab.

## Weekly, monthly, yearly
- **Weekly:** open Overview once. Trim only counts after two weekly checks agree, so checking more often changes nothing.
- **After results season or a big move:** hard refresh, then re-read the Holdings filter for Exit.
- **Before 31 March:** open Tax. Read Harvest (losses worth booking) and Sell after (gains worth waiting for), and the estimate for the year.
- **After filing:** download the Schedule CG working file from Tax; it groups every sale by return section.

## Swing trades in short
A Swing trade starts from a shortlist line. Buy only inside the trigger and limit, put the stop in with the broker, and size by the risk the regime light allows. A volatile stock (ATR above 3% of price) is not bought on a standing order: the entry waits for a confirming close. The Engine Rules tab has the full rules; the change log at the bottom of the page records every change.

## When something looks wrong
- **A chart or return is missing:** the Data tab lists funds with no price history. Hard refresh, then check again; the site fetches fund history through its own service.
- **A change you just heard about is not showing:** the site rebuilds a few minutes after each update. Hard refresh.
- **A stock shows No verdict:** hover it. Usually a split, bonus or demerger the prices have not been adjusted for.
- **A fund is classed wrongly:** use the corrections screen on the Data tab.
- **Numbers disagree with the broker:** add the broker's holdings statement and P&L statement on the Data tab; the check shows the differences line by line.

## What this is not
It is decision support, not tax or investment advice, and it never trades for you. Estimates are before surcharge and cess. Where a rule is a first guess rather than tested, the page says so.
