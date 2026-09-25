import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionaries, languages, languageTags } from '../src/i18n.js';
const slots = value => [...value.matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort();
for (const [locale, dictionary] of Object.entries(dictionaries)) {
  test(`${locale}: complete translation keys and interpolation slots`, () => {
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(dictionaries.en).sort());
    assert(languages[locale]);
    assert.doesNotThrow(() => new Intl.Locale(languageTags[locale]));
    for (const [key, value] of Object.entries(dictionary)) {
      assert.equal(typeof value, 'string', key);
      assert(value.trim().length, key);
      assert.deepEqual(slots(value), slots(dictionaries.en[key]), key);
    }
  });
}
