// Exit-load wording from a fund page (sharpely.in `exit_load_note`) turned into the structure the sale plans use. Facts only; anything not understood returns null and the fund stays flagged "check the load".
                                               

                                                                        
const UNIT                         = { day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30, year: 365, years: 365, yr: 365, yrs: 365 };
const WORDNUM                         = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const num = (s        )         => (WORDNUM[s.toLowerCase()] ?? parseFloat(s));
const period = (n        , u        )         => { const k = UNIT[u.toLowerCase()], v = num(n); return k && Number.isFinite(v) ? Math.round(v * (k === 30 && v === 12 ? 365 / 12 : k)) : NaN; };
const NUM = '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|twelve)', UN = '(days?|weeks?|months?|years?|yrs?)';

/** SEBI's graded schedule for liquid funds: 0.0070% on day 1 falling 0.0005 points a day to 0.0045% on day 6, nil from day 7. */
const GRADED = [1, 2, 3, 4, 5, 6].map((d) => ({ days: d, pct: (75 - 5 * d) / 1e6 }));

export function parseExitNote(raw                           )             {
  const t = (raw ?? '').replace(/\\r|\\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { load: null };
  if (/^(nil|none|no exit load|no load)\b/i.test(t) || /^exit load[: ]+(nil|none)\b/i.test(t)) return { load: { days: 0, pct: 0 } };
  const fm = /(?:in excess of|beyond|above|more than|exceeding)\s+(\d+(?:\.\d+)?)\s*%/i.exec(t) ?? /(\d+(?:\.\d+)?)\s*%\s+of (?:the )?(?:units|investment)\s+(?:is |are )?(?:free|exempt|without)/i.exec(t);
  const free = fm ? parseFloat(fm[1]) / 100 : 0;
  // Graded liquid schedule: "0.0070% if redeemed within 1 day, 0.0065% ... within 2 days ..."
  const gr = [...t.matchAll(new RegExp('(\\d+\\.\\d{3,5})\\s*%[^%]*?within\\s+' + NUM + '\\s+' + UN, 'gi'))];
  if (gr.length >= 2) {
    const tiers = gr.map((m) => ({ days: period(m[2], m[3]), pct: parseFloat(m[1]) / 100 })).filter((x) => x.days > 0 && Number.isFinite(x.pct));
    if (tiers.length >= 2) {
      const std = tiers.every((x) => GRADED.some((g) => g.days === x.days && Math.abs(g.pct - x.pct) < 1e-7));
      const full = std && tiers.length < 6;   // the page cuts the wording short: complete a schedule that matches SEBI's
      const use = full ? GRADED : tiers;
      return { load: { days: use[use.length - 1].days, pct: use[0].pct, tiers: use }, ...(!full && !/day[s]?\.?\s*$/i.test(t) ? { partial: true } : {}) };
    }
  }
  // Tiers: "2% if redeemed within 365 days and 1% if redeemed after 365 days but within 730 days" / "1% within 1 year"
  const hits                                = [];
  for (const m of t.matchAll(new RegExp('(\\d+(?:\\.\\d+)?)\\s*%[^%.;]*?(?:within|before|up ?to|on or before|less than|for redemption within|redeemed within)\\s+(?:the first\\s+)?' + NUM + '[\\s-]*' + UN, 'gi'))) {
    const to = period(m[2], m[3]), pct = parseFloat(m[1]) / 100; if (to > 0 && Number.isFinite(pct)) hits.push({ pct, to });
  }
  for (const m of t.matchAll(new RegExp('(\\d+(?:\\.\\d+)?)\\s*%[^%]*?after\\s+' + NUM + '\\s*' + UN + '[^%]*?(?:but\\s+)?(?:within|before|up ?to|on or before)\\s+' + NUM + '\\s*' + UN, 'gi'))) {
    const to = period(m[4], m[5]), pct = parseFloat(m[1]) / 100; if (to > 0 && Number.isFinite(pct)) hits.push({ pct, to });
  }
  if (!hits.length) return { load: null };
  hits.sort((a, b) => a.to - b.to);
  const uniq = hits.filter((h, i) => i === 0 || h.to !== hits[i - 1].to);
  // "within N days" means the load applies up to and including day N, so the tier ends the day after.
  const tiers = uniq.map((h) => ({ days: h.to + 1, pct: h.pct }));
  const load           = tiers.length === 1 ? { days: tiers[0].days, pct: tiers[0].pct } : { days: tiers[tiers.length - 1].days, pct: tiers[0].pct, tiers };
  return { load: free > 0 ? { ...load, free } : load };
}
