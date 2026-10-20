// Maps each holding to one of the ten asset classes of the allocation design (section 8). Hybrid funds stay 'hybrid' here and are folded into equity, debt and gold by the category's mandate (allocation.ts).
// Where the category and name do not settle it the answer is null, shown as "not classified" and left out of the totals; nothing is guessed.
                                                   
                                                
// Names are matched as substrings, not whole words: exchange-traded funds are often listed as one run-together symbol (GOLDBEES, SILVERBEES, BANKBEES).
const SECTOR = /bank|psu|cpse|pharma|healthcare|itbees|nifty it\b|infra|energy|autobees|nifty auto|fmcg|consum|realty|metal|financ|defen|manufactur|capital market|chemical/;
export function assetClassOf(kind                          , name        , category = '')                    {
  const n = name.toLowerCase(), c = category.toLowerCase();
  if (kind === 'Stock') return 'direct_equity';
  if (/silver/.test(n)) return 'silver';
  if (/gold(?!man)/.test(n)) return 'gold';
  if (/nasdaq|s&p ?500|\bus\b|hang seng|hngsng|overseas|international|global|world|greater china|fang|europe|japan|mon100|mafang|mahktech|n100\b|nyse/.test(n) || /overseas|international|global/.test(c)) return 'international';
  if (/liquid|overnight|money market/.test(n + ' ' + c)) return 'liquid';
  if (kind === 'ETF') return SECTOR.test(n) && !/nifty 50|nifty next|sensex|nifty 100|nifty 200|nifty 500|midcap|smallcap/.test(n) ? 'sector_thematic' : 'index';
  if (/hybrid|arbitrage|balanced advantage|dynamic asset|multi asset|equity savings/.test(c)) return 'hybrid';
  if (/sectoral|thematic/.test(c)) return 'sector_thematic';
  if (/index funds|etf/.test(c)) return SECTOR.test(n) && !/nifty 50|nifty next|sensex|nifty 100|nifty 200|nifty 500|midcap|smallcap/.test(n) ? 'sector_thematic' : 'index';
  if (/^equity scheme|elss/.test(c)) return 'active_equity_fund';
  if (/debt|income|gilt|ultra short|low duration|floater|corporate bond|credit risk|banking and psu|short duration|medium duration|long duration|dynamic bond|fixed maturity|fmp/.test(c)) return 'debt';
  return null;
}
