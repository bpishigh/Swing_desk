// Maps each holding to one of the ten asset classes of the allocation design (section 8). Hybrid funds stay 'hybrid' here and are folded into equity, debt and gold by the category's mandate (allocation.ts).
// Where the category and name do not settle it the answer is null, shown as "not classified" and left out of the totals; nothing is guessed.
import type { TargetClass } from './allocation.ts';
export type AssetClass = TargetClass | 'hybrid';
const SECTOR = /\b(bank|banking|psu|pharma|healthcare|it\b|infra|infrastructure|energy|auto|fmcg|consumption|realty|metal|financial services|private bank|defence|manufacturing|psu bank)\b/;
export function assetClassOf(kind: 'Stock' | 'ETF' | 'Fund', name: string, category = ''): AssetClass | null {
  const n = name.toLowerCase(), c = category.toLowerCase();
  if (kind === 'Stock') return 'direct_equity';
  if (/\bsilver\b/.test(n)) return 'silver';
  if (/\bgold\b/.test(n)) return 'gold';
  if (/nasdaq|s&p ?500|\bus\b|hang seng|overseas|international|global|world|greater china|\bfang|europe|japan/.test(n) || /overseas|international|global/.test(c)) return 'international';
  if (/liquid|overnight|money market/.test(n + ' ' + c)) return 'liquid';
  if (kind === 'ETF') return SECTOR.test(n) && !/nifty 50|nifty next|sensex|nifty 100|nifty 200|nifty 500|midcap|smallcap/.test(n) ? 'sector_thematic' : 'index';
  if (/hybrid|arbitrage|balanced advantage|dynamic asset|multi asset|equity savings/.test(c)) return 'hybrid';
  if (/sectoral|thematic/.test(c)) return 'sector_thematic';
  if (/index funds|etf/.test(c)) return SECTOR.test(n) && !/nifty 50|nifty next|sensex|nifty 100|nifty 200|nifty 500|midcap|smallcap/.test(n) ? 'sector_thematic' : 'index';
  if (/^equity scheme|elss/.test(c)) return 'active_equity_fund';
  if (/debt|income|gilt|ultra short|low duration|floater|corporate bond|credit risk|banking and psu|short duration|medium duration|long duration|dynamic bond|fixed maturity|fmp/.test(c)) return 'debt';
  return null;
}
