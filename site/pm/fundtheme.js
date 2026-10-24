// Theme of a sectoral or thematic fund, read from its name (C-96). Funds in the Sectoral/Thematic category are not comparable across themes, so a switch alternative must share the theme.
const THEMES                     = [
  ['pharma and healthcare', /pharma|health|wellness/i], ['banking and financial', /banking|financial|bfsi/i], ['technology', /technology|digital|\bit\b|tech\b/i],
  ['consumption', /consumption|fmcg|rural/i], ['infrastructure', /infrastructure|infra\b|build india|housing|real estate/i], ['manufacturing', /manufactur|make in india/i],
  ['energy and commodities', /energy|power|commodit|natural resources|oil|gas/i], ['PSU', /\bpsu\b|public sector/i], ['MNC', /\bmnc\b|multinational/i],
  ['transportation', /transport|logistics|automotive|\bauto\b|mobility|\bev\b/i], ['innovation', /innovation|new age|disrupt/i], ['business cycle', /business cycle/i],
  ['ESG', /\besg\b|sustainab/i], ['quant and factor', /quant|momentum|multi-factor|multifactor|minimum variance|quality|low volatility|alpha/i], ['conglomerate', /conglomerate/i],
  ['international', /us bluechip|asian|global|overseas|international|nasdaq|world/i], ['defence', /defen[cs]e|aerospace/i], ['IPO', /\bipo\b|recently listed/i], ['service exports', /export|services/i],
];
/** Theme key, or null when the name matches none (such a fund is offered no alternative). */
export function themeOf(name        )                { const n = name.replace(/\s+-\s+Direct.*$/i, ''); for (const [k, re] of THEMES) if (re.test(n)) return k; return null; }
