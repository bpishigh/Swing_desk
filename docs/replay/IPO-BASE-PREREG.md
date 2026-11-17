# IPO base breakout: backtest pre-registration (C-225, 18 Nov 2026)

Written before any backtest return was read. Paper only; not a financial adviser. Owner: "run it for both" India and US. The count run of 18 Nov (data/india/ipo/base-count.json) read no returns.

**Rule.** Exactly the live book (src/engine/ipo-base.ts, C-225), no tuning: IPO list names 30 to 250 sessions after listing; 20-session average traded value at least Rs 5 crore (US: $1 million); base of 15 sessions at most 25% deep, prior close within 5% of the base high and above the 50-session average; signal on the session whose high is 0.5% above the base high, close at or above it, volume at least 2x its 50-session average; fill at the next open; C-159 stop; hold 60 sessions; at most 20 names at 5%; 20-session cooldown; windows with a one-day move over 40% skipped.

**Stand-ins (the live market light cannot be replayed: no light history is stored).** Green/yellow = the comparator index at or above its own 200-session average; red = below it, in which case no new buys. Comparator: Nifty 500 (India), SPY (US).

**Costs.** India: the tiered cost of the C-54 baseline plus 0.6% extra round trip (thin trading and circuit limits). US: the US tier cost plus the same 0.6%. Cash earns nothing.

**Runs (one each, none repeated).** (1) India 2 Jan 2020 to the last stored session. (2) India holdout 2011 to 2019 (stored prices from 2010, corporate-action history before 2019 as used for C-217). (3) US 2017 to the last stored session, an implementation check only.

**Pass rule (all four, per run, for India; the US run reports the same table and is never evidence).** 1. Net return per closed trade after costs above zero. 2. Book return above the comparator's return scaled by the book's average exposure (the comparator "held at the same invested fraction"). 3. Max drawdown no worse than 1.5 times the comparator's max drawdown over the same sessions. 4. At least 30 closed trades a year on average. A pass is permission to keep the forward book running with more confidence, not an adoption; a fail does not stop the forward book (it is paper and already running) but is recorded beside it. India run 1 and holdout 2 must both pass for the idea to be called supported.

**Labels printed on every result.** India 2020 to 2026 prices have been seen in other tests (not for this rule). Delisted names are in the India price files; the IPO list drops renames using the entity table, which was built with later knowledge. US: survivor bias is heavy (all stored symbols still trade, so failed IPOs are absent), no opens are stored so fills use the fill session's close, and first appearances include spin-offs, SPAC mergers and ticker changes. Relistings and demergers can appear as listings in India.
