// Switches and parameters for rules that are still Proposed (Engine Rules change log C-29 to C-34) and the numbers they use.
// Rule: parameters live in settings, never inside the code. Every Proposed switch is OFF; turning one on is an owner decision
// after it is tested and logged Adopted. OQ-8 (Red = pilots only) is not a switch: it is the rule (C-24) and is in LIMITS.
/** Rules version these defaults and the engine implement. Must equal the version in docs/ENGINE_RULES.md (a test checks). */
export const RULES_VERSION = 'R-2026.10.8';

import { DEFAULT_CORRECTION, type CorrectionParams } from './regime.ts';

export interface Proposals {
  usOpenRiskByLight: boolean;  // C-33
  usVixHalving: boolean;       // C-34
  pendingInOpenRisk: boolean;  // C-30
  correlationGuard: boolean;   // C-29
  journalTier2: boolean;       // C-31
  intradayExcursions: boolean; // C-32
}
export interface Params {
  /** C-35 (Adopted, untested numbers): arm the correction tracker at an 8% fall from the 60-session high or trend Red; dropPct 0 = trend Red alone. */
  correction: CorrectionParams;
  /** C-33 (Rejected 3 Oct 2026): US max open risk by light. 2 / 1 / 0.5 is the reviewer's suggested step-down, not an owner choice; the owner left US Yellow at 2%, so the switch stays off and the live limit is 2 / 2 / 0.5. Kept only so the idea can be re-tested. */
  usOpenRiskCap: { green: number; yellow: number; red: number };
  /** C-34: US VIX level above which risk halves. STARTING GUESS, untested: India's is 20. Test in phase 6 before adopting. */
  usVixThreshold: number;
  /** C-29: sectors whose daily returns over the window correlate above this are one group; a group may hold at most maxGroupShare of open risk. UNTESTED GUESSES. */
  correlation: { sectorThreshold: number; maxGroupShare: number; sectorWindow: number; stockThreshold: number; stockWindow: number };
  /** C-31: second Journal Test tier. Trade count is from the proposal; the profit factor and drawdown numbers were "not set" and are STARTING GUESSES. */
  tier2: { minTrades: number; minProfitFactor: number; maxDrawdownPct: number };
}
export interface Settings { proposals: Proposals; params: Params }
export const DEFAULT_SETTINGS: Settings = {
  proposals: { usOpenRiskByLight: false, usVixHalving: false, pendingInOpenRisk: false, correlationGuard: false, journalTier2: false, intradayExcursions: false },
  params: {
    correction: { ...DEFAULT_CORRECTION },
    usOpenRiskCap: { green: 2, yellow: 1, red: 0.5 },
    usVixThreshold: 25,
    correlation: { sectorThreshold: 0.8, maxGroupShare: 0.5, sectorWindow: 63, stockThreshold: 0.75, stockWindow: 60 },
    tier2: { minTrades: 100, minProfitFactor: 1.5, maxDrawdownPct: 15 },
  },
};
