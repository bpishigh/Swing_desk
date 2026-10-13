// Tax/charge class of an instrument. Heuristic on name and kind, overridable per ISIN in data/portfolio/instrument-overrides.json
// (the AMFI category replaces the heuristic for funds when the fund-data adapter lands). Unknown funds stay unclassified: no guess.
                                         
                                                                                                                                                                            
/** Zerodha files carry only the trading symbol, so international ETFs are also recognised by symbol. */
const INTL_SYMBOL = /^(MAFANG|MAHKTECH|MON100|MASPTOP50|HNGSNGBEES|MONASDAQ|MAESGETF)$/i;
/** Display kind for the holdings table: a listed ETF, a direct stock or (decided by the caller) a fund. */
export const isEtf = (name        , type           )          => type === 'gold_silver_etf' || type === 'intl_etf' || /\b(etf|bees)\b|(etf|bees)$/i.test(name);
export function assetType(t                                             , overrides                            = {})            {
  if (overrides[t.isin]) return overrides[t.isin];
  const n = t.instrument.toLowerCase();
  if (t.kind === 'fund') return 'fund_unclassified';
  if (/gold|silver/.test(n) && /(etf|bees|case|fund)/.test(n)) return 'gold_silver_etf';
  if (/nasdaq|s&p ?500|hang ?seng|\bus\b ?tech|international|overseas|top ?50|mon100|n100|fang|nyse|china|msci/.test(n) && /etf|bees|fund/.test(n)) return 'intl_etf';
  if (INTL_SYMBOL.test(t.instrument)) return 'intl_etf';
  if (/^[A-Z]{1,5}$/.test(t.instrument) && !t.isin.startsWith('IN')) return 'us_stock';
  return 'listed_equity';
}
