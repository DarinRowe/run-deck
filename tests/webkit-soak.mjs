import { processFixture } from './fake-services.mjs';

// Deliberately no forced GC and no retained snapshots or DOM-node arrays.
// The fake host's call log is cleared each cycle to avoid measuring the harness.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function until(test, label) {
  const deadline = performance.now() + 10000;
  while (!test()) {
    assert(performance.now() < deadline, `Timed out: ${label}`);
    await delay(20);
  }
}
const settle = () => new Promise((resolve, reject) => {
  let second;
  const timeout = setTimeout(() => {
    cancelAnimationFrame(first); cancelAnimationFrame(second);
    reject(new Error('WebKit stopped drawing. Keep the Mac unlocked and the test window visible.'));
  }, 10000);
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(() => { clearTimeout(timeout); resolve(); });
  });
});
const send = value => window.webkit.messageHandlers.soak.postMessage(value);

export function startSoak(seconds = 2100) {
  run(seconds).catch(error => send({ type: 'error', message: String(error), stack: error.stack }));
}

async function run(seconds) {
  await until(() => window.previewApi && document.querySelector('.refresh') && !document.querySelector('.refresh').disabled, 'production UI');
  assert(!document.hidden, 'The WebKit document is hidden. Unlock the Mac and show the test window.');
  const api = window.previewApi;
  api.focusChanged(true);
  const live = document.querySelector('.live-button');
  if (live.getAttribute('aria-pressed') === 'true') live.click();
  await settle();
  let scans = 0, cycles = 0, hiddenScans = 0, hiddenMutations = 0;
  const originalExec = api.exec;
  api.exec = async request => { scans++; return originalExec(request); };
  let phase = '', expectedElements = null, hiddenStart = 0, observer = null;
  // Keep the fake host's foreground state under test control when the user
  // switches applications. Actual WebKit document visibility is not overridden.
  window.addEventListener('blur', () => {
    if (phase !== 'hidden' && phase !== 'idle' && !document.hidden) api.focusChanged(true);
  });
  const phases = new Set();
  const started = performance.now();
  // Full run: 2 min warmup, 20 min churn, 5 min hidden, 5 min recovery, 3 min idle.
  // Short smoke runs use the same proportions.
  const phaseAt = elapsed => elapsed < seconds * 2 / 35 ? 'warmup'
    : elapsed < seconds * 22 / 35 ? 'active'
      : elapsed < seconds * 27 / 35 ? 'hidden'
        : elapsed < seconds * 32 / 35 ? 'recovery' : 'idle';
  const report = type => send({ type, phase, elapsed_s: (performance.now() - started) / 1000,
    cycles, scans, hiddenScans, hiddenMutations, elements: document.querySelectorAll('*').length,
    details: document.querySelectorAll('.detail-body').length, fixtureCalls: api.calls.length,
    errors: window.previewErrors.length, documentHidden: document.hidden });
  let lastReport = -30;
  while ((performance.now() - started) / 1000 < seconds) {
    const elapsed = (performance.now() - started) / 1000;
    const next = phaseAt(elapsed);
    if (next !== phase) {
      if (phase === 'hidden') {
        observer.disconnect(); observer = null;
        hiddenScans = scans - hiddenStart;
        assert(hiddenScans === 0 && hiddenMutations === 0, 'Hidden workload performed scans or DOM mutations');
        api.focusChanged(true); await settle();
      }
      phase = next;
      phases.add(phase);
      if (phase === 'hidden') {
        await until(() => !document.querySelector('.refresh').disabled, 'last foreground check');
        api.focusChanged(false); hiddenStart = scans;
        observer = new MutationObserver(records => { hiddenMutations += records.length; });
        observer.observe(document.querySelector('#app'), { subtree: true, attributes: true, childList: true, characterData: true });
      }
      report('phase');
    }
    if (phase === 'hidden') {
      api.emit('tab.updated', { tabID: 'preview-web' });
      api.emit('tab.updated', { tabID: 'unrelated' });
      api.emit('worktree.switched', {});
      api.calls.length = 0;
      await delay(1000);
    } else if (phase === 'idle') {
      await delay(1000);
    } else {
      // Every fifth cycle replaces all process identities to exercise removal
      // of old cards as well as in-place metric updates on the other cycles.
      const base = 10000 + Math.floor(cycles / 5) % 2 * 10000;
      api.processes = Array.from({ length: 6000 }, (_, index) => {
        const group = Math.floor(index / 30), member = index % 30;
        return processFixture({ pid: base + index, ppid: member ? base + group * 30 : 1,
          cwd: '/Users/example/Projects/storefront', ports: member ? [] : [{ port: 10000 + group, hosts: ['127.0.0.1'] }],
          cpuPercent: (cycles + index) % 9 / 100, rssKiB: 1000 + (cycles % 20) * 10 });
      });
      document.querySelector('.refresh').click();
      await settle(); await until(() => !document.querySelector('.refresh').disabled, 'refresh completion');
      assert(document.querySelectorAll('.service').length === 200, 'Expected 200 service cards');
      assert(document.querySelector('.service .stop').title.includes(`PID ${base} ·`), 'Refresh did not render the new process identity');
      for (const detail of Array.from(document.querySelectorAll('.service-details')).slice(0, 8)) detail.open = true;
      await settle();
      assert(document.querySelectorAll('tbody tr').length === 240, 'Expected 240 expanded process rows');
      for (const detail of document.querySelectorAll('.service-details[open]')) detail.open = false;
      await settle();
      const search = document.querySelector('.search');
      for (const value of ['no-such-service', 'storefront', '']) {
        search.value = value; search.dispatchEvent(new Event('input', { bubbles: true }));
        void document.body.offsetHeight;
      }
      assert(document.querySelectorAll('.detail-body').length === 0, 'Closed details retained DOM');
      const elements = document.querySelectorAll('*').length;
      expectedElements ??= elements;
      // Each service may gain up to three legitimate history alert elements.
      assert(elements <= expectedElements + 600, `DOM count exceeded its bound: ${expectedElements} -> ${elements}`);
      api.calls.length = 0;
      assert(window.previewErrors.length === 0, window.previewErrors[0]);
      cycles++;
      await delay(1000);
    }
    if (elapsed - lastReport >= 30) { report('sample'); lastReport = elapsed; }
  }
  if (observer) observer.disconnect();
  assert(phases.size === 5, `Workload skipped phases: ${[...phases].join(', ')}`);
  assert(window.previewErrors.length === 0, window.previewErrors[0]);
  report('finished');
}
