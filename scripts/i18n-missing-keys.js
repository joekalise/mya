#!/usr/bin/env node
// Diffs src/i18n/locales/en-GB.json (the source of truth) against the other
// locale files and reports which keys still need translating.
//
// Usage: node scripts/i18n-missing-keys.js [locale ...]
//   node scripts/i18n-missing-keys.js       # checks all locales
//   node scripts/i18n-missing-keys.js es    # checks just this one

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const SOURCE_LOCALE = 'en-GB';

function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, fullKey));
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

function loadLocale(locale) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  return flatten(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

const requested = process.argv.slice(2);
const allLocales = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((l) => l !== SOURCE_LOCALE);

const targets = requested.length > 0 ? requested : allLocales;
const source = loadLocale(SOURCE_LOCALE);

let anyMissing = false;

for (const locale of targets) {
  const target = loadLocale(locale);
  const missing = Object.keys(source).filter((k) => !(k in target));

  console.log(`\n=== ${locale} ===`);
  if (missing.length === 0) {
    console.log('Up to date.');
    continue;
  }
  anyMissing = true;
  console.log(`${missing.length} missing key(s):\n`);
  for (const key of missing) {
    console.log(`  ${key}: ${JSON.stringify(source[key])}`);
  }
}

process.exit(anyMissing ? 1 : 0);
