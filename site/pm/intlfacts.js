// International-fund facts (scope item 7): fund size, expense ratio, exit load, benchmark and riskometer, read from the public structured data on a sharpely.in fund page. Facts only; nothing here moves a score.
                                                                                                                                                               

const unesc = (s        )         => s.replace(/\\"/g, '"').replace(/&amp;/g, '&');
const prop = (html        , name        )                => {
  const m = new RegExp('\\\\?"name\\\\?":\\\\?"' + name + '\\\\?",\\\\?"value\\\\?":\\\\?"([^"\\\\]*)').exec(html);
  return m ? unesc(m[1]).trim() || null : null;
};
const num = (s               )                => { if (!s) return null; const n = parseFloat(s.replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

export function parseIntlPage(html        )                   {
  const aum = num(prop(html, 'AUM')), ter = num(prop(html, 'Expense Ratio')), bench = prop(html, 'Benchmark'), risk = prop(html, 'Risk Level'), inception = prop(html, 'Inception Date');
  const fee = /feesAndCommissionsSpecification\\?":\\?"([^"\\]*)/.exec(html)?.[1] ?? '', ex = /Exit load ([^;]*?)(?:;|$)/i.exec(fee)?.[1]?.trim() || null;
  if (aum === null && ter === null && !bench) return null;
  return { aum, ter, exit: ex && !/^(nil|none|0)/i.test(ex) ? ex : ex ? 'none' : null, bench, risk, inception };
}

const STOP = /\b(direct|plan|growth|option|regular|the|of|fund|funds|fof|fund of funds?|active|passive|omni|overseas|equity|scheme|india)\b/g;
/** A fund name or a page slug reduced to the words that tell funds apart. */
export const intlKey = (s        )         => s.toLowerCase().replace(/directgrowth|direct-plangrowth|direct-fundgrowth/g, ' ').replace(/&/g, ' and ').replace(/fund of funds?/g, ' ').replace(/-/g, ' ').replace(STOP, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
