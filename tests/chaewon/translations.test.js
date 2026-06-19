const test = require('node:test');
const assert = require('node:assert');

// Mirrors HEADING_TRANSLATIONS in chaewon.js — keep in sync when editing copy.
const TRANSLATIONS = {
  'research': "googling her schedule. that's the research",
  'publications': "her discography clears my papers ngl",
  'contact': "dm me kkura fancams ONLY",
  'highlighted mathematics coursework': "math? no. thinking about kkura? yes",
  'highlighted computer science & ece coursework': "should be coding, editing her fancams instead",
  'featured post': "wrote this delulu, be nice 😭",
};

function lookup(text) {
  if (!text) return null;
  const k = text.trim().toLowerCase();
  return TRANSLATIONS[k] || null;
}

test('lookup matches known heading', () => {
  assert.strictEqual(lookup('Publications'), "her discography clears my papers ngl");
});

test('lookup is case-insensitive', () => {
  assert.strictEqual(lookup('PUBLICATIONS'), "her discography clears my papers ngl");
});

test('lookup ignores leading/trailing whitespace', () => {
  assert.strictEqual(lookup('  Research  '), "googling her schedule. that's the research");
});

test('lookup returns null for unknown heading', () => {
  assert.strictEqual(lookup('Unknown Section'), null);
});

test('lookup matches a real multi-word academic heading', () => {
  assert.strictEqual(
    lookup('Highlighted Mathematics Coursework'),
    "math? no. thinking about kkura? yes"
  );
});

test('lookup matches a heading containing an ampersand', () => {
  assert.strictEqual(
    lookup('Highlighted Computer Science & ECE Coursework'),
    "should be coding, editing her fancams instead"
  );
});

module.exports = { TRANSLATIONS, lookup };
