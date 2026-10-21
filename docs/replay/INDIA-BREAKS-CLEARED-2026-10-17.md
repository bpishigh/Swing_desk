# India unexplained price breaks: cleared by rule (17 Oct 2026)

Before: 453 one-day price breaks in the 2020 to Oct 2026 history had no usable corporate action; 76 were in stocks trading Rs 5 crore a day or more. In the as-of view an unresolved break drops that stock's earlier history, so liquid names such as Axis Bank (23 Mar 2020 fall) lost their past.

Done: rules written first, then applied (`scripts/derive-india-overrides.mjs`, output `data/india/corp-action-overrides-hist.json`). Every entry names its rule and says no announcement was checked.
- R1 (14): clean 1/n price step within 5%: split, factor 1/n. Includes ETF unit splits (gold and silver ETFs and others).
- R2 (29): the list says demerger with no ratio, plus the Tata Motors demerger of 14 Oct 2025: factor is the observed ex-date price ratio (that day's market move is not removed).
- R3 (4): list ratio does not match, volume at least doubled: split or bonus stacked on others (Vishwaraj, Talbros and two others): observed ratio.
- R4 (24 + 1 manual): one-day fall to 60-100% of the prior close with no action, or a rights-entitlement ticker: genuine move, history kept. Hiding a real fall would flatter every test. One bank's 6 Mar 2020 fall (RBI moratorium) added by hand.
- Left for the owner (4), cleared later the same day by the owner (below): MAJESCO 23 Dec 2020 (price 985 to 12, a merger artefact), one stock on 18 Mar 2021 (name kept in the private repository) (-57%, flat volume), AJANTPHARM 22 Jun 2022 (-34%, flat volume), HEG 7 Sep 2026 (-63%).

After: unresolved 453 to 381; the 377 still open are in stocks under Rs 5 crore a day, outside the scan and the C-54 universe.

Where it applies: the audit, the as-of view and the India scan read both override files (hand overrides win). The live nightly store does not, so its averages stay conservative. The leak check passes (6 nights identical).

Limits, stated: rule-derived factors are approximations (a demerger factor includes that day's market move); R3 used the 10 sessions of volume after the break to classify, a small look-ahead in classification only. C-54 was run before these overrides existed; its numbers stand as pre-registered and are not re-run. They will be re-run once on the longer history, with and without these entries, and both reported.

Owner answers, 17 Oct 2026 (web sources supplied by the owner; each ratio checked against the observed price move):
- MAJESCO 23 Dec 2020: special dividend of Rs 974 a share (sale of the US subsidiary), not a merger. Adjusted as a cash distribution, factor 0.0124 (observed ex-date ratio).
- One stock on 18 Mar 2021 (name kept in the private repository): 1:1 bonus, factor 0.5. Observed 0.4282; the other 14% was that day's genuine fall and stays in the history.
- AJANTPHARM 22 Jun 2022: 1:2 bonus, factor 2/3. Observed 0.6599.
- HEG 7 Sep 2026: demerger of the graphite business, 1:1 into HEG Graphite; factor 0.3738 (observed ex-date ratio, as the other demergers).
Unresolved liquid breaks: 0. The entries are in scripts/derive-india-overrides.mjs (MANUAL) and the overrides file. Re-running that script from the current audit would drop the 72 rule-derived entries, so edit the file, not the script output. The India scan result is unchanged (these breaks sit outside the current 250-session window).
