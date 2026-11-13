import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseResultsXbrl } from '../src/ingest/filings-parse.ts';

const maps = JSON.parse(readFileSync(new URL('../settings/filings-tags.json', import.meta.url), 'utf8'));
const fx = (n: string) => readFileSync(new URL(`../fixtures/filings/${n}.xml`, import.meta.url), 'utf8');
const parse = (n: string) => { const r = parseResultsXbrl(fx(n), maps); assert.equal(r.ok, true, n); return r as Extract<typeof r, { ok: true }>; };

// Expected values were read from the real files (31 Mar 2026 quarter) with grep, independent of the parser.
test('Ind AS company, consolidated: quarter and year to date', () => {
  const r = parse('IFIndAs-consolidated');
  assert.equal(r.family, 'IFIndAs'); assert.equal(r.basis, 'consolidated'); assert.equal(r.symbol, 'DCMSHRIRAM');
  assert.equal(r.periodStart, '2026-01-01'); assert.equal(r.periodEnd, '2026-03-31'); assert.equal(r.ytdStart, '2025-04-01');
  assert.equal(r.quarter.revenue, 33730300000); assert.equal(r.ytd.revenue, 142639100000);
  assert.deepEqual(r.missing, []);
});
test('Ind AS company, standalone: basis read from the file, not from the list', () => {
  const r = parse('IFIndAs-standalone'); assert.equal(r.basis, 'standalone'); assert.equal(r.symbol, 'LAL');
});
test('bank: revenue is total income, profit tag differs from Ind AS', () => {
  const r = parse('IFBanking-consolidated');
  assert.equal(r.quarter.revenue, 91324700000); assert.equal(r.quarter.pat, 13932500000); assert.equal(r.quarter.eps, 5.44);
});
test('other-than-Ind-AS family uses its own profit tag', () => { const r = parse('IFOTB-standalone'); assert.equal(r.quarter.pat, 13738000); });
test('insurer: revenue and profit read, EPS absent and reported missing, not zero', () => {
  const r = parse('IFLI-consolidated');
  assert.equal(r.quarter.pat, 4974900000); assert.equal(r.quarter.eps, null); assert.deepEqual(r.missing, ['eps']);
});
test('NBFC family parses with a negative profit before tax kept as negative', () => {
  const r = parse('IFNBFC-standalone'); assert.equal(r.quarter.pbt, -134700000);
});
test('every fixture parses with revenue, profit before tax and profit present', () => {
  for (const f of readdirSync(new URL('../fixtures/filings', import.meta.url)).filter((x) => x.endsWith('.xml'))) {
    const r = parse(f.replace('.xml', '')); for (const k of ['revenue', 'pbt', 'pat'] as const) assert.notEqual(r.quarter[k], null, `${f} ${k}`);
  }
});
test('an unknown format family is an error, never a guess', () => {
  const r = parseResultsXbrl('<?xml version="1.0"?><!--IFZZZ V1--><x><in-capmkt:Symbol contextRef="OneD">A</in-capmkt:Symbol></x>', maps);
  assert.equal(r.ok, false);
});
test('an alias family borrows the map and says so', () => {
  const xml = fx('IFIndAs-consolidated').replace(/<!--\s*IFIndAs/, '<!--IFFIndAs');
  const r = parseResultsXbrl(xml, maps); assert.equal(r.ok, true); if (r.ok) { assert.equal(r.viaAlias, 'IFIndAs'); assert.equal(r.quarter.revenue, 33730300000); }
});
test('a file with no quarter facts is an error', () => { assert.equal(parseResultsXbrl('<!--IFIndAs V2--><x/>', maps).ok, false); });

// Older files (in-bse-fin taxonomy, no header comment): family read from the tags. Expected values read from the real files with grep (fixtures/filings-old).
const old = (pre: string) => readdirSync(new URL('../fixtures/filings-old', import.meta.url)).filter((x) => x.startsWith(pre) && x.endsWith('.xml'));
const parseOld = (f: string) => parseResultsXbrl(readFileSync(new URL(`../fixtures/filings-old/${f}`, import.meta.url), 'utf8'), maps);
test('older files: every real fixture parses with the family inferred, revenue, pbt and pat present', () => {
  const all = old('');
  assert.ok(all.length >= 19);
  for (const f of all) {
    const r = parseOld(f); assert.equal(r.ok, true, f); if (!r.ok) continue;
    assert.equal(r.inferred, true, f);
    for (const k of ['revenue', 'pbt', 'pat'] as const) assert.notEqual(r.quarter[k], null, `${f} ${k}`);
  }
});
test('older files: bank, NBFC, Ind AS and other-than-Ind-AS families inferred', () => {
  const fam = (sym: string) => { for (const f of old('')) { const r = parseOld(f); if (r.ok && r.symbol === sym) return r; } throw new Error(sym); };
  assert.equal(fam('PNB').family, 'IFBanking'); assert.equal(fam('PNB').quarter.revenue, 352864300000); assert.equal(fam('PNB').basis, 'consolidated');
  assert.equal(fam('IIFL').family, 'IFIndAs');
  assert.equal(fam('SADBHAV').quarter.pbt, -66077000);
  assert.equal(fam('VINCOFE').family, 'IFOTB'); assert.equal(fam('VINCOFE').quarter.pat, 124556000);
});
test('older file with nothing to infer a family from is an error', () => {
  const r = parseResultsXbrl('<x><in-bse-fin:Symbol contextRef="OneD">A</in-bse-fin:Symbol></x>', maps); assert.equal(r.ok, false);
});
test('a stated family with no map falls back to the tags; still an error when the tags do not say', () => {
  const body = (extra: string) => `<!--IFFNonBanking V1--><x><in-bse-fin:Symbol contextRef="OneD">A</in-bse-fin:Symbol>${extra}</x>`;
  const ok = parseResultsXbrl(body('<in-bse-fin:RevenueFromOperations contextRef="OneD">5</in-bse-fin:RevenueFromOperations><in-bse-fin:ProfitBeforeTax contextRef="OneD">2</in-bse-fin:ProfitBeforeTax><in-bse-fin:ProfitLossForPeriod contextRef="OneD">1</in-bse-fin:ProfitLossForPeriod>'), maps);
  assert.equal(ok.ok, true); if (ok.ok) { assert.equal(ok.family, 'IFIndAs'); assert.equal(ok.inferred, true); }
  assert.equal(parseResultsXbrl(body(''), maps).ok, false);
});

// Batch A (A0): extra figures read from the same real files. Expected values read with grep, independent of the parser.
test('extras: Ind AS consolidated carries income lines, balance sheet and cash flow', () => {
  const r = parse('IFIndAs-consolidated');
  assert.equal(r.extra.q.financeCost, 396600000); assert.equal(r.extra.q.otherIncome, 465600000); assert.equal(r.extra.q.exceptional, 316100000);
  assert.equal(r.extra.q.pbtPre, 2221400000); assert.equal(r.extra.q.paidUp, 313500000); assert.equal(r.extra.q.faceValue, 2);
  assert.equal(r.extra.bs.assets, 141367500000); assert.equal(r.extra.bs.equity, 77328300000);
  assert.equal(r.extra.bs.borrowings, 12114000000 + 16010900000); assert.equal(r.extra.bs.cash, 3061900000);
  assert.equal(r.extra.cf.cfo, 12338000000); assert.equal(r.extra.cf.capex, 8692900000);
});
test('extras: borrowings fall back to the single tag for banks and are summed otherwise; absent figures stay absent', () => {
  assert.equal(parse('IFBanking-standalone').extra.bs.borrowings, 27527400000);
  assert.equal(parse('IFOTB-standalone').extra.bs.borrowings, 2800214000 + 725722000);
  assert.equal(parse('IFLI-consolidated').extra.q.financeCost, undefined);
  assert.equal(parse('IFNBFC-standalone').extra.q.financeCost, 0);
});
