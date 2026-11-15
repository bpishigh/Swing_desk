# Anchor lock-in event study (package 18b, C-209)

Run 2026-11-15. One run, registered before it ran, report only: nothing is switched on from it (C-2). Paper only; not a financial adviser.

**Method.** A listing is the first session a symbol appears in the stored daily files after 4 Jan 2010. 1627 listings found; 288 symbols skipped as renames of an existing company; 59 skipped for fewer than 40 sessions of history. The window is centred 2 calendar days before listing plus 30 (or 90) days, from 7 sessions before to 4 sessions after. The 90-day end applies to issues from April 2022 (listings from 1 May 2022 are used as the proxy; not verified against SEBI's circular). Baseline: the same name's average 11-session return over its other windows. The Nifty 500 comparison uses the stored index history.

| Group | n | Mean window return | Share negative | Mean vs own average | Share below own average | n vs Nifty 500 | Mean vs Nifty 500 |
|---|---|---|---|---|---|---|---|
| 30-day end, listed before May 2022 | 639 | 1.8% | 56.8% | 0.9% | 60.4% | 514 | 1.7% |
| 30-day end, listed from May 2022 | 821 | 0.3% | 56.5% | -0.2% | 58.9% | 422 | -0.4% |
| 90-day end, listed from May 2022 | 656 | -0.7% | 61.0% | -0.9% | 62.6% | 383 | -0.9% |

**Not covered.** SME listings: the stored files keep only the EQ and BE series, so SME names are absent and cannot be reported separately. Only listed companies are counted (ETFs and funds dropped), but first appearances are not all IPOs: SME names moving to the main board, series changes and demerged companies also show up, so the count is higher than the number of main-board IPOs. Symbol changes of companies not in the entity table may be counted as listings. Listing date is the first stored session; the real allotment date was not used. Delisted names are in the prices but survivors are over-represented among long histories. The 2020 to 2026 period has been seen in other tests.

Counts, not conclusions: with this many events a mean under about 1 percentage point is within noise; look at the share negative and the size of the median (in the JSON).
