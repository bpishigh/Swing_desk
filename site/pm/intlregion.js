// Where an international fund invests, read from its benchmark and name (scope item 7). This is the fund's stated target market, not a count of what it holds today: the fund pages carry no country table and the overseas fund underneath is not published as data we can read. Facts only; nothing here moves a score or a limit.
                                                                                      
const R = (key        , label        , currency        , note        )         => ({ key, label, currency, note });
export const REGIONS = {
  us: R('us', 'United States', 'US dollar', 'US companies only'),
  usbond: R('usbond', 'US government bonds', 'US dollar', 'US Treasury bonds, not shares'),
  world: R('world', 'Developed world (mostly US)', 'US dollar, euro, yen and others', 'a world index: the US is the largest part, usually well over half'),
  acwi: R('acwi', 'Whole world incl. emerging (mostly US)', 'US dollar and many others', 'all-country index: the US is the largest part'),
  em: R('em', 'Emerging markets', 'many currencies', 'China, India, Taiwan, Korea, Brazil and others'),
  europe: R('europe', 'Europe', 'euro, pound, Swiss franc', 'UK and euro-area companies'),
  china: R('china', 'China and Hong Kong', 'Hong Kong dollar, US dollar, yuan', 'Chinese companies listed in Hong Kong, China and the US'),
  asia: R('asia', 'Asia outside Japan', 'many Asian currencies', 'Asia-Pacific companies'),
  asean: R('asean', 'South-East Asia', 'Singapore dollar, Thai baht, others', 'Singapore, Thailand, Indonesia, Malaysia and others'),
  brazil: R('brazil', 'Brazil', 'Brazilian real', 'Brazilian companies'),
  exus: R('exus', 'Developed world outside the US', 'euro, yen, pound and others', 'Europe, Japan, Australia, Canada and others'),
  theme: R('theme', 'Global theme or sector', 'mostly US dollar', 'one theme or sector across the world; the US is usually the largest part'),
  reit: R('reit', 'Asia-Pacific property', 'many Asian currencies', 'listed property companies'),
  unknown: R('unknown', 'Not classified', '', ''),
}         ;
                                             

/** Rules read top to bottom on the benchmark first, then the fund name; the first match wins. */
const RULES                        = [
  [/nasdaq|s&p ?500|russell|russel|nyse fang|\bfang\b/i, 'us'],
  [/treasury|government bond|u\.?s\.? specific debt|us specific.*(treasury|debt)/i, 'usbond'],
  [/reit|property/i, 'reit'],
  [/\bgold\b|mining|metal|clean energy|innovation|artificial intelligence|electric|autonomous|aqua|brand|consumer/i, 'theme'],
  [/golden dragon|greater china|hang seng|china/i, 'china'],
  [/brazil/i, 'brazil'],
  [/asean/i, 'asean'],
  [/asia pacific|asia-pacific|ex.?japan/i, 'asia'],
  [/emerging/i, 'em'],
  [/europe/i, 'europe'],
  [/ex.?u\.?s|developed market ex/i, 'exus'],
  [/nasdaq|s&p ?500|russell|russel|nyse|fang|\bu\.?s\.?\b|america|united states/i, 'us'],
  [/msci (all country|acwi)|acwi|all country world/i, 'acwi'],
  [/msci world|world net|world index/i, 'world'],
  [/global|world|international|overseas/i, 'world'],
];
const THEME = /\bgold\b|mining|metal|clean energy|innovation|artificial intelligence|electric|autonomous|aqua|brand|consumer|technology|tech\b/i;
const match = (hay        )                   => { if (!hay || /^n\/a$/i.test(hay)) return null; for (const [re, k] of RULES) if (re.test(hay)) return k; return null; };
export function intlRegion(name        , bench                )         {
  let k = match(bench ?? '');
  // a whole-world benchmark with a theme in the fund's name is a global theme fund
  if ((k === null || k === 'acwi' || k === 'world') && THEME.test(name)) k = 'theme';
  if (k === 'acwi' && /emerging/i.test(name)) k = 'em';
  if (k === null) k = match(name);
  return REGIONS[k ?? 'unknown'];
}
/** Tax on gains in a fund that invests overseas: same as a debt fund (slab rate), whatever the holding period, for units bought from 1 Apr 2023. */
export const INTL_TAX_NOTE = 'Gains are taxed at your slab rate, whatever the holding period (as for a debt fund). The rupee value moves with the currency too.';
