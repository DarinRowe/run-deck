import * as checks from './starter-lifecycle.mjs';
export async function startSoak() {
  const results = [];
  const cases = [['checkStarterClosedDuringRefresh'], ['checkStarterReopen', 'list'], ['checkStarterReopen', 'stat'], ['checkStarterReopen', 'read'], ['checkStarterResumesLive'], ['checkStarterLaunch']];
  const emit = data => window.webkit.messageHandlers.soak.postMessage(data);
  emit({type: 'started', hidden: document.hidden, focused: document.hasFocus()});
  for (const [name, stage] of cases) {
    try { results.push({name, stage, passed: true, result: await checks[name](stage)}); }
    catch (error) { results.push({name, stage, passed: false, error: error.message}); }
  }
  let repeated = 0;
  if (results.every(item => item.passed)) {
    for (let i = 0; i < 20; i++) {
      try { await checks.checkStarterReopen(['list', 'stat', 'read'][i % 3]); repeated++; }
      catch(error) { results.push({name: 'repeat', index:i, passed: false, error: error.message}); break; }
    }
  }
  emit({type: 'finished', results, repeated, errors: window.previewErrors, hidden: document.hidden, focused: document.hasFocus()});
}
