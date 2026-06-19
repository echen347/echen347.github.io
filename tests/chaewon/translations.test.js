const test = require('node:test');
const assert = require('node:assert');

// Mirrors HEADING_TRANSLATIONS in chaewon.js — keep in sync when editing copy.
const TRANSLATIONS = {
  'research': 'PROVING THEOREMS BETWEEN UNFORGIVEN STREAMS ♡',
  'publications': 'WHAT I DO BETWEEN EASY CRAZY HOT REPLAYS ♡',
  'contact': 'DM ME UR CHAEWON FANCAMS ♡',
  'highlighted mathematics coursework': 'MATH I GRIND BETWEEN CRAZY STREAMS ♡',
  'highlighted computer science & ece coursework': 'CS I STUDY TO EDIT BETTER FANCAMS ♡',
  'featured post': 'WROTE THIS BETWEEN PERFECT NIGHT REPLAYS ♡',
};

function lookup(text) {
  if (!text) return null;
  const k = text.trim().toLowerCase();
  return TRANSLATIONS[k] || null;
}

test('lookup matches known heading', () => {
  assert.strictEqual(lookup('Publications'), 'WHAT I DO BETWEEN EASY CRAZY HOT REPLAYS ♡');
});

test('lookup is case-insensitive', () => {
  assert.strictEqual(lookup('PUBLICATIONS'), 'WHAT I DO BETWEEN EASY CRAZY HOT REPLAYS ♡');
});

test('lookup ignores leading/trailing whitespace', () => {
  assert.strictEqual(lookup('  Research  '), 'PROVING THEOREMS BETWEEN UNFORGIVEN STREAMS ♡');
});

test('lookup returns null for unknown heading', () => {
  assert.strictEqual(lookup('Unknown Section'), null);
});

test('lookup matches a real multi-word academic heading', () => {
  assert.strictEqual(
    lookup('Highlighted Mathematics Coursework'),
    'MATH I GRIND BETWEEN CRAZY STREAMS ♡'
  );
});

test('lookup matches a heading containing an ampersand', () => {
  assert.strictEqual(
    lookup('Highlighted Computer Science & ECE Coursework'),
    'CS I STUDY TO EDIT BETTER FANCAMS ♡'
  );
});

module.exports = { TRANSLATIONS, lookup };
