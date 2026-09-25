// Run in the isolated preview. Delay the host, close/reopen the real dialog,
// and count actual reads rather than relying on machine-specific timings.
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function waitFor(condition, timeout = 2500) {
  const until = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > until) throw new Error('Starter fixture did not settle');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
async function ready() {
  await waitFor(() => window.previewApi?.focusChanged && document.querySelector('.refresh'));
  previewApi.focusChanged(true);
  await waitFor(() => !document.querySelector('.refresh').disabled && !document.querySelector('.header .secondary').disabled);
  const live = document.querySelector('.live-button');
  if (live.getAttribute('aria-pressed') === 'true') live.click();
  await waitFor(() => live.getAttribute('aria-pressed') === 'false');
}
async function close(dialog) {
  dialog.querySelector('.form-actions button').click();
  await waitFor(() => !dialog.isConnected);
}

export async function checkStarterReopen(stage = 'list') {
  await ready();
  const api = previewApi, original = { ...api.files };
  const calls = { list: 0, stat: 0, read: 0 };
  let release;
  for (const method of Object.keys(calls)) api.files[method] = (...args) => {
    calls[method]++;
    if (method === stage && calls[method] === 1) return new Promise(resolve => {
      release = () => { release = null; resolve(original[method](...args)); };
    });
    return original[method](...args);
  };
  try {
    const start = document.querySelector('.header .secondary');
    start.click(); await waitFor(() => release);
    await close(document.querySelector('dialog'));
    start.click();
    await waitFor(() => {
      const dialog = document.querySelector('dialog');
      return dialog && (!dialog.querySelector('[type=submit]').disabled || !dialog.querySelector('.error').hidden);
    });
    const current = document.querySelector('dialog');
    const result = { stage, readyBeforeOldResponse: !current.querySelector('[type=submit]').disabled,
      error: current.querySelector('.error').textContent, callsBeforeOldResponse: { ...calls } };
    release(); await tick();
    result.callsAfterOldResponse = { ...calls };
    assert(result.readyBeforeOldResponse && !result.error, JSON.stringify(result));
    assert(JSON.stringify(calls) === JSON.stringify(result.callsBeforeOldResponse), 'Closed discovery continued reading: ' + JSON.stringify(result));
    assert(previewErrors.length === 0, previewErrors.join('\n'));
    return result;
  } finally {
    release?.(); Object.assign(api.files, original);
    const dialog = document.querySelector('dialog'); if (dialog) await close(dialog);
  }
}

export async function checkStarterClosedDuringRefresh() {
  await ready();
  const api = previewApi, keys = api.storage.keys, list = api.files.list;
  let release, reads = 0, mutations = 0;
  api.storage.keys = () => new Promise(resolve => { release = () => { release = null; resolve(keys()); }; });
  api.files.list = (...args) => { reads++; return list(...args); };
  const observer = new MutationObserver(records => { mutations += records.length; });
  try {
    document.querySelector('.header .secondary').click(); await waitFor(() => release);
    const dialog = document.querySelector('dialog'); await close(dialog);
    observer.observe(dialog, { subtree: true, childList: true, attributes: true, characterData: true });
    release(); await tick();
    const result = { fileListsAfterClose: reads, detachedDialogMutations: mutations };
    assert(reads === 0 && mutations === 0, JSON.stringify(result));
    return result;
  } finally { observer.disconnect(); release?.(); api.storage.keys = keys; api.files.list = list; }
}

export async function checkStarterResumesLive() {
  await ready();
  const api = previewApi, list = api.files.list, exec = api.exec;
  let release, scans = 0;
  api.files.list = (...args) => new Promise(resolve => { release = () => { release = null; resolve(list(...args)); }; });
  api.exec = (...args) => { scans++; return exec(...args); };
  try {
    document.querySelector('.live-button').click();
    await waitFor(() => document.querySelector('.live-button').getAttribute('aria-pressed') === 'true');
    document.querySelector('.header .secondary').click(); await waitFor(() => release);
    await close(document.querySelector('dialog')); scans = 0;
    try { await waitFor(() => scans > 0, 6500); }
    catch {
      throw new Error(JSON.stringify({ scansBeforeOldResponse: scans,
        liveEnabled: document.querySelector('.live-button').getAttribute('aria-pressed'),
        documentHidden: document.hidden, scanError: document.querySelector('.scan-error').hidden ? '' : document.querySelector('.scan-error').textContent }));
    }
    return { scansBeforeOldResponse: scans };
  } finally {
    release?.(); api.files.list = list; api.exec = exec;
    const live = document.querySelector('.live-button');
    if (live.getAttribute('aria-pressed') === 'true') live.click();
    await waitFor(() => live.getAttribute('aria-pressed') === 'false');
  }
}

export async function checkStarterLaunch() {
  await ready();
  const api = previewApi, open = api.tabs.open;
  let release, launches = 0;
  api.tabs.open = (...args) => {
    launches++;
    return new Promise(resolve => { release = () => { release = null; resolve(open(...args)); }; });
  };
  try {
    document.querySelector('.header .secondary').click();
    await waitFor(() => document.querySelector('dialog [type=submit]')?.disabled === false);
    const dialog = document.querySelector('dialog'), form = dialog.querySelector('form');
    form.requestSubmit(); await waitFor(() => release || !dialog.querySelector('.error').hidden);
    assert(release, dialog.querySelector('.error').textContent);
    form.requestSubmit();
    const escape = new Event('cancel', { cancelable: true }); dialog.dispatchEvent(escape);
    dialog.querySelector('.form-actions button').click(); await tick();
    assert(escape.defaultPrevented && dialog.open, 'Pending launch must prevent dismissal');
    assert(launches === 1, 'Duplicate submission launched twice');
    release(); await waitFor(() => !dialog.isConnected);
    assert(previewErrors.length === 0, previewErrors.join('\n'));
    return { launches, dismissalBlockedWhileLaunching: true };
  } catch (error) {
    throw new Error(error.message + ' ' + JSON.stringify({ launches,
      dialog: !!document.querySelector('dialog'), command: document.querySelector('dialog textarea')?.value,
      error: document.querySelector('dialog .error')?.textContent }));
  } finally { release?.(); api.tabs.open = open; }
}
