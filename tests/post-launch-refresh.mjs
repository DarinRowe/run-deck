// Exercise the real Start dialog and renderer with the synthetic host.
// Open preview.html?postLaunchCheck=ready|delayed|denied|switched|no-listener.
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (condition, timeout = 5000) => {
  const end = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > end) throw new Error('Timed out waiting for post-launch service row/completion');
    await sleep(10);
  }
};
const mode = new URLSearchParams(location.search).get('postLaunchCheck');
const api = window.previewApi;
let scans = 0, launched = false;
let result;
try {
  api.focusChanged(true);
  await waitFor(() => !document.querySelector('.refresh').disabled);
  const live = document.querySelector('.live-button');
  if (live.getAttribute('aria-pressed') === 'true') live.click();
  await waitFor(() => live.getAttribute('aria-pressed') === 'false');
  const open = api.tabs.open, exec = api.exec;
  api.tabs.open = async request => {
    const reply = await open(request);
    launched = true;
    // Consent/new terminal takes focus while the docked panel stays visible.
    api.focusChanged(false);
    return reply;
  };
  api.exec = async request => {
    if (!launched) return exec(request);
    scans++;
    if (mode === 'denied') throw new Error('User denied consent for inspection.');
    if (mode === 'switched') api.switchContext();
    const processes = api.processes;
    if (mode === 'no-listener' || (mode === 'delayed' && scans === 1)) api.processes = processes.filter(p => p.pid < 9000);
    try { return await exec(request); } finally { api.processes = processes; }
  };
  document.querySelector('.header .secondary').click();
  await waitFor(() => document.querySelector('dialog [type=submit]')?.disabled === false);
  const dialog = document.querySelector('dialog');
  dialog.querySelector('.custom-command').open = true;
  dialog.querySelector('textarea').value = 'node test-service.mjs';
  dialog.querySelector('input').value = 'Post-launch check';
  const start = performance.now();
  dialog.querySelector('[type=submit]').click();
  const row = () => [...document.querySelectorAll('.service h3')].some(n => n.textContent === 'Post-launch check');
  if (mode === 'ready' || mode === '1' || mode === 'delayed') {
    await waitFor(row, 2500);
    assert(scans === (mode === 'delayed' ? 2 : 1), 'Unexpected post-launch scan count: ' + scans);
  } else {
    await waitFor(() => scans >= (mode === 'no-listener' ? 4 : 1));
    await waitFor(() => !document.querySelector('.live-button').disabled);
    await sleep(600);
    assert(!row(), 'Unobserved or stale launch appeared as a service');
    assert(scans === (mode === 'no-listener' ? 4 : 1), 'Follow-up did not stop: ' + scans);
  }
  await waitFor(() => !document.querySelector('.live-button').disabled);
  assert(live.getAttribute('aria-pressed') === 'false', 'Launch re-enabled paused live polling');
  assert(api.calls.filter(c => c[0] === 'open').length === 1, 'Launch was repeated');
  assert(previewErrors.length === 0, previewErrors.join('\n'));
  result = { passed: true, mode, scans, elapsedMs: Math.round(performance.now() - start) };
} catch (error) {
  result = { passed: false, mode, scans, error: error.message };
}
const report = document.createElement('output'); report.id = 'post-launch-result';
report.textContent = JSON.stringify(result); document.body.append(report);
