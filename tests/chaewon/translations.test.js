const test = require('node:test');
const assert = require('node:assert');

// Mirrors the lookup in chaewon.js
const TRANSLATIONS = {
  'publications': 'WHAT I DO WHEN NOT STANNING CHAEWON ♡',
  'research': 'BETWEEN STREAMING CRAZY ON REPEAT ♡',
  'contact': 'DM ME UR CHAEWON FANCAMS ♡',
  'coursework': 'STUDYING WHILE LISTENING TO ANTIFRAGILE ♡',
  'in progress': 'STUDYING WHILE LISTENING TO ANTIFRAGILE ♡',
  'mathematics': 'MATH WHILE STREAMING CRAZY ♡',
  'cs/ece': 'CODING WITH CHAEWON ON LOOP ♡',
};

function lookup(text) {
  if (!text) return null;
  const k = text.trim().toLowerCase();
  return TRANSLATIONS[k] || null;
}

test('lookup matches known heading', () => {
  assert.strictEqual(lookup('Publications'), 'WHAT I DO WHEN NOT STANNING CHAEWON ♡');
});

test('lookup is case-insensitive', () => {
  assert.strictEqual(lookup('PUBLICATIONS'), 'WHAT I DO WHEN NOT STANNING CHAEWON ♡');
});

test('lookup ignores leading/trailing whitespace', () => {
  assert.strictEqual(lookup('  Research  '), 'BETWEEN STREAMING CRAZY ON REPEAT ♡');
});

test('lookup returns null for unknown heading', () => {
  assert.strictEqual(lookup('Unknown Section'), null);
});

test('lookup handles "In Progress" multi-word', () => {
  assert.strictEqual(lookup('In Progress'), 'STUDYING WHILE LISTENING TO ANTIFRAGILE ♡');
});

module.exports = { TRANSLATIONS, lookup };
