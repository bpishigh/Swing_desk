// C-123: typed overrides for the liquid India price breaks before 2020 that C-122 left. Each entry names its source; factor is cross-checked against the observed step (printed). Only dates before 2020-02-01.
// Usage: node --max-old-space-size=8000 scripts/apply-india-overrides-typed-pre2020.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { loadIndia } from '../src/backtest/india-loader.ts';
const DRY = process.argv.includes('--dry'), OVF = 'data/india/corp-action-overrides-hist.json';
const F = (factor, note) => ({ factor, note }), OBS = (note) => ({ factor: 'observed', note }), IGN = (note) => ({ ignore: true, note });
const T = {
  'KOTAKBANK|2015-07-08': F(0.5, 'bonus 1:1, ex-date 8 Jul 2015 (stockpricearchive.com)'),
  'ONGC|2016-12-15': F(2 / 3, 'bonus 1:2, ex-date 15 Dec 2016 (Business Standard: stock trades ex-bonus)'),
  'AVANTIFEED|2018-06-26': F(1 / 3, 'split Rs 2 to Re 1 (1:2) and bonus 1:2, ex-date 26 Jun 2018 (Business Standard); factor 1/2 x 2/3; the rest of the step is that day\'s 16-19% gain'),
  'KAJARIACER|2016-10-04': F(0.5, 'split 1:2, ex-date 4 Oct 2016 (stockpricearchive.com)'),
  'ICIL|2016-11-11': F(0.2, 'split 1:5, ex-date 11 Nov 2016 (stockpricearchive.com)'),
  'KRBL|2010-02-10': F(0.1, 'split 1:10, ex-date 10 Feb 2010 (stockpricearchive.com)'),
  'AMRUTANJAN|2012-10-25': F(0.2, 'split 1:5, ex-date 25 Oct 2012 (stockpricearchive.com)'),
  'PERSISTENT|2015-03-10': F(0.5, 'bonus 1:1, ex-date 10 Mar 2015 (stockpricearchive.com)'),
  'WABAG|2015-03-26': F(0.5, 'bonus 1:1, ex-date 26 Mar 2015 (stockpricearchive.com)'),
  'COROMANDEL|2010-12-23': F(0.5, 'split 1:2, ex-date 23 Dec 2010 (stockpricearchive.com)'),
  'TATAMTRDVR|2011-09-12': F(0.2, 'sub-division 1:5 on the day the ordinary share (TATAMOTORS, factor 0.2 already resolved) split'),
  'BLKASHYAP|2010-09-29': OBS('split 1:5 confirmed for 29 Sep 2010 (stockpricearchive.com); the step is about 1:10, so a stacked action is likely; observed ratio used'),
  'NATIONALUM|2011-03-15': OBS('split 1:2 confirmed for 15 Mar 2011 (stockpricearchive.com); the step is about 1:4.4, so a stacked action is likely; observed ratio used'),
  'AEGISCHEM|2010-08-18': OBS('bonus confirmed for 18 Aug 2010 (stockpricearchive.com, listed as 2:3); the stated ratio does not fit the step; observed ratio used'),
  'CROMPGREAV|2016-03-15': OBS('demerger of the consumer business, ex-date 15 Mar 2016 (Business Standard, Business Today: stock down about 70%)'),
  'KPIT|2019-01-24': OBS('demerger of KPIT Engineering, 1:1, ex-date 24 Jan 2019 (Business Standard: close Rs 218, open Rs 136)'),
  'CENTURYTEX|2019-10-11': OBS('demerger of the cement business to UltraTech, ex-date 11 Oct 2019 (Business Standard)'),
  'STAR|2013-12-19': OBS('special dividend after the Agila Specialties sale, ex-date 19 Dec 2013 (Business Standard: Strides Arcolab slumps ex-dividend); history adjusted as a cash distribution'),
  'IDEA|2019-03-29': F(+((38 * 29 + 87 * 12.5) / (125 * 29)).toFixed(4), 'rights issue 87 for 38 at Rs 12.50, ex-date 29 Mar 2019 (Business Standard); theoretical ex-rights factor from the prior close of Rs 29'),
  'DHFL|2018-09-21': IGN('genuine one-day fall, DHFL on 21 Sep 2018 (IL&FS contagion), widely reported; no corporate action'),
  'INFIBEAM|2018-09-28': IGN('genuine one-day fall of 71% on 28 Sep 2018 after a WhatsApp rumour (Bloomberg, Business Standard); no corporate action'),
  'JETAIRWAYS|2019-06-18': IGN('genuine one-day fall of about 41% on 18 Jun 2019 as the airline went to the NCLT (The Week, Business Today); no corporate action'),
  'FINANTECH|2013-08-01': IGN('genuine one-day fall on 1 Aug 2013 after the NSEL payment default, widely reported; no corporate action'),
};
const D = loadIndia('data/india', { pre2020: true, allSymbols: true, to: '2020-01-31' }), ix = new Map(D.days.map((d, i) => [d.date, i]));
const cl = (s, d) => D.days[ix.get(d)].rows.find((x) => x[0] === s)?.[1];
const existing = JSON.parse(readFileSync(OVF, 'utf8')), out = {}, rep = [];
for (const [key, e] of Object.entries(T)) {
  const [s, d] = key.split('|'); if (d >= '2020-02-01' || existing[key]) { rep.push(`${key} skipped`); continue; }
  const i = ix.get(d), obs = cl(s, d) / cl(s, D.days[i - 1].date); let o;
  if (e.ignore) o = { ignore: true, note: `${e.note}; typed 31 Oct 2026 (C-123)` };
  else { const f = e.factor === 'observed' ? +obs.toFixed(4) : e.factor; o = { factor: f, note: `${e.note}; observed step ${obs.toFixed(4)}; typed 31 Oct 2026 (C-123)` }; }
  out[key] = o; rep.push(`${key} ${e.ignore ? 'ignore' : 'factor ' + o.factor} (observed ${obs.toFixed(4)})`);
}
if (!DRY) writeFileSync(OVF, JSON.stringify({ ...existing, ...out }, null, 1) + '\n');
console.log(rep.join('\n')); console.log('entries', Object.keys(out).length);
