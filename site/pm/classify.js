// Tax/charge class of an instrument. Heuristic on name and kind, overridable per ISIN in data/portfolio/instrument-overrides.json
// (the AMFI category replaces the heuristic for funds when the fund-data adapter lands). Unknown funds stay unclassified: no guess.
                                         
                                                                                                                                                                            
export function assetType(t                                             , overrides                            = {})            {
  if (overrides[t.isin]) return overrides[t.isin];
  const n = t.instrument.toLowerCase();
  if (t.kind === 'fund') return 'fund_unclassified';
  if (/gold|silver/.test(n) && /(etf|bees|case|fund)/.test(n)) return 'gold_silver_etf';
  if (/nasdaq|s&p ?500|hang ?seng|\bus\b ?tech|international|overseas|top ?50|mon100|n100/.test(n) && /etf|bees|fund/.test(n)) return 'intl_etf';
  if (/^[A-Z]{1,5}$/.test(t.instrument) && !t.isin.startsWith('IN')) return 'us_stock';
  return 'listed_equity';
}
