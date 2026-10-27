// Schedule CG export: every realised sale row grouped the way the income-tax return asks for capital gains (design 7.1). Pure: rows in, CSV and totals out. Built in the browser; nothing is uploaded. A working aid to copy figures from, not a filed return.
                                          
                                               
import { fy } from './tax.js';
                                                        

                                                                                                                                                                                                                              
                                                                                                                        
const KEY_ISIN = /^IN[EF][0-9A-Z]{9}$/;

export function cgRows(rep        , typeOf                            , nameOf                         , expense                                           , rules       )          {
  return rep.realised.map((r) => {
    const type = typeOf(r.key), rule = rules.types[type]                                                                                               ;
    const longAfter = !rule ? null : rule.deemed_short_if_bought_on_or_after && r.buyDate >= rule.deemed_short_if_bought_on_or_after ? 1e9 : rule.long_after_days;
    const exp = expense(r);
    return { fy: fy(r.sellDate), name: nameOf(r.key), isin: KEY_ISIN.test(r.key) ? r.key : '', type, buyDate: r.buyDate, sellDate: r.sellDate, qty: r.qty, proceeds: r.proceeds, cost: r.cost, expenses: exp, gain: r.gain - exp, term: longAfter === null ? null : r.days > longAfter ? 'long' : 'short' };
  });
}

/** The return section a row belongs to: listed equity and equity funds (STT paid, exemption applies) go to 111A or 112A; everything else is other short-term (slab) or other long-term. */
export function sectionOf(row       , rules       )            {
  const rule = rules.types[row.type                        ]                                      ;
  if (!rule || row.term === null) return 'Not classified';
  if (rule.exemption) return row.term === 'long' ? '112A' : '111A';
  return row.term === 'long' ? 'Long-term, other (112)' : 'Short-term, other (slab rate)';
}

const csvCell = (v                 )         => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const r2 = (x        )         => Math.round(x * 100) / 100;
                                                                                                                          

/** One financial year for one person. `fyId` is like "2025-26". */
export function scheduleCg(rows         , fyId        , person        , rules       )                                                                      {
  const mine = rows.filter((r) => r.fy === fyId).sort((a, b) => sectionOf(a, rules).localeCompare(sectionOf(b, rules)) || a.name.localeCompare(b.name) || a.sellDate.localeCompare(b.sellDate));
  const tot = new Map                     ();
  for (const r of mine) { const s = sectionOf(r, rules), t = tot.get(s) ?? tot.set(s, { section: s, rows: 0, sale: 0, cost: 0, expenses: 0, gain: 0 }).get(s) ; t.rows++; t.sale += r.proceeds; t.cost += r.cost; t.expenses += r.expenses; t.gain += r.gain; }
  const notes           = [];
  const old = mine.filter((r) => sectionOf(r, rules) === '112A' && r.buyDate < '2018-02-01').length;
  if (old) notes.push(`${old} long-term equity row${old > 1 ? 's were' : ' was'} bought before 1 Feb 2018: the cost is the actual cost; the grandfathered cost (higher of actual cost and the lower of the 31 Jan 2018 price and the sale value) is not applied. Fill it from the return utility.`);
  const none = mine.filter((r) => r.term === null).length; if (none) notes.push(`${none} row${none > 1 ? 's' : ''} could not be classified (fund type unknown) and sit under "Not classified".`);
  notes.push('Gain is after deductible charges (brokerage, stamp duty, exchange levy; STT is not deductible). Fund units are matched first-in-first-out per fund. Same-year set-off, the exemption and carry-forward are not applied in this file: the return does that.');
  const head = ['Section', 'Name', 'ISIN', 'Units', 'Buy date', 'Sell date', 'Sale value', 'Cost of acquisition', 'Expenses', 'Gain or loss', 'Holding'];
  const lines           = [`Schedule CG working: ${person}, FY ${fyId}`, head.join(',')];
  for (const r of mine) lines.push([sectionOf(r, rules), r.name, r.isin, r.qty, r.buyDate, r.sellDate, r2(r.proceeds), r2(r.cost), r2(r.expenses), r2(r.gain), r.term ?? ''].map(csvCell).join(','));
  lines.push('', 'Totals by section', ['Section', 'Rows', 'Sale value', 'Cost of acquisition', 'Expenses', 'Gain or loss'].join(','));
  const totals = [...tot.values()].sort((a, b) => a.section.localeCompare(b.section));
  for (const t of totals) lines.push([t.section, t.rows, r2(t.sale), r2(t.cost), r2(t.expenses), r2(t.gain)].map(csvCell).join(','));
  lines.push('', ...notes.map((n) => csvCell('Note: ' + n)));
  return { csv: lines.join('\n') + '\n', totals, notes, count: mine.length };
}
