# Review fixes, 3 Oct 2026 (third review)

What changed after the reviewer's findings, and what it does not prove.

- **v9 flag.** `RegimeOptions.v9: true` reproduces v9 exactly and is used only by replay tests. The default follows the Engine Rules.
- **Follow-through day (C-35).** Only searched for inside a correction (trend Red: below both the 50 and 200 SMA). Low and day count reset when a correction starts and clear when the benchmark is back above at least one average. Unknown SMA keeps the state. Owner has not yet confirmed that "correction = trend Red" is the right definition.
- **Distribution-day volume (C-36).** Compared with the previous non-skipped row, for distribution days and follow-through.
- **Calendar (C-37).** `src/engine/calendar.ts` plus `data/calendar/markets-2026.json`. The 25-session distribution window, 10-session breadth window, follow-through day count, exit-rule sessions and checklist results gap count sessions. Default calendar is weekdays only, which is v9 behaviour.
- **Why the 49-day test stays in calendar days.** A "week" in exit rule 6 means seven calendar days, so holidays do not stretch it. Disagrees with the reviewer's point 3.
- **Calendar source caveat.** India holidays come from two broker summaries that agree on dates. US holidays are from my knowledge. Neither is checked against the primary NSE or NYSE circulars yet.
- **What this does not prove.** Replays prove the port equals v9. These three changes deliberately differ from v9, so they are covered by new unit tests (`test/review-fixes.test.ts`), not by replay.

## Owner decisions after the review (same day), rules R-2026.10.4
- **OQ-8 closed, C-38:** Red allows setups 1 and 4 only in both markets (setup 3 and 1ipo out). Interim; phase 6 backtest (OQ-3) covers it.
- **C-35 revised to a hybrid:** the correction tracker arms at a close 8% or more below the highest close of the last 60 sessions, or when trend reads Red; disarms above that 60-session high. Low and count reset at arming. A follow-through lifts Red to Yellow only. `dropPct` and `windowSessions` are settings (`params.correction`), untested starting values; `dropPct: 0` gives trend Red alone, for the phase 6 comparison.
- **Seeding (R-2026.10.5, C-35 refinement, status Interim):** at arming the low is the lowest low since the 60-session closing high, and day 1 and the day count are replayed from that low over the stored rows. A follow-through on the arming day is valid, the rally-low failure test uses the seeded low, and a later new low replaces it and restarts the count. This replaces the earlier limitation that the low was taken after arming. Tests: `C-35 seeding` in test/review-fixes.test.ts.

## Live desk patched to v9.1 (3 Oct)

On the owner's go-ahead the live Claude desk was patched to v9.1 (same link, same data). It now matches Engine Rules R-2026.10.5 on: Red allows setups 1 and 4 only (both markets), the "isn't allowed in Red/Yellow" wording, the follow-through rule (hybrid correction tracker, seeded from the lowest low since the 60-session closing high), the volume baseline (previous non-skipped row), weekday session counts, and the Rules tab text.
`fixtures/app/swing-desk-v9.1.html` is the published file; `test/app-parity.test.ts` runs the app's own analysis code and the engine on the same rows and checks they agree.
Not matched yet: exchange holidays (the app counts weekdays; the calendar arrives with the GitHub build), NYSE early closes (unsourced), proposals (off in both). Until v9 retires, a rule change has to be made in the engine, the app and the document.
