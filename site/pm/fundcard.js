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
  ] : [];
  const tiles = (c.tiles ?? []).concat(facts.filter((t) => t.v !== '–'));
  const mg = fq && fq.managers.length ? `<div class="fmg">${fq.managers.map((m) => `<span class="fchip${fq.flags.some((x) => x.kind === 'new-manager' && x.text.startsWith(m.name)) ? ' warn' : ''}">${esc(m.name)}${m.since ? `<small>since ${esc(m.since.slice(0, 7))}</small>` : ''}</span>`).join('')}</div>` : '';
  const vs = fq?.vs5 ? (() => { const v = fq.vs5 , mx = Math.max(v.fund, v.benchR5, 1), d = v.fund - v.benchR5; return `<div class="fbox"><div class="fh">5-year return a year</div><div class="fbar"><span>This fund</span><i style="width:${Math.max(2, 100 * v.fund / mx)}%" class="${d >= 0 ? 'g' : 'r'}"></i><b>${v.fund}%</b></div><div class="fbar"><span>${esc(v.bench)} index funds</span><i style="width:${Math.max(2, 100 * v.benchR5 / mx)}%"></i><b>${v.benchR5}%</b></div><div class="fs">${d >= 0 ? 'Ahead' : 'Behind'} by ${Math.abs(d).toFixed(1)} points a year (median of ${v.n} funds). A fact, not a prediction; closed funds are missing.</div></div>`; })() : '';
  const tr = hh ? `<div class="fbox"><div class="fh">What its stocks are doing</div><div class="fbar"><span>Above 200-day average</span><i style="width:${Math.round(100 * hh.aboveShare)}%"></i><b>${Math.round(100 * hh.aboveShare)}%</b></div><div class="fs">Its stocks returned ${sg(100 * hh.ret6m)} over 6 months${hh.pct === null ? '' : ' · ' + Math.round(hh.pct) + 'th percentile among ' + esc(hh.cat) + ' funds'}. Information only: a back-test (C-104) did not show it predicts returns, so it drives nothing.</div></div>` : '';
  const fl = fq?.flags.length ? `<div class="fflag">${fq.flags.map((x) => esc(x.text)).join(' · ')}</div>` : '';
  const why = (c.why ?? []).filter(Boolean);
  return `<div class="fcard">${why.length ? `<div class="fwhy">${why.map((r) => `<p>${esc(r)}</p>`).join('')}</div>` : ''}${tiles.length ? `<div class="fgrid">${tiles.map(tile).join('')}</div>` : ''}${mg}${fl}${vs || tr ? `<div class="frow">${vs}${tr}</div>` : ''}${fq ? '<div class="fs fnote">Facts only (C-108). They carry no weight in the score and change no verdict.</div>' : ''}${c.note ? `<div class="fs fnote">${esc(c.note)}</div>` : ''}</div>`;
}
/** Stock detail in the same card style: tiles of label, value and one grey line. */
export function stockCard(c                                                        )         {
  const tile = (t      ) => `<div class="ft"><div class="fk">${esc(t.k)}</div><div class="fv sm">${t.v}</div>${t.s ? `<div class="fs">${esc(t.s)}</div>` : ''}</div>`;
  return `<div class="fcard"><div class="fgrid">${c.tiles.map(tile).join('')}</div>${(c.blocks ?? []).join('')}${(c.notes ?? []).map((n) => `<div class="fs fnote">${esc(n)}</div>`).join('')}</div>`;
}
export const CARD_CSS = `.fcard{padding:6px 4px 10px;max-width:980px}.fwhy p{margin:0 0 4px;font-size:13px;color:var(--ink)}.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0}.ft{background:var(--accent-soft,var(--accent-bg));border-radius:10px;padding:9px 12px}.fk{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}.fv{font-size:20px;font-weight:650;margin-top:2px}.fv.sm{font-size:16px}.fvs{font-size:13px;font-weight:600;line-height:1.3;display:block}.fs{font-size:12px;color:var(--muted);margin-top:3px;white-space:normal}.fmg{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.fchip{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:12.5px}.fchip small{color:var(--muted);margin-left:6px}.fchip.warn{background:var(--yellow-bg);border-color:var(--yellow);color:var(--yellow)}.frow{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}.fbox{border:1px solid var(--line);border-radius:10px;padding:10px 14px;background:var(--panel)}.fh{font-size:12px;font-weight:600;margin-bottom:8px}.fbar{display:grid;grid-template-columns:140px 1fr 52px;align-items:center;gap:8px;margin:5px 0;font-size:12.5px}.fbar span{color:var(--muted);white-space:normal}.fbar i{display:block;height:10px;border-radius:5px;background:var(--accent)}.fbar i.g{background:var(--green)}.fbar i.r{background:var(--red)}.fbar b{text-align:right}.fflag{margin:6px 0 10px;padding:6px 12px;border-radius:8px;background:var(--yellow-bg);color:var(--yellow);font-size:12.5px}.fnote{margin-top:10px}`;
if (typeof document !== 'undefined' && !document.getElementById('fcard-css')) { const s = document.createElement('style'); s.id = 'fcard-css'; s.textContent = CARD_CSS; document.head.appendChild(s); }
