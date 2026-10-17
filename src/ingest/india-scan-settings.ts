// India whole-market nightly scan (IND-SCAN-1): the US scan's method with India's own universe, floors and groups. Same code (runScan), different settings.
// Every value not listed here is the US-SCAN-1 value (spread below). Fixed before any run; changing a value restarts the forward clock and must be logged.
// PROVISIONAL items are mechanical choices the brief did not give; the universe size and liquidity floor match the C-54 baseline (IND-BASE-1) so the two are comparable.
import { SCAN } from './us-scan-settings.ts';
import { LIMITS, type Light, type SetupId } from '../engine/setups.ts';
export const INDIA_SCAN_VERSION = 'IND-SCAN-1';
export const INDIA_SCAN: typeof SCAN = {
  ...SCAN,
  universeSize: 500,           // top 500 by 20-day traded value (same as C-54)
  minDollarVol: 5e7,           // rupees: 5 crore a day, safety floor (same as C-54)
  minPrice: 20,                // rupees (same as C-54)
  clears50M: 2.5e8,            // tag only: 25 crore a day, the middle cost tier
  types: ['EQ', 'BE'],
  groupsPerLight: { green: 4, yellow: 2, red: 4 },   // PROVISIONAL: NSE's ~20 broad industries; same counts as US
};
/** Setups allowed per light: the engine's own India table (LIMITS.india), not a copy. */
export const INDIA_SETUPS = Object.fromEntries((['green', 'yellow', 'red'] as Light[]).map((l) => [l, LIMITS.india[l].setups])) as Record<Light, SetupId[]>;
