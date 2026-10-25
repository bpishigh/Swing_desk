// Debt-fund portfolio statistics (scope K5): yield to maturity, average maturity, modified duration and credit quality, read from sharpely.in's public holdings page for a fund. Facts only; nothing here changes a score or a verdict.
                                                                                                                                                                                                                         
const num = (s                    )                => { if (!s) return null; const n = parseFloat(s.replace(/[,%\s]|yrs?|years?/gi, '')); return Number.isFinite(n) ? n : null; };
const text = (s        ) => s.replace(/<!--\s*-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** A label and the value beside it: <div>Label</div><div>Value</div>. */
const pair = (html        , label        )                     => { const i = html.indexOf('>' + label + '<'); if (i < 0) return undefined; const m = /<\/div><div[^>]*>([^<]*)</.exec(html.slice(i, i + 600)); return m ? m[1] : undefined; };

export function parseDebtPage(html        )                   {
  const ytm = num(pair(html, 'Yield to Maturity')), md = num(pair(html, 'Modified Duration')), am = num(pair(html, 'Avg. Maturity')) ?? num(pair(html, 'Average Maturity'));
  const ci = html.indexOf('Credit Quality Profile'), credit                      = [];
  if (ci >= 0) { const tb = html.slice(ci, ci + 12000), body = /<tbody>([\s\S]*?)<\/tbody>/.exec(tb); if (body) for (const row of body[1].split('</tr>')) { const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => text(c[1])); if (cells.length >= 2 && cells[0]) { const f = num(cells[1]); if (f !== null) credit.push({ r: cells[0], fund: f, cat: cells.length > 2 ? num(cells[2]) : null }); } } }
  if (ytm === null && md === null && am === null && !credit.length) return null;
  const t = /<title>[^<]*\(([A-Z][a-z]+ \d{4})\)/.exec(html);
  return { asOf: t ? t[1] : null, ytm, avgMat: am, modDur: md, nSec: num(pair(html, 'No. of Securities')), top5: num(pair(html, 'Top 5 Holdings %')), credit };
}

const STOP = /\b(direct|plan|fund|growth|option|regular|the|of)\b/g;
/** A fund name or a page slug reduced to the words that tell funds apart. */
export const debtKey = (s        )         => s.toLowerCase().replace(/directgrowth|direct-plangrowth|direct-fundgrowth/g, ' direct growth ').replace(/&/g, ' and ').replace(STOP, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Credit quality in two lines: the safest paper (government, AAA, A1+, cash) and everything lower. */
export function creditSplit(c                     )                                                 {
  let safe = 0, lower = 0, other = 0;
  for (const x of c) { if (/^(sov|aaa|a1\+|cash|call|tbill|t-?bill|gsec|treasury|repo|cblo|reverse)/i.test(x.r) || /cash|call money|sovereign/i.test(x.r)) safe += x.fund; else if (/^(aa|a\b|a[1-3]|bbb|bb|b\b|c\b|d\b|unrated)/i.test(x.r) || /^[ab]{1,3}[+-]?$/i.test(x.r)) lower += x.fund; else other += x.fund; }
  const r1 = (v        ) => Math.round(v * 10) / 10; return { safe: r1(safe), lower: r1(lower), other: r1(other) };
}
