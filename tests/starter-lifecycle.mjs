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
  dialog.querySelector('.starter-close').click();
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
      return dialog && (dialog.querySelector('.project-commands .command-row') || !dialog.querySelector('.error').hidden);
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
    const custom = dialog.querySelector('.custom-command'); if (custom) custom.open = true;
    const command = dialog.querySelector('textarea'); command.value = 'echo run-deck-lifecycle-fixture';
    command.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit(); await waitFor(() => release || !dialog.querySelector('.error').hidden);
    assert(release, dialog.querySelector('.error').textContent);
    form.requestSubmit();
    const escape = new Event('cancel', { cancelable: true }); dialog.dispatchEvent(escape);
    dialog.querySelector('.starter-close').click(); await tick();
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

export async function checkStarterCustomDuringDiscovery() {
  await ready();
  const api = previewApi, list = api.files.list;
  let release;
  api.files.list = (...args) => new Promise(resolve => { release = () => { release = null; resolve(list(...args)); }; });
  try {
    document.querySelector('.header .secondary').click(); await waitFor(() => release);
    const dialog = document.querySelector('dialog');
    const fields = dialog.querySelector('fieldset');
    assert(!fields.disabled, 'Custom commands must be available while scripts load');
    const custom = dialog.querySelector('.custom-command'); custom.open = true;
    const command = custom.querySelector('textarea'); command.value = 'npm run custom'; command.focus();
    release(); await waitFor(() => dialog.querySelector('.project-commands button'));
    assert(command.value === 'npm run custom' && document.activeElement === command, 'Discovery overwrote custom input or stole focus');
    await close(dialog);
    return { customAvailableDuringDiscovery: true, draftAndFocusPreserved: true };
  } finally { release?.(); api.files.list = list; const dialog = document.querySelector('dialog'); if (dialog) await close(dialog); }
}

export async function checkStarterFailureAndRetry() {
  await ready();
  const api = previewApi, list = api.files.list;
  api.files.list = async () => { throw new Error('Fixture: read permission denied'); };
  try {
    document.querySelector('.header .secondary').click();
    await waitFor(() => document.querySelector('.discovery-status')?.textContent.includes('Fixture:'));
    const dialog = document.querySelector('dialog');
    assert(dialog.querySelector('.custom-command').open && !dialog.querySelector('fieldset').disabled, 'Read failure blocked custom commands');
    const retry = dialog.querySelector('.discovery-status + button');
    assert(!retry.hidden, 'Read failures need a retry action');
    api.files.list = list; retry.click();
    await waitFor(() => dialog.querySelector('.project-commands button'));
    assert(retry.hidden, 'Successful retry should clear the recovery action');
    await close(dialog);
    api.files.list = async () => [];
    document.querySelector('.header .secondary').click();
    await waitFor(() => document.querySelector('.custom-command')?.open);
    assert(!document.querySelector('.discovery-status').hidden, 'Empty discovery should explain the root package.json scope');
    assert(!document.querySelector('fieldset').disabled, 'No package.json must allow a custom command');
    await close(document.querySelector('dialog'));
    return { failureExplained: true, retrySucceeded: true, emptyAllowsCustom: true };
  } finally { api.files.list = list; const dialog = document.querySelector('dialog'); if (dialog) await close(dialog); }
}

export async function checkStarterUnknownLaunch() {
  await ready();
  const api = previewApi, open = api.tabs.open;
  let launches = 0;
  api.tabs.open = async () => { launches++; throw new Error('Fixture: terminal response lost'); };
  try {
    document.querySelector('.header .secondary').click();
    await waitFor(() => document.querySelector('.project-commands button'));
    const dialog = document.querySelector('dialog');
    dialog.querySelector('.custom-command').open = true;
    const command = dialog.querySelector('textarea'); command.value = 'echo uncertain-launch';
    dialog.querySelector('form').requestSubmit();
    await waitFor(() => !dialog.querySelector('.error').hidden && !dialog.querySelector('fieldset').disabled);
    dialog.querySelector('form').requestSubmit();
    await waitFor(() => !dialog.querySelector('fieldset').disabled); await tick();
    const records = [...api.stored.values()].filter(entry => entry.command === command.value);
    assert(launches === 1 && records.length === 1 && records[0].run.state === 'unknown', 'Retry duplicated an uncertain launch');
    const row = [...dialog.querySelectorAll('.command-row')].find(row => row.textContent.includes(command.value));
    assert(row.querySelector('button').disabled && row.querySelector('.command-review'), 'Uncertain command lacks recovery guidance');
    await close(dialog);
    return { launches, records: records.length, uncertainLaunchBlocked: true };
  } finally { api.tabs.open = open; const dialog = document.querySelector('dialog'); if (dialog) await close(dialog); }
}

export async function checkStarterWorkspaceChange() {
  await ready();
  document.querySelector('.header .secondary').click();
  await waitFor(() => document.querySelector('.project-commands button'));
  const dialog = document.querySelector('dialog');
  const before = previewApi.calls.filter(call => call[0] === 'open').length;
  previewApi.switchContext();
  await waitFor(() => !dialog.querySelector('.error').hidden);
  assert(dialog.querySelector('fieldset').disabled, 'Workspace change left custom commands enabled');
  assert([...dialog.querySelectorAll('.command-actions button')].every(button => button.disabled), 'Workspace change left row actions enabled');
  dialog.querySelector('.project-commands button').click(); await tick();
  assert(previewApi.calls.filter(call => call[0] === 'open').length === before, 'Old worktree command launched after switching');
  await close(dialog);
  return { staleActionsDisabled: true, staleLaunches: 0 };
}
