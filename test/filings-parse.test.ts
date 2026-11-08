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
