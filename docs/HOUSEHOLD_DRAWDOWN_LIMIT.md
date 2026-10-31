# Household drawdown limit (reference for the Engine Rules)

Source of truth: the Portfolio Manager design (draft v6), section 1 and section 8. This file only records the number so the Engine Rules can point to it and not restate it.

- **Decided 11 Oct 2026 (owner, accepting the recommendation):** a household drawdown limit of **20% on the Balanced profile**, selectable in the app.
- **Proposals, not yet decided:** about 12% on the Cautious profile and about 30% on the Aggressive profile.
- **Definition:** the fall from the highest value of investable capital to today's value, after adding new money and taking out withdrawals.
- **What a breach does:** raises a review. It never triggers an automatic sale or an automatic stop of any stream.
- **How the Engine Rules use it:** any stream or sleeve that holds real money (not paper) is sized so that its plausible fall fits inside this limit. Paper books are not measured against it.
