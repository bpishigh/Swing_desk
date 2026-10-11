import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCircularText, wantedSubject, effectiveDate } from '../src/ingest/circulars.ts';

const U = new Set(['QNIFTY', 'GROWWGOLD', 'GROWWSLVR', 'BANKNIFTY1', 'CONS', 'SILVER1', 'NV20', 'MIDCAP', 'LICMFGOLD', 'MIDQ50ADD', 'HEALTHADD', 'IVZINNIFTY', 'GOLDADD', 'SILVERADD', 'ETF', 'DSP', 'LIC']);

// Text as NSE circulars read out of the PDF (line breaks as extracted).
const KOTAK = `National Stock Exchange of India
Circular
Department: Listing
Download Ref No: NSE/CML/72916 Date: February 20, 2026
Sub: Face Value Split – ETFs of Kotak Mahindra Asset Management Company Limited
It is hereby informed that the face value and paid-up value of the following ETFs shall be changed w.e.f.
February 27, 2026.
Sr.
No.
Name of the ETF Symbol
Existing Face
Value & Paid-up
Value (Rs.)
New Face
Value &
Paid-up
Value (Re.)
1 Kotak Nifty Bank ETF BANKNIFTY1 10 1
2 Kotak Nifty India Consumption ETF CONS 10 1
3
Kotak Mahindra Mutual Fund - Kotak
Silver ETF
SILVER1 10 1
4 Kotak Nifty 50 value 20 ETF NV20 10 1
5 Kotak Nifty Midcap 50 ETF MIDCAP 10 1
This circular shall be effective from February 27, 2026.
For and on behalf of`;

const GROWW = `Sub: Change in ISIN – ETFs of Groww Mutual Fund
Members of the Exchange are hereby informed that the ISIN Code for the units of the following company shall
be changed w.e.f. February 06, 2026.
Sr.
No.
Symbol Company Name New ISIN Remarks
1
GROWWGOLD
Groww Mutual Fund -
Groww Gold ETF
INF666M01OE7 Sub-Division from Rs. 10/- to Re. 1/-
2
GROWWSLVR
Groww Mutual Fund -
Groww Silver ETF
INF666M01OF4 Sub-Division from Rs. 10/- to Re. 1/-
The new ISINs shall be effective for all trades done on and from the Ex-date i.e., February 06, 2026.`;

const LIC = `Sub: Face Value Split – ETF of LIC Mutual Fund Asset Management Limited
shall be changed w.e.f.
March 06, 2026.
Sr.
No.
Name of the ETF Symbol
Existing Face
Value & Paid-up
Value (Rs.)
New Face
Value & Paid-
up Value (Re.)
1
LIC MF Gold EXCHANGE TRADED
FUND
LICMFGOLD 100 1
This circular shall be effective from March 06, 2026.`;

const DSP = `Sub: Face Value Split – ETFs of DSP Asset Managers Private Limited
shall be changed w.e.f.
July 03, 2026.
Sr.
No.
Name of the ETF Symbol
Existing Face Value &
Paid-up Value (Rs.)
New Face Value &
Paid-up Value (Re.)
1
DSP Nifty Midcap 150
Quality 50 ETF
MIDQ50ADD 10 1
2
DSP Nifty Healthcare
ETF
HEALTHADD 10 1
This circular shall be effective from July 03, 2026.`;

const INVESCO = `Sub: Face Value Split – ETF of Invesco Asset Management (India) Private Limited
shall be changed w.e.f.
July 31, 2026.
Sr.
No.
Symbol Name of the ETF
Existing Face Value &
Paid-up Value (Rs.)
New Face Value &
Paid-up Value (Re.)
1 IVZINNIFTY
Invesco India Nifty 50
Exchange Traded Fund
10 1
This circular shall be effective from July 31, 2026.`;

test('Kotak: five ETFs, Rs 10 to Re 1, effective 27 Feb', () => {
  const p = parseCircularText(KOTAK, 'NSE/CML/72916', U)!;
  assert.equal(p.effective, '2026-02-27');
  assert.deepEqual(p.items.map((i) => i.symbol), ['BANKNIFTY1', 'CONS', 'SILVER1', 'NV20', 'MIDCAP']);
  assert.ok(p.items.every((i) => i.from === 10 && i.to === 1));
});
test('Groww: an ISIN change that is a sub-division reads both symbols', () => {
  const p = parseCircularText(GROWW, 'NSE/CML/72617', U)!;
  assert.equal(p.effective, '2026-02-06');
  assert.deepEqual(p.items, [{ symbol: 'GROWWGOLD', from: 10, to: 1 }, { symbol: 'GROWWSLVR', from: 10, to: 1 }]);
});
test('LIC and Invesco: Rs 100 to Re 1; symbol before the name', () => {
  assert.deepEqual(parseCircularText(LIC, 'x', U)!.items, [{ symbol: 'LICMFGOLD', from: 100, to: 1 }]);
  const inv = parseCircularText(INVESCO, 'y', U)!;
  assert.deepEqual(inv.items, [{ symbol: 'IVZINNIFTY', from: 10, to: 1 }]);
  assert.equal(inv.effective, '2026-07-31');
});
test('DSP: stray capitalised words that are also symbols do not win when the break symbol is known', () => {
  const p = parseCircularText(DSP, 'z', U, new Set(['MIDQ50ADD', 'HEALTHADD']))!;
  assert.deepEqual(p.items.map((i) => i.symbol), ['MIDQ50ADD', 'HEALTHADD']);
});
test('an ISIN change that is not a sub-division, and unrelated text, are ignored', () => {
  assert.equal(parseCircularText('Sub: Change in ISIN – X Ltd. w.e.f. May 01, 2026. Remarks: Merger', 'a', U), null);
  assert.equal(parseCircularText('Sub: Listing of units', 'b', U), null);
});
test('subjects and dates', () => {
  assert.ok(wantedSubject('Face Value Split - ETFs of Quantum Asset Management Company Private Limited'));
  assert.ok(wantedSubject('Change in ISIN - ETFs of Groww Mutual Fund'));
  assert.ok(!wantedSubject('Listing of units issued by DSP'));
  assert.equal(effectiveDate('changed w.e.f.\nFebruary 13, 2026.'), '2026-02-13');
});

test('Rs 5 to Rs 2 (not a whole-number ratio) reads as factor 0.4, equity format', () => {
  const POCL = `Sub: Face Value Split – Pondy Oxides & Chemicals Limited (POCL)
shall be changed w.e.f. July 21, 2026.
Sr.
No.
Name of the Company Symbol
Existing Face Value &
Paid-up Value (Rs.)
New Face Value &
Paid-up Value (Rs.)
1
Pondy Oxides & Chemicals
Limited
POCL 5 2
This circular shall be effective from July 21, 2026.`;
  const p = parseCircularText(POCL, 'NSE/CML/75192', new Set(['POCL']))!;
  assert.deepEqual(p.items, [{ symbol: 'POCL', from: 5, to: 2 }]);
  assert.equal(p.effective, '2026-07-21');
});
