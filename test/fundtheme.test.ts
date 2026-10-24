import test from 'node:test';
import assert from 'node:assert/strict';
import { themeOf } from '../src/pm/fundtheme.ts';
test('C-96: themes read from sectoral fund names', () => {
  assert.equal(themeOf('HDFC Pharma and Healthcare Fund - Direct Plan - Growth Option'), 'pharma and healthcare');
  assert.equal(themeOf('Bajaj Finserv Healthcare Fund - Direct Plan - Growth'), 'pharma and healthcare');
  assert.equal(themeOf('ICICI Prudential Technology Fund - Direct Plan - Growth'), 'technology');
  assert.notEqual(themeOf('HDFC Infrastructure Fund - Direct Plan'), themeOf('HDFC MNC Fund - Direct Plan'));
  assert.equal(themeOf('Some Unlabelled Opportunities Fund - Direct Plan'), null);
});
