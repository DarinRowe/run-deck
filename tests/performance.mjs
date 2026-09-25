import { processFixture } from './fake-services.mjs';

// Run in tests/preview.html with its fake host. Assertions exercise the real
// UI through DOM events; elapsed times are evidence, not machine-specific gates.
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function refresh() {
  document.querySelector('.refresh').click();
  await settle();
  assert(!document.querySelector('.refresh').disabled, 'Fixture refresh did not finish');
}

export async function benchmarkUI(services = 200, members = 30) {
  assert(window.previewApi, 'Use the isolated fixture preview');
  const live = document.querySelector('.live-button');
  if (live.getAttribute('aria-pressed') === 'true') live.click();
  await settle();
  previewApi.processes = [];
  for (let i = 0; i < services; i++) for (let j = 0; j < members; j++) {
    previewApi.processes.push(processFixture({ pid: 10000 + i * members + j, ppid: j ? 10000 + i * members : 1,
      cwd: '/Users/example/Projects/storefront', ports: j ? [] : [{ port: 10000 + i, hosts: ['127.0.0.1'] }] }));
  }
  await refresh();
  assert(document.querySelectorAll('.service').length === services, 'Fixture service count');
  assert(document.querySelectorAll('tbody tr').length === 0, 'Collapsed details must not allocate process rows');
  const original = document.createElement;
  let created = 0;
  document.createElement = function (...args) { created++; return original.apply(this, args); };
  try {
    const search = document.querySelector('.search');
    const durations = [], layoutDurations = [];
    for (let i = 0; i < 25; i++) {
      search.value = i % 2 ? 'storefront' : 'no-such-service';
      const start = performance.now(); search.dispatchEvent(new Event('input', { bubbles: true }));
      if (i >= 5) durations.push(performance.now() - start);
      void document.body.offsetHeight;
      if (i >= 5) layoutDurations.push(performance.now() - start);
    }
    assert(created === 0, 'Search must not create DOM elements');
    search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true }));
    durations.sort((a, b) => a - b);
    layoutDurations.sort((a, b) => a - b);
    const elements = document.querySelectorAll('*').length;
    let unchangedMutations = 0;
    const observer = new MutationObserver(records => { unchangedMutations += records.length; });
    observer.observe(document.querySelector('.service-list'), { subtree: true, attributes: true, childList: true, characterData: true });
    try { created = 0; await refresh(); } finally { observer.disconnect(); }
    assert(created === 0, 'An unchanged snapshot must reuse all DOM elements');
    assert(unchangedMutations === 0, 'Unchanged service cards must not rewrite DOM attributes');

    const card = document.querySelector('.service');
    const detail = card.querySelector('.service-details'); detail.open = true;
    await settle();
    assert(card.querySelectorAll('tbody tr').length === members, 'Expanded detail must show its tree');
    const row = card.querySelector('tbody tr'); const input = card.querySelector('input[type=url]');
    input.value = 'https://example.test/unsaved';
    previewApi.processes[0].cpuPercent = 42;
    created = 0; await refresh();
    assert(card.querySelector('tbody tr') === row, 'Metric updates must retain process row identity');
    assert(row.children[2].textContent === '42.0%', 'Metric updates must change visible text');
    assert(input.value === 'https://example.test/unsaved', 'Refresh must preserve an edited URL');
    assert(created === 0, 'Metric updates must reuse detail cells');
    detail.open = false; await settle();
    assert(!card.querySelector('.detail-body'), 'Closing details must release their DOM');
    assert(previewErrors.length === 0, previewErrors.join('\n'));
    previewApi.calls.length = 0;
    return { services, processes: services * members, elements, searchElementsCreated: 0,
      searchMedianMs: durations[10], searchP95Ms: durations[19], searchWithLayoutMedianMs: layoutDurations[10],
      searchWithLayoutP95Ms: layoutDurations[19], unchangedRefreshElementsCreated: 0, unchangedRefreshMutations: unchangedMutations, detailChecks: 'passed' };
  } finally { document.createElement = original; }
}

export async function checkHiddenEvents() {
  assert(window.previewApi, 'Use the isolated fixture preview');
  const api = previewApi;
  if (document.querySelector('.live-button').getAttribute('aria-pressed') === 'true') document.querySelector('.live-button').click();
  await settle();
  const originals = { get: api.storage.get, list: api.tabs.list, exec: api.exec };
  let gets = 0, lists = 0, scans = 0, mutations = 0;
  api.storage.get = async (...args) => { gets++; return originals.get(...args); };
  api.tabs.list = async (...args) => { lists++; return originals.list(...args); };
  api.exec = async (...args) => { scans++; return originals.exec(...args); };
  const observer = new MutationObserver(records => { mutations += records.length; });
  try {
    api.focusChanged(false);
    observer.observe(document.querySelector('#app'), { subtree: true, childList: true, attributes: true, characterData: true });
    for (let i = 0; i < 10; i++) {
      api.emit('tab.updated', { tabID: 'unrelated' });
      api.emit('tab.updated', { tabID: 'preview-web' });
      api.emit('worktree.switched', {});
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    assert(gets === 0 && lists === 0 && scans === 0 && mutations === 0, 'Hidden events must not read, scan, or render');
    observer.disconnect();
    api.focusChanged(true);
    await new Promise(resolve => setTimeout(resolve, 200)); await settle();
    assert(lists === 1 && scans === 1, 'Foreground must coalesce deferred events into one refresh');
    return { hidden: { reads: 0, scans: 0, mutations: 0 }, resumed: { storageReads: gets, tabLists: lists, scans } };
  } finally {
    observer.disconnect(); api.storage.get = originals.get; api.tabs.list = originals.list; api.exec = originals.exec;
    api.focusChanged(true);
  }
}

export async function checkHiddenPreflight() {
  assert(window.previewApi, 'Use the isolated fixture preview');
  const api = previewApi;
  if (document.querySelector('.live-button').getAttribute('aria-pressed') === 'true') document.querySelector('.live-button').click();
  await settle();
  const originals = { keys: api.storage.keys, get: api.storage.get, exec: api.exec };
  let release, entered; let reads = 0, scans = 0;
  const pending = new Promise(resolve => { entered = resolve; });
  api.storage.keys = () => new Promise(resolve => { release = async () => resolve(await originals.keys()); entered(); });
  api.storage.get = async (...args) => { reads++; return originals.get(...args); };
  api.exec = async (...args) => { scans++; return originals.exec(...args); };
  try {
    api.emit('worktree.switched', {});
    await pending;
    // Let the queued automatic check join the delayed saved-command read.
    await new Promise(resolve => setTimeout(resolve, 0));
    api.focusChanged(false); release();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert(reads === 0 && scans === 0, 'Hiding mid-preflight must prevent subsequent reads and shell execution');
    api.storage.keys = originals.keys; api.focusChanged(true); await settle();
    assert(scans === 0, 'Interrupted automatic preflight must remain paused');
    await refresh();
    assert(scans === 1, 'An explicit refresh must recover from cancelled preflight');
    assert(document.querySelector('.scan-error').hidden, 'Manual recovery must clear the paused error');
    return { hiddenReads: 0, hiddenScans: 0, explicitRecoveryScans: scans };
  } finally {
    release?.(); api.storage.keys = originals.keys; api.storage.get = originals.get; api.exec = originals.exec;
    api.focusChanged(true);
  }
}

export async function checkWideTree() {
  assert(window.previewApi, 'Use the isolated fixture preview');
  const api = previewApi;
  const live = document.querySelector('.live-button');
  if (live.getAttribute('aria-pressed') === 'true') live.click();
  await settle();
  const entry = await api.storage.get('v1/project-1/tree-1/web');
  const cwd = '/Users/example/Projects/storefront';
  api.processes = [
    processFixture({ pid: 4100, name: 'sh', executable: '/bin/sh', ports: [], runToken: entry.run.token, cwd }),
    ...Array.from({ length: 300 }, (_, i) => processFixture({ pid: 6000 + i, ppid: 4100, ports: [], cwd })),
    processFixture({ pid: 8000, ppid: 4100, ports: [{ port: 3000, hosts: ['127.0.0.1'] }], cwd }),
    processFixture({ pid: 8001, ppid: 4100, ports: [{ port: 3001, hosts: ['127.0.0.1'] }], cwd }),
    processFixture({ pid: 9000, ports: [{ port: 9000, hosts: ['127.0.0.1'] }], cwd }),
  ];
  await refresh();
  assert(document.querySelector('.scan-error').hidden, 'A wide tree must not fail the scan');
  const cards = [...document.querySelectorAll('.service')];
  assert(cards.length === 2, 'Both the wide tree and unrelated listener must remain visible');
  const tree = cards.find(card => card.textContent.includes(':3000, :3001'));
  assert(tree, 'Known ports outside the displayed tree must remain visible');
  const stop = tree.querySelector('button[aria-label^="Stop "]');
  assert(stop.hidden, 'An incomplete tree must not offer Stop');
  const other = cards.find(card => card !== tree).querySelector('button[aria-label^="Stop "]');
  assert(!other.hidden && !other.disabled, 'An unrelated complete service must remain actionable');
  tree.querySelector('.service-details').open = true; await settle();
  assert(tree.querySelectorAll('tbody tr').length === 256, 'Details must respect the display cap');
  assert(tree.textContent.includes('CPU —'), 'Incomplete resource totals must be unknown');
  assert(previewErrors.length === 0, previewErrors.join('\n'));
  return { services: cards.length, displayedMembers: 256, ports: [3000, 3001], incompleteStopHidden: true, unrelatedStopEnabled: true };
}
