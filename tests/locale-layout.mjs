// Browser fixture against the real production renderer, at the caller's viewport.
import { dictionaries, languageTags } from '../src/i18n.js';
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
async function waitFor(condition) {
  const until = performance.now() + 3000;
  while (!condition()) { if (performance.now() > until) throw new Error('Locale fixture timed out'); await tick(); }
}
await waitFor(() => document.querySelector('.service'));
const select = document.querySelector('select.language');
const original = select.value;
const results = [];
for (const locale of Object.keys(dictionaries)) {
  select.value = locale; select.dispatchEvent(new Event('change'));
  await tick();
  const start = document.querySelector('.header .secondary');
  const check = { locale, tag: document.documentElement.lang, label: start.textContent, overflow: document.documentElement.scrollWidth > innerWidth };
  if (check.tag !== languageTags[locale] || check.label !== dictionaries[locale].startCommand) throw new Error(`Locale not rendered: ${locale}`);
  start.click();
  await waitFor(() => document.querySelector('dialog [type=submit]') && !document.querySelector('dialog [type=submit]').disabled);
  const dialog = document.querySelector('dialog');
  check.dialogOverflow = dialog.scrollWidth > dialog.clientWidth;
  check.selectorDisabled = select.disabled;
  dialog.querySelector('.starter-close').click();
  await waitFor(() => !dialog.isConnected);
  check.focusRestored = document.activeElement === start;
  check.saved = localStorage.getItem('run-deck-language') === locale;
  results.push(check);
}
select.value = original; select.dispatchEvent(new Event('change'));
const result = document.createElement('pre'); result.id = 'locale-layout-result';
result.textContent = JSON.stringify({passed: results.every(r => !r.overflow && !r.dialogOverflow && r.selectorDisabled && r.focusRestored && r.saved), results});
document.body.append(result);
