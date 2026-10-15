// US whole-market scan (C-20a): every number the scan uses, in one place. Fixed before any replay and not tuned (docs/SCREENER_BRIEF.md section 6;
// brief of 16 Oct 2026, "US stock screening: design brief for review"). Changing any value here restarts the forward-test clock and must be logged.
// Items marked PROPOSED were set in the 16 Oct brief for owner sign-off; items marked PROVISIONAL are mechanical definitions the brief did not give.

export const SCAN_VERSION = 'US-SCAN-1';

export const SCAN = {
  // 2. Universe
  universeSize: 1500,          // pinned, so the top-20% cut does not float
  minDollarVol: 10e6,          // 20-day average dollar volume, safety floor
  minPrice: 10,
  minSessions: 65,             // sessions of history to enter the ranking
  clears50M: 50e6,             // tag only: would the stock clear today's Ready floor
  liqSessions: 20,
  types: ['CS', 'ADRC'],       // common stocks and ADRs
  historyBreakGap: 20,         // a gap this long (sessions) inside a ticker's history starts a new history (stand-in for FIGI keys until monthly reference snapshots exist)
  // 3. Relative strength: weighted return over four quarters, latest first
  quarter: 63,
  rsWeights: [0.4, 0.2, 0.2, 0.2],
  rsTop: 0.2,                  // top 20%: percentile of 80 or more
  // 4. Trend template
  tplLowPct: 0.30,             // at least 30% above the 52-week low
  tplHighPct: 0.25,            // within 25% of the 52-week high
  tplRisingLag: 21,            // 200-day average must be above its value a month (21 sessions) earlier
  yearSessions: 252,
  // IPO path (setup 1ipo): used when a stock has no four-quarter score
  ipoMinCalendarDays: 100,     // since the stock's first stored bar (listing date proxy); PROVISIONAL: first stored bar stands in for the listing date
  ipoBaseMinSessions: 15,
  ipoBaseMaxDepth: 0.25,
  ipoPivotWithin: 0.05,
  // 5. Groups
  groupMinMembers: 5,
  groupsPerLight: { green: 4, yellow: 2, red: 4 } as Record<string, number>,
  // 6. Base quality and extension
  atrShort: 10, atrLong: 50, atrTightRatio: 0.7,
  pivotWithin: 0.05,
  pivotSessions: 50,           // PROVISIONAL: pivot = highest high of the last 50 sessions, as the weekly screen's high50
  extendedAbove50: 0.25,
  // 7. Setups and room
  roomSessions: 250,
  roomR: 3,                    // US
  atrStopMult: 1.5,
  pullbackLookback: 5,         // PROVISIONAL: sessions in which a pullback must have touched the average
  stopLookback: 10,
  // 8. Ordered output
  weights: { rs: 60, tightness: 25, pivot: 15 },   // PROPOSED, owner sign-off pending
  top: 10, maxPerIndustry: 3,
  // Hysteresis: qualification (steps 2 to 5)
  failsToLeave: 2,
  // Special dividends: adjust earlier closes when the payout is at least this share of the prior close (PROPOSED; the India figure). Not applied yet: the store holds no dividend data.
  specialDividend: 0.05,
};

/** Hand map from SIC code to about 60 groups. First matching range wins. Reviewed like any other rule; refreshed quarterly with the SIC file. */
export const SIC_GROUPS: Array<[number, number, string]> = [
  [100, 999, 'Agriculture'], [1000, 1099, 'Metal mining'], [1200, 1299, 'Coal'], [1300, 1379, 'Oil and gas production'], [1380, 1399, 'Oilfield services'],
  [1400, 1499, 'Nonmetallic mining'], [1520, 1599, 'Homebuilding'], [1600, 1799, 'Construction and engineering'], [2000, 2099, 'Food and beverages'], [2100, 2199, 'Tobacco'],
  [2200, 2399, 'Textiles and apparel'], [2400, 2599, 'Wood and furniture'], [2600, 2699, 'Paper and packaging'], [2700, 2799, 'Publishing and printing'],
  [2800, 2829, 'Chemicals'], [2833, 2836, 'Pharma and biotech'], [2840, 2899, 'Specialty chemicals'], [2900, 2999, 'Petroleum refining'], [3000, 3199, 'Rubber, plastics and leather'],
  [3200, 3299, 'Glass and building materials'], [3300, 3399, 'Steel and metals'], [3400, 3499, 'Fabricated metal'], [3500, 3569, 'Industrial machinery'],
  [3570, 3579, 'Computer hardware'], [3580, 3599, 'Industrial machinery'], [3600, 3659, 'Electrical equipment'], [3660, 3669, 'Communications equipment'],
  [3670, 3679, 'Semiconductors and components'], [3680, 3699, 'Electronics, other'], [3710, 3719, 'Autos and parts'], [3720, 3769, 'Aerospace and defense'],
  [3700, 3799, 'Transportation equipment'], [3820, 3829, 'Instruments and test equipment'], [3840, 3859, 'Medical devices'], [3800, 3899, 'Instruments, other'],
  [3900, 3999, 'Misc manufacturing'], [4000, 4099, 'Railroads'], [4100, 4299, 'Trucking and transit'], [4400, 4499, 'Shipping'], [4500, 4599, 'Airlines'],
  [4600, 4699, 'Pipelines'], [4700, 4799, 'Logistics services'], [4800, 4829, 'Telecom'], [4830, 4899, 'Media and cable'], [4900, 4939, 'Electric and gas utilities'],
  [4940, 4949, 'Water utilities'], [4950, 4999, 'Waste and environmental'], [5000, 5199, 'Wholesale'], [5200, 5299, 'Home improvement retail'],
  [5300, 5399, 'General merchandise retail'], [5400, 5499, 'Food retail'], [5500, 5599, 'Auto retail'], [5600, 5699, 'Apparel retail'], [5700, 5799, 'Home furnishing retail'],
  [5800, 5899, 'Restaurants'], [5900, 5999, 'Specialty retail'], [6000, 6099, 'Banks'], [6100, 6199, 'Consumer and specialty finance'], [6200, 6299, 'Capital markets'],
  [6300, 6399, 'Insurance'], [6400, 6499, 'Insurance brokers'], [6500, 6599, 'Real estate services'], [6700, 6769, 'Holding and investment companies'],
  [6770, 6770, 'Blank check'], [6780, 6799, 'REITs and trusts'], [7000, 7099, 'Hotels and lodging'], [7200, 7299, 'Consumer services'], [7300, 7369, 'Business services'],
  [7370, 7379, 'Software and IT services'], [7380, 7399, 'Business services'], [7500, 7599, 'Auto services'], [7800, 7899, 'Entertainment'], [7900, 7999, 'Leisure and gaming'],
  [8000, 8099, 'Healthcare services'], [8200, 8299, 'Education'], [8700, 8799, 'Engineering and research services'], [8000, 8999, 'Services, other'],
];

export function sicGroup(sic: number | null | undefined): string | null {
  if (sic === null || sic === undefined || !Number.isFinite(sic)) return null;
  for (const [lo, hi, name] of SIC_GROUPS) if (sic >= lo && sic <= hi) return name;
  return null;
}
