import { intlRegion } from './intlregion.js';
// The fund detail card shared by the Funds tab and the Portfolio page (Engine Rules C-108 facts, C-101 holdings trend). Pure: data in, HTML out. Information only.
                                                                                                                                                                                                                                                                                                                                                                                                                                                         
                                                                                           
                                                          
                                                                                                                            
const esc = (s         ) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]          ));
const sg = (x        , d = 1) => (x > 0 ? '+' : '') + x.toFixed(d) + '%';
export function fundCard(c        )         {
  const { fq, hh } = c;
  const tile = (t      ) => `<div class="ft"><div class="fk">${esc(t.k)}</div><div class="fv">${t.v}</div>${t.s ? `<div class="fs">${esc(t.s)}</div>` : ''}</div>`;
  const facts         = fq ? [
    { k: 'Fund size', v: fq.aum != null ? '₹' + Math.round(fq.aum).toLocaleString('en-IN') + ' cr' : '–' },
    { k: 'Expense ratio', v: fq.expense != null ? fq.expense + '%' : '–', s: 'a year' },
    { k: 'Turnover', v: fq.turnover != null ? fq.turnover + '%' : '–', s: 'of the portfolio traded a year' },
    { k: 'Benchmark', v: `<span class="fvs">${esc(fq.benchmark ?? '–')}</span>` },
    ...(fq.mix ? [
      { k: 'Government and cash', v: (fq.mix.gov + fq.mix.cash).toFixed(1) + '%', s: `government paper ${fq.mix.gov}% · cash and repo ${fq.mix.cash}%` },
      { k: 'Company debt', v: (fq.mix.paper + fq.mix.corp).toFixed(1) + '%', s: `bonds ${fq.mix.corp}% · money-market paper ${fq.mix.paper}% · no credit rating on the page` },
      ...(fq.mix.top[0] ? [{ k: 'Largest issuer', v: `<span class="fvs">${esc(fq.mix.top[0].name)}</span>`, s: fq.mix.top[0].pct + '% of the fund' + (fq.mix.asOf ? ' · as of ' + fq.mix.asOf : '') }] : []),
    ] : []),
  ] : [];
  const tiles = (c.tiles ?? []).concat(facts.filter((t) => t.v !== '–'));
  const mg = fq && fq.managers.length ? `<div class="fmg">${fq.managers.map((m) => `<span class="fchip${fq.flags.some((x) => x.kind === 'new-manager' && x.text.startsWith(m.name)) ? ' warn' : ''}">${esc(m.name)}${m.since ? `<small>since ${esc(m.since.slice(0, 7))}</small>` : ''}</span>`).join('')}</div>` : '';
  const vs = fq?.vs5 ? (() => { const v = fq.vs5 , mx = Math.max(v.fund, v.benchR5, 1), d = v.fund - v.benchR5; return `<div class="fbox"><div class="fh">5-year return a year</div><div class="fbar"><span>This fund</span><i style="width:${Math.max(2, 100 * v.fund / mx)}%" class="${d >= 0 ? 'g' : 'r'}"></i><b>${v.fund}%</b></div><div class="fbar"><span>${esc(v.bench)} index funds</span><i style="width:${Math.max(2, 100 * v.benchR5 / mx)}%"></i><b>${v.benchR5}%</b></div><div class="fs">${d >= 0 ? 'Ahead' : 'Behind'} by ${Math.abs(d).toFixed(1)} points a year (median of ${v.n} funds). A fact, not a prediction; closed funds are missing.</div></div>`; })() : '';
  const tr = hh ? `<div class="fbox"><div class="fh">What its stocks are doing</div><div class="fbar"><span>Above 200-day average</span><i style="width:${Math.round(100 * hh.aboveShare)}%"></i><b>${Math.round(100 * hh.aboveShare)}%</b></div><div class="fs">Its stocks returned ${sg(100 * hh.ret6m)} over 6 months${hh.pct === null ? '' : ' · ' + Math.round(hh.pct) + 'th percentile among ' + esc(hh.cat) + ' funds'}. Information only: a back-test (C-104) did not show it predicts returns, so it drives nothing.</div></div>` : '';
  const fl = fq?.flags.length ? `<div class="fflag">${fq.flags.map((x) => esc(x.text)).join(' · ')}</div>` : '';
  const why = (c.why ?? []).filter(Boolean);
  return `<div class="fcard">${why.length ? `<div class="fwhy">${why.map((r) => `<p>${esc(r)}</p>`).join('')}</div>` : ''}${grid(tiles, tile)}${mg}${fl}${vs || tr ? `<div class="frow">${vs}${tr}</div>` : ''}${fq ? '<div class="fs fnote">Facts only (C-108). They carry no weight in the score and change no verdict.</div>' : ''}${(c.after ?? []).join('')}${c.note ? `<div class="fs fnote">${esc(c.note)}</div>` : ''}</div>`;
}
                                                                                                                                                                                                                                 
                                                                                                                                                                                                                                                        
const inr0 = (x        ) => Math.round(x).toLocaleString('en-IN');
const crl = (x        ) => { const a = Math.abs(x), g = x < 0 ? '−' : ''; return a >= 1e7 ? g + '₹' + (a / 1e7).toFixed(2) + ' cr' : a >= 1e5 ? g + '₹' + (a / 1e5).toFixed(2) + ' L' : g + '₹' + inr0(a); };
/** "If you sold this today": what you would keep, and how the money splits into long-term, short-term, inside exit load and locked. Facts only; nothing is sold from here. */
export function sellCostCard(c        )         {
  if (!c.lots.length || c.value <= 0) return '';
  const part = { lt: 0, st: 0, load: 0, lock: 0 };
  for (const l of c.lots) { if (l.locked) part.lock += l.value; else if (l.load > 0) part.load += l.value; else if (l.long) part.lt += l.value; else part.st += l.value; }
  const seg = (k                   , label        , cls        ) => part[k] > 0 ? `<i class="${cls}" style="width:${(100 * part[k] / c.value).toFixed(1)}%" title="${label}: ${crl(part[k])}"></i>` : '';
  const leg = (k                   , label        , cls        ) => part[k] > 0 ? `<span><i class="${cls}"></i>${label} ${crl(part[k])}</span>` : '';
  const tile = (k        , v        , s         ) => `<div class="ft"><div class="fk">${esc(k)}</div><div class="fv sm">${v}</div>${s ? `<div class="fs">${esc(s)}</div>` : ''}</div>`;
  const cost = (c.tax ?? 0) + c.load + c.charges, bullets           = [];
  const turning = c.lots.filter((l) => l.longOn && !l.locked).sort((a, b) => (a.longOn          ).localeCompare(b.longOn          ));
  if (turning.length) { const last = turning[turning.length - 1].longOn, sv = turning.reduce((t, l) => t + Math.max(0, (l.tax ?? 0) - (l.taxIfLong ?? l.tax ?? 0)), 0); bullets.push(`${turning.length} lot${turning.length > 1 ? 's' : ''} (${crl(turning.reduce((t, l) => t + l.value, 0))}) turn long-term between ${turning[0].longOn} and ${last}${sv > 1 ? `; selling after ${last} instead of today would cut the tax by about ${crl(sv)} (before any exemption)` : ''}.`); }
  const ld = c.lots.filter((l) => l.loadEnds).map((l) => l.loadEnds          ).sort(); if (ld.length) bullets.push(`Exit load of ${crl(c.load)} falls away after ${ld[ld.length - 1]}.`);
  const lk = c.lots.filter((l) => l.locked && l.lockEnd).map((l) => l.lockEnd          ).sort(); if (lk.length) bullets.push(`${crl(part.lock)} is inside the 3-year ELSS lock-in until ${lk[lk.length - 1]} and cannot be sold before then.`);
  const lotRows = [...c.lots].sort((a, b) => a.date.localeCompare(b.date)).map((l) => {
    const st = l.locked ? `<span class="lkc">Locked until ${esc(l.lockEnd ?? '')}</span>` : l.load > 0 ? `<span class="ldc">Exit load${l.loadEnds ? ' to ' + esc(l.loadEnds) : ''}</span>` : l.long ? '<span class="ltc">Long-term</span>' : `<span class="stc">Short-term${l.longOn ? ' until ' + esc(l.longOn) : ''}</span>`;
    return `<tr><td>${esc(l.date)}</td><td class="n">${crl(l.value)}</td><td class="n ${l.gain >= 0 ? 'fpos' : 'fneg'}">${crl(l.gain)}</td><td>${st}</td><td class="n">${l.tax === null ? '–' : crl(l.tax)}</td><td class="n">${l.load > 0 ? crl(l.load) : '–'}</td></tr>`;
  }).join('');
  const lotTable = c.lots.length > 1 ? `<details class="how"><summary>Lot by lot (${c.lots.length} lots, oldest first)</summary><div class="lotwrap"><table class="lots"><thead><tr><th>Bought</th><th class="n">Worth</th><th class="n">Gain</th><th>Status</th><th class="n">Tax</th><th class="n">Exit load</th></tr></thead><tbody>${lotRows}</tbody></table></div></details>` : '';
  return `<div class="fbox sellbox"><div class="fh">If you sold all of it today</div><div class="fgrid sellgrid">${tile('Value', crl(c.value))}${tile('Gain', `<span class="${c.gain >= 0 ? 'fpos' : 'fneg'}">${crl(c.gain)}</span>`, `long-term ${crl(c.longGain)} · short-term ${crl(c.shortGain)}`)}${tile('Tax', c.tax === null ? 'not priced' : crl(c.tax), c.tax !== null && c.taxWithExemption != null && c.exemptionLeft !== undefined && c.taxWithExemption < c.tax - 1 ? `no free limit counted, as other sales may use it. If this is your only sale this year, ₹${inr0(c.exemptionLeft)} of tax-free long-term gains are left and the tax is ${crl(c.taxWithExemption)}` : '')}${tile('Exit load', crl(c.load))}${tile('You keep', crl(c.net), cost > 0 ? (100 * cost / c.value).toFixed(2) + '% lost to tax and costs' : '')}</div><div class="sbar">${seg('lt', 'Long-term', 'lt')}${seg('st', 'Short-term', 'st')}${seg('load', 'Inside exit load', 'ld')}${seg('lock', 'Locked', 'lk')}</div><div class="sleg">${leg('lt', 'Long-term', 'lt')}${leg('st', 'Short-term', 'st')}${leg('load', 'Inside exit load', 'ld')}${leg('lock', 'Locked (ELSS)', 'lk')}</div>${bullets.map((b) => `<div class="fs">${esc(b)}</div>`).join('')}${lotTable}${c.notes.map((n) => `<div class="fs">${esc(n)}</div>`).join('')}<div class="fs">Every lot is priced at the latest close, first-in-first-out per account. Estimate before surcharge and cess; not tax advice. Nothing is sold from here.</div></div>`;
}
/** Stock detail in the same card style: tiles of label, value and one grey line. */
/** The first tiles show; the rest sit behind one link, so a card opens as a short grid of facts. */
const SHOW = 8;
function grid   (tiles     , tile                  )         {
  if (!tiles.length) return '';
  const head = tiles.slice(0, SHOW), rest = tiles.slice(SHOW);
  return `<div class="fgrid">${head.map(tile).join('')}</div>${rest.length ? `<details class="how"><summary>${rest.length} more fact${rest.length > 1 ? 's' : ''}</summary><div class="fgrid">${rest.map(tile).join('')}</div></details>` : ''}`;
}
export function stockCard(c                                                        )         {
  const tile = (t      ) => `<div class="ft"><div class="fk">${esc(t.k)}</div><div class="fv sm">${t.v}</div>${t.s ? `<div class="fs">${esc(t.s)}</div>` : ''}</div>`;
  return `<div class="fcard">${grid(c.tiles, tile)}${(c.blocks ?? []).join('')}${(c.notes ?? []).map((n) => `<div class="fs fnote">${esc(n)}</div>`).join('')}</div>`;
}
export const CARD_CSS = `.fcard{padding:6px 4px 10px;max-width:980px}.fwhy p{margin:0 0 4px;font-size:13px;color:var(--ink)}.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0}.ft{background:var(--accent-soft,var(--accent-bg));border-radius:10px;padding:9px 12px}.fk{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}.fv{font-size:20px;font-weight:650;margin-top:2px}.fv.sm{font-size:16px}.fvs{font-size:13px;font-weight:600;line-height:1.3;display:block}.fs{font-size:12px;color:var(--muted);margin-top:3px;white-space:normal}.fmg{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.fchip{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:12.5px}.fchip small{color:var(--muted);margin-left:6px}.fchip.warn{background:var(--yellow-bg);border-color:var(--yellow);color:var(--yellow)}.frow{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}.fbox{border:1px solid var(--line);border-radius:10px;padding:10px 14px;background:var(--panel)}.fh{font-size:12px;font-weight:600;margin-bottom:8px}.fbar{display:grid;grid-template-columns:140px 1fr 52px;align-items:center;gap:8px;margin:5px 0;font-size:12.5px}.fbar span{color:var(--muted);white-space:normal}.fbar i{display:block;height:10px;border-radius:5px;background:var(--accent)}.fbar i.g{background:var(--green)}.fbar i.r{background:var(--red)}.fbar b{text-align:right}.fflag{margin:6px 0 10px;padding:6px 12px;border-radius:8px;background:var(--yellow-bg);color:var(--yellow);font-size:12.5px}.fnote{margin-top:10px}.sellbox{margin-top:10px}.sellgrid{margin:4px 0 10px}.sbar{display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--line)}.sbar i,.sleg i{display:block}.sbar i.lt,.sleg i.lt{background:var(--green)}.sbar i.st,.sleg i.st{background:var(--yellow)}.sbar i.ld,.sleg i.ld{background:var(--red)}.sbar i.lk,.sleg i.lk{background:var(--muted)}.sleg{display:flex;flex-wrap:wrap;gap:4px 14px;margin:6px 0 4px;font-size:12px;color:var(--muted)}.sleg span{display:inline-flex;align-items:center;gap:5px}.sleg i{width:10px;height:10px;border-radius:3px}.fpos{color:var(--green)}.fneg{color:var(--red)}.lotwrap{overflow-x:auto;margin-top:6px}.lots{width:100%;border-collapse:collapse;font-size:12.5px}.lots th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);font-weight:600}.lots td{padding:5px 8px;border-bottom:1px solid var(--line);white-space:nowrap}.lots .n{text-align:right;font-variant-numeric:tabular-nums}.lots th.n{text-align:right}.ltc{color:var(--green)}.stc{color:var(--yellow)}.ldc{color:var(--red)}.lkc{color:var(--muted)}`;
if (typeof document !== 'undefined' && !document.getElementById('fcard-css')) { const s = document.createElement('style'); s.id = 'fcard-css'; s.textContent = CARD_CSS; document.head.appendChild(s); }

/** Tiles of business facts for a stock card (scope K3): valuation, results growth, holding by quarter and promoter pledge. Facts only. */
export function factTiles(f                                                                                                                                                                                                                                                                                                                                                                                                                         )         {
  if (!f) return [];
  const n = (x               , d = 1, suf = '') => (x === null || x === undefined ? '–' : x.toFixed(d) + suf), sg = (x               ) => (x === null ? '–' : (x > 0 ? '+' : '') + x.toFixed(1) + '%');
  const t         = [], h = f.pattern, last = h[h.length - 1], back = h.length >= 5 ? h[h.length - 5] : h[0];
  if (f.pe !== null || f.pb !== null) t.push({ k: 'Valuation', v: `P/E ${n(f.pe)}`, s: `P/B ${n(f.pb)}${f.roe !== null ? ' · ROE ' + n(f.roe, 1, '%') : ''}${f.de != null ? ' · debt/equity ' + n(f.de, 2) : ''}` });
  if (f.revYoY !== null || f.profitYoY !== null) t.push({ k: 'Last year growth', v: `sales ${sg(f.revYoY)}`, s: `profit ${sg(f.profitYoY)}` });
  if (f.qRevYoY !== null || f.qProfitYoY !== null) t.push({ k: 'Latest quarter growth', v: `sales ${sg(f.qRevYoY)}`, s: `profit ${sg(f.qProfitYoY)} · against a year earlier` });
  if (last) { const d = (a        , b        ) => { const x = a - b; return (x > 0 ? '+' : '') + x.toFixed(1); }; t.push({ k: 'Promoter holding', v: n(last.promoters, 1, '%'), s: back && back !== last ? `${d(last.promoters, back.promoters)} pts since ${back.q} · FII ${n(last.fii, 1, '%')} (${d(last.fii, back.fii)}) · DII ${n(last.dii, 1, '%')} (${d(last.dii, back.dii)})` : `${last.q}` }); }
  if (f.pledge) { const p = f.pledge.pledgedOfPromoter ?? 0; t.push({ k: 'Promoter pledge', v: p > 0 ? `${(p * 100).toFixed(1)}% pledged` : 'none', s: p > 0 ? `of the promoters' shares${f.pledge.ndu ? ' · more under a non-disposal undertaking' : ''} · filing of ${f.pledge.asOf ?? 'the last quarter'}` : `filing of ${f.pledge.asOf ?? 'the last quarter'}` }); }
  return t;
}

/** Tiles of debt-fund portfolio statistics (scope K5): yield, maturity, duration and credit quality. Facts only. */
/** International-fund facts: size, cost, exit load, benchmark and risk level, from the fund page. */
export function intlTiles(d                                                                                                                               , name         )         {
  if (!d && !name) return [];
  const t         = [];
  if (name) { const r = intlRegion(name, d?.bench); if (r.key !== 'unknown') t.push({ k: 'Where it invests', v: `<span class="fvs">${esc(r.label)}</span>`, s: r.note + ' · from the fund\'s benchmark and name, not a count of what it holds today' }, { k: 'Currency', v: `<span class="fvs">${esc(r.currency)}</span>`, s: 'the rupee moving against it adds to or takes from your return' }, { k: 'Tax on gains', v: 'Your slab rate', s: 'any holding period (units bought from 1 Apr 2023)' }); }
  if (!d) return t;
  if (d.aum !== null) t.push({ k: 'Fund size', v: '₹' + Math.round(d.aum).toLocaleString('en-IN') + ' Cr', s: d.aum < 500 ? 'small: a fund this size can be closed or merged' : '' });
  if (d.ter !== null) t.push({ k: 'Yearly cost', v: d.ter.toFixed(2) + '%', s: 'expense ratio, direct plan' });
  if (d.exit) t.push({ k: 'Exit load', v: d.exit === 'none' ? 'None' : d.exit, s: '' });
  if (d.bench) t.push({ k: 'Benchmark', v: d.bench, s: d.risk ? 'riskometer: ' + d.risk : '' });
  return t;
}

export function debtTiles(d                                                                                                                                                                         )         {
  if (!d) return [];
  const t         = [], yrs = (x               ) => (x === null ? '–' : x < 1 ? (x * 12).toFixed(1) + ' months' : x.toFixed(2) + ' years');
  if (d.ytm !== null) t.push({ k: 'Yield to maturity', v: d.ytm.toFixed(2) + '%', s: 'what the holdings yield if held to maturity; not what you will earn' + (d.asOf ? ' · ' + d.asOf : '') });
  if (d.avgMat !== null) t.push({ k: 'Average maturity', v: yrs(d.avgMat), s: d.modDur !== null ? `modified duration ${d.modDur.toFixed(2)} years: a 1 point rise in rates costs about ${d.modDur.toFixed(1)}%` : '' });
  if (d.credit.length) {
    let safe = 0, lower = 0; for (const x of d.credit) { if (/sov|aaa|a1\+|cash|call|treasury|repo|cblo|reverse/i.test(x.r)) safe += x.fund; else if (/^(aa|a\b|a[1-3]|bbb|bb|b\b|c\b|d\b|unrated)/i.test(x.r)) lower += x.fund; }
    const top = [...d.credit].sort((a, b) => b.fund - a.fund).slice(0, 3).map((x) => `${x.r} ${x.fund.toFixed(0)}%`).join(' · ');
    t.push({ k: 'Credit quality', v: `${safe.toFixed(0)}% safest`, s: `government, AAA, A1+ and cash · ${lower.toFixed(1)}% rated AA or lower · ${top}` });
  }
  return t;
}
