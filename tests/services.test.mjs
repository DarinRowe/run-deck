import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceMonitor } from '../src/services.js';
import { ForegroundChecks } from '../src/observation.js';
import { SCAN_SCRIPT, parseSnapshot, stopTreeScript, defaultURL, validateURL, insideDirectory, stopRestriction } from '../src/processes.js';
import { fakeServices, processFixture, snapshotOutput, HOST_ID } from './fake-services.mjs';

async function setup(processes) {
  const api = fakeServices(processes);
  const app = new ServiceMonitor(api);
  await app.refresh();
  assert.equal(app.state.status, 'ready');
  return { app, api, id: app.state.services[0]?.id };
}
const execCalls = api => api.calls.filter(call => call[0] === 'exec');

test('a refresh automatically discovers actual processes and merges their ports', async () => {
  const { app, api } = await setup([processFixture({ ports: [{ port: 3000, hosts: ['127.0.0.1', '[::1]'] }, { port: 3001, hosts: ['*'] }] })]);
  assert.equal(app.state.services.length, 1);
  assert.equal(app.state.services[0].ports.length, 2);
  assert.equal(app.state.services[0].inProject, true);
  assert.equal(app.state.services[0].restriction, null);
  assert.equal(execCalls(api).length, 1);
  assert.equal(execCalls(api)[0][1].shell, SCAN_SCRIPT);
});
test('concurrent refreshes share one inspection and never launch a terminal', async () => {
  const api = fakeServices();
  const app = new ServiceMonitor(api);
  await Promise.all([app.refresh(), app.refresh(), app.refresh()]);
  assert.equal(execCalls(api).length, 1);
  assert.equal(api.calls.filter(call => call[0] === 'open').length, 0);
});
test('resource data shares the inspection, updates per process, and never changes stop identity', async () => {
  const { app, api, id } = await setup([processFixture({ cpuPercent: 238.7, rssKiB: 1500000, elapsed: '02-03:04:05', ports: [{ port: 3000, hosts: ['*'] }, { port: 3001, hosts: ['*'] }] })]);
  const first = app.state.services[0];
  assert.equal(first.cpuPercent, 238.7);
  assert.equal(first.memoryBytes, 1536000000);
  assert.equal(first.uptimeSeconds, 183845);
  assert.equal(app.state.services.length, 1);
  api.processes[0].cpuPercent = 0;
  api.processes[0].rssKiB = 128;
  api.processes[0].elapsed = '03:12';
  await app.refresh();
  const updated = app.state.services[0];
  assert.equal(updated.id, id);
  assert.equal(updated.cpuPercent, 0);
  assert.equal(updated.memoryBytes, 131072);
  assert.equal(updated.uptimeSeconds, 192);
  assert.equal(execCalls(api).length, 2);
  assert.equal(stopTreeScript(first, app.snapshot), stopTreeScript(updated, app.snapshot));
});
test('unavailable or invalid resources stay unknown rather than becoming zero', () => {
  for (const fields of [
    { cpuPercent: null, rssKiB: null, elapsed: null },
    { cpuPercent: '-1', rssKiB: '-1', elapsed: '00:99' },
    { cpuPercent: 'Infinity', rssKiB: '9007199254740991', elapsed: 'not-a-time' },
  ]) {
    const service = parseSnapshot(snapshotOutput([processFixture(fields)])).services[0];
    assert.equal(service.cpuPercent, null);
    assert.equal(service.memoryBytes, null);
    assert.equal(service.uptimeSeconds, null);
    assert.equal(service.verified, true);
  }
  const missing = parseSnapshot(snapshotOutput([processFixture({ started: null })])).services[0];
  assert.equal(missing.cpuPercent, null);
  assert.equal(missing.memoryBytes, null);
  assert.equal(missing.verified, false);
});
test('resource failures retain the prior snapshot and a successful retry replaces it', async () => {
  const { app, api } = await setup();
  const checkedAt = app.state.checkedAt;
  const inspect = api.exec;
  api.exec = async () => { throw new Error('denied'); };
  await app.refresh();
  assert.equal(app.state.status, 'error');
  assert.equal(app.state.checkedAt, checkedAt);
  assert.equal(app.state.services[0].cpuPercent, 3.6);
  api.exec = inspect; api.processes[0].cpuPercent = 12.5;
  await app.refresh();
  assert.equal(app.state.status, 'ready');
  assert.equal(app.state.services[0].cpuPercent, 12.5);
});
test('cancelled or incomplete inspection keeps an explicitly stale snapshot and blocks actions', async () => {
  const { app, api, id } = await setup();
  for (const result of [{ exitCode: 0, stdout: '', stderr: '', truncated: true }, { exitCode: 0, stdout: '', stderr: '', timedOut: true }, { exitCode: 0, stdout: '', stderr: 'lsof warning' }]) {
    api.exec = async () => result;
    await app.refresh();
    assert.equal(app.state.status, 'error');
    assert.equal(app.state.services.length, 1);
    await assert.rejects(app.stop(id), /Refresh/);
    await assert.rejects(app.open(id), /Refresh/);
  }
  api.exec = async () => { throw new Error('denied consent'); };
  await app.refresh();
  assert.match(app.state.error, /denied/);
});
test('no listeners is a verified empty result, distinct from inspection failure', async () => {
  const { app } = await setup([]);
  assert.deepEqual(app.state.services, []);
  assert(app.state.checkedAt instanceof Date);
});
test('workspace change during inspection automatically discards and replaces the old result', async () => {
  const api = fakeServices();
  const exec = api.exec;
  let calls = 0;
  api.exec = async request => {
    const result = await exec(request);
    if (++calls === 1) api.switchContext('next-tree');
    return result;
  };
  const app = new ServiceMonitor(api);
  await app.refresh();
  assert.equal(calls, 2);
  assert.equal(app.state.context.worktreeId, 'next-tree');
  assert.equal(app.state.services[0].inProject, false);
});
test('Open confirms the browser host once, remembers it, and opens directly thereafter', async () => {
  const { app, api, id } = await setup();
  let prompts = 0;
  const confirmHost = async hostname => { prompts++; assert.equal(hostname, 'dev-mac.local'); return true; };
  await app.open(id, { confirmHost });
  await app.open(id, { confirmHost });
  assert.equal(prompts, 1);
  assert.deepEqual(api.calls.filter(call => call[0] === 'browser'), [['browser', 'http://127.0.0.1:3000/'], ['browser', 'http://127.0.0.1:3000/']]);
  assert.equal(execCalls(api).length, 1);
});
test('declining the host confirmation opens nothing and stores no consent', async () => {
  const { app, api, id } = await setup();
  await app.open(id, { confirmHost: async () => false });
  assert.equal(api.calls.filter(call => call[0] === 'browser').length, 0);
  assert.equal(await api.storage.get('browser-host/' + HOST_ID), null);
});
test('custom URL is explicit, validated, and remembered across process restarts', async () => {
  const { app, api, id } = await setup();
  await app.open(id, { url: 'https://app.local:3443/admin' });
  api.processes[0].pid++;
  await app.refresh();
  await app.open(app.state.services[0].id);
  assert.equal(api.calls.filter(call => call[0] === 'browser').at(-1)[1], 'https://app.local:3443/admin');
  await assert.rejects(app.open(app.state.services[0].id, { url: 'javascript:alert(1)' }), /HTTP/);
});
test('workspace change during browser confirmation cancels navigation and remembers nothing', async () => {
  const { app, api, id } = await setup();
  await assert.rejects(app.open(id, { confirmHost: async () => { api.switchContext(); return true; } }), /workspace changed/);
  assert.equal(api.calls.filter(call => call[0] === 'browser').length, 0);
  assert.equal(await api.storage.get('browser-host/' + HOST_ID), null);
});
test('invalidation during browser confirmation cancels navigation even before context reads update', async () => {
  const { app, api, id } = await setup();
  try {
    await assert.rejects(app.open(id, { confirmHost: async () => { app.invalidate(); return true; } }), /workspace changed/i);
    assert.equal(api.calls.filter(call => call[0] === 'browser').length, 0);
    assert.equal(await api.storage.get('browser-host/' + HOST_ID), null);
  } finally { app.dispose(); }
});
test('Open awaits an in-flight quiet scan and refuses a failed inspection', async () => {
  const { app, api, id } = await setup();
  let release;
  api.exec = () => new Promise(resolve => { release = resolve; });
  const scan = app.refresh({ quiet: true });
  await new Promise(resolve => setImmediate(resolve));
  const opening = app.open(id, { url: 'https://app.local/' });
  const rejected = assert.rejects(opening, /Refresh/);
  release({ exitCode: 1, stdout: '', stderr: 'denied' });
  try {
    await scan; await rejected;
    assert.equal(api.calls.filter(call => call[0] === 'browser').length, 0);
  } finally { app.dispose(); }
});
test('Open does not request browser confirmation after disposal while waiting for a quiet scan', async () => {
  const { app, api, id } = await setup();
  let release, prompts = 0;
  api.exec = () => new Promise(resolve => { release = resolve; });
  const scan = app.refresh({ quiet: true });
  await new Promise(resolve => setImmediate(resolve));
  const rejected = assert.rejects(app.open(id, { confirmHost: async () => { prompts++; return true; } }), /Refresh/);
  app.dispose();
  release({ exitCode: 0, stdout: snapshotOutput(api.processes), stderr: '' });
  await scan; await rejected;
  assert.equal(prompts, 0);
  assert.equal(api.calls.filter(call => call[0] === 'browser').length, 0);
});
for (const change of ['dispose', 'invalidate']) test(`Open does not request browser confirmation after ${change} during remembered-host lookup`, async () => {
  const { app, api, id } = await setup();
  let release, prompts = 0;
  const get = api.storage.get;
  api.storage.get = key => key.startsWith('browser-host/') ? new Promise(resolve => { release = resolve; }) : get(key);
  const rejected = assert.rejects(app.open(id, { confirmHost: async () => { prompts++; return true; } }), /workspace changed/i);
  app[change](); release(null);
  try {
    await rejected;
    assert.equal(prompts, 0);
    assert.equal(api.calls.filter(call => call[0] === 'browser').length, 0);
    assert.equal(await get('browser-host/' + HOST_ID), null);
  } finally { app.dispose(); }
});
test('stopping a project process is one host command, verifies the result, and does not ask twice', async () => {
  const { app, api, id } = await setup();
  const result = await app.stop(id, () => { throw new Error('Redundant confirmation'); });
  assert.deepEqual(result, { outcome: 'stopped' });
  assert.equal(app.state.services.length, 0);
  assert.equal(execCalls(api).length, 2);
  const shell = execCalls(api)[1][1].shell;
  assert.match(shell, /\/bin\/kill -TERM 4102/);
  assert(!shell.includes('kill -9'));
  assert(shell.includes(HOST_ID));
});
test('an external process needs confirmation; cancel and workspace switch do not send a signal', async () => {
  const { app, api, id } = await setup([processFixture({ cwd: '/opt/homebrew/var' })]);
  assert.deepEqual(await app.stop(id, async () => false), { cancelled: true });
  assert.equal(execCalls(api).length, 1);
  await assert.rejects(app.stop(id, async () => { api.switchContext(); return true; }), /workspace changed/);
  assert.equal(execCalls(api).length, 1);
});
test('invalidation during external-stop confirmation prevents signalling an obsolete observation', async () => {
  const { app, api, id } = await setup([processFixture({ cwd: '/other' })]);
  try {
    await assert.rejects(app.stop(id, async () => { app.invalidate(); return true; }), /workspace changed/i);
    assert.equal(execCalls(api).length, 1);
    assert.equal(api.processes.length, 1);
  } finally { app.dispose(); }
});
test('rapid Stop clicks cannot send duplicate signals', async () => {
  const { app, api, id } = await setup();
  await Promise.all([app.stop(id), app.stop(id), app.stop(id)]);
  assert.equal(execCalls(api).length, 2);
});
test('stops of different services remain exclusive while awaiting a quiet scan', async () => {
  const { app, api } = await setup([
    processFixture(), processFixture({ pid: 5102, ports: [{ port: 3001, hosts: ['127.0.0.1'] }] }),
  ]);
  const [first, second] = app.state.services;
  const exec = api.exec;
  let release;
  api.exec = request => request.shell === SCAN_SCRIPT
    ? new Promise(resolve => { release = () => resolve(exec(request)); }) : exec(request);
  const scan = app.refresh({ quiet: true });
  await new Promise(resolve => setImmediate(resolve));
  const stopping = Promise.allSettled([app.stop(first.id), app.stop(second.id)]);
  release(); await scan;
  const results = await stopping;
  assert.equal(execCalls(api).filter(call => call[1].shell !== SCAN_SCRIPT).length, 1);
  assert.deepEqual(results, [
    { status: 'fulfilled', value: { outcome: 'stopped' } },
    { status: 'fulfilled', value: undefined },
  ]);
  assert.equal(app.state.status, 'ready');
  assert.deepEqual(app.state.services.map(service => service.id), [second.id]);
  app.dispose();
});
test('a still-listening process and a replacement process never report stopped', async () => {
  for (const outcome of ['stillRunning', 'replaced']) {
    const { app, api, id } = await setup();
    api.exec = async () => {
      if (outcome === 'replaced') api.processes[0].pid++;
      return { exitCode: 0, stdout: snapshotOutput(api.processes), stderr: '' };
    };
    assert.deepEqual(await app.stop(id), { outcome });
  }
});
test('host or process mismatch fails closed without a successful status', async () => {
  const { app, api, id } = await setup();
  api.exec = async () => ({ exitCode: 72, stdout: '', stderr: '' });
  await assert.rejects(app.stop(id), /no restart was started/);
  assert.equal(app.state.status, 'error');
  assert.equal(app.state.services.length, 1);
});
test('a late refresh cannot overwrite a newer stop result', async () => {
  const { app, api, id } = await setup();
  let releaseScan;
  const realExec = api.exec;
  api.exec = request => request.shell === SCAN_SCRIPT ? new Promise(resolve => { releaseScan = resolve; }) : realExec(request);
  const refreshing = app.refresh();
  await new Promise(resolve => setImmediate(resolve));
  // Actions remain disabled during refresh, so callers cannot stop a stale view.
  await assert.rejects(app.stop(id), /Refresh/);
  releaseScan({ exitCode: 0, stdout: snapshotOutput(api.processes), stderr: '' });
  await refreshing;
  assert.deepEqual(await app.stop(id), { outcome: 'stopped' });
  assert.equal(app.state.services.length, 0);
});
test('disposed inspection cannot publish a late snapshot', async () => {
  const api = fakeServices();
  let release;
  api.exec = () => new Promise(resolve => { release = resolve; });
  let updates = 0;
  const app = new ServiceMonitor(api, () => updates++);
  const pending = app.refresh();
  await new Promise(resolve => setImmediate(resolve));
  app.dispose(); const before = updates;
  release({ exitCode: 0, stdout: snapshotOutput(), stderr: '' });
  await pending;
  assert.equal(app.state.services.length, 0);
  assert.equal(updates, before);
});
test('process parsing preserves path whitespace and refuses incomplete data', () => {
  const snapshot = parseSnapshot(snapshotOutput([processFixture({ cwd: '/Users/example/A folder\nwith newline' })]));
  assert.equal(snapshot.services[0].cwd, '/Users/example/A folder\nwith newline');
  assert.throws(() => parseSnapshot('p42\ncnode\nn*:3000'));
  assert.throws(() => parseSnapshot(snapshotOutput().slice(0, -3)));
  assert.equal(insideDirectory('/app-two', '/app'), false);
  assert.equal(insideDirectory('/app/subdir', '/app/'), true);
});
test('system apps, other-user and unverified processes cannot be signalled', () => {
  for (const fields of [{ executable: '/Applications/Muxy.app/Contents/MacOS/Muxy' }, { executable: '/usr/libexec/rapportd' }, { uid: 0 }, { started: null }]) {
    const snapshot = parseSnapshot(snapshotOutput([processFixture(fields)]));
    const service = snapshot.services[0];
    assert(stopRestriction(service, snapshot.uid));
    assert.throws(() => stopTreeScript(service, snapshot));
  }
});
test('browser defaults handle IPv6, HTTPS, bound addresses, and non-browser ports', () => {
  const service = ports => ({ ports });
  assert.equal(defaultURL(service([{ port: 3000, hosts: ['[::1]'] }])), 'http://[::1]:3000');
  assert.equal(defaultURL(service([{ port: 443, hosts: ['*'] }])), 'https://localhost:443');
  assert.equal(defaultURL(service([{ port: 8080, hosts: ['192.168.1.5'] }])), 'http://192.168.1.5:8080');
  assert.equal(defaultURL(service([{ port: 5432, hosts: ['127.0.0.1'] }])), null);
  assert.throws(() => validateURL('https://user:secret@localhost'));
});

test('service and endpoint bounds never produce a stoppable partial identity', () => {
  const many = Array.from({ length: 205 }, (_, index) => processFixture({ pid: index + 10 }));
  const snapshot = parseSnapshot(snapshotOutput(many));
  assert.equal(snapshot.services.length, 200);
  assert.equal(snapshot.limited, true);
  const crowded = parseSnapshot(snapshotOutput([processFixture({ ports: Array.from({ length: 40 }, (_, index) => ({ port: 3000 + index, hosts: ['*'] })) })]));
  assert.equal(crowded.services[0].ports.length, 32);
  assert.equal(crowded.services[0].verified, false);
  assert.equal(crowded.limited, true);
  assert.throws(() => stopTreeScript(crowded.services[0], crowded));
});
test('custom address survives recreating the panel and is visible in the service state', async () => {
  const { app, api, id } = await setup();
  await app.open(id, { url: 'https://app.local/dashboard' });
  const reopened = new ServiceMonitor(api);
  await reopened.refresh();
  assert.equal(reopened.state.services[0].url, 'https://app.local/dashboard');
  assert.equal(reopened.state.services[0].customURL, true);
  await reopened.open(reopened.state.services[0].id);
  assert.equal(api.calls.filter(call => call[0] === 'browser').at(-1)[1], 'https://app.local/dashboard');
});

test('custom addresses distinguish separate bindings on the same port', async () => {
  const { app, api } = await setup([
    processFixture(), processFixture({ pid: 5102, ports: [{ port: 3000, hosts: ['[::1]'] }] }),
  ]);
  await app.open(app.state.services[0].id, { url: 'https://ipv4.example/dashboard' });
  const reopened = new ServiceMonitor(api);
  await reopened.refresh();
  assert.deepEqual(reopened.state.services.map(service => [service.url, service.customURL]), [
    ['https://ipv4.example/dashboard', true], ['http://[::1]:3000', false],
  ]);
  app.dispose(); reopened.dispose();
});

test('custom address keys do not depend on binding order or duplicate addresses', async () => {
  const { app, api, id } = await setup([processFixture({ ports: [
    { port: 3000, hosts: ['127.0.0.1', '[::1]'] }, { port: 3001, hosts: ['127.0.0.1'] },
  ] })]);
  await app.open(id, { url: 'https://combined.example/' });
  api.processes[0].ports = [
    { port: 3001, hosts: ['127.0.0.1'] }, { port: 3000, hosts: ['[::1]', '127.0.0.1', '[::1]'] },
  ];
  await app.refresh();
  assert.equal(app.state.services[0].url, 'https://combined.example/');
  assert.equal(app.state.services[0].customURL, true);
  app.dispose();
});

test('legacy custom addresses remain usable only when their old key is unambiguous', async () => {
  const api = fakeServices();
  const legacyKey = 'service-url/' + encodeURIComponent(JSON.stringify([
    'dev-mac.local', '/Users/example/acme', '/opt/homebrew/bin/node', [3000],
  ]));
  await api.storage.set('service-urls/v1', { [legacyKey]: 'https://legacy.example/' });
  const app = new ServiceMonitor(api);
  await app.refresh();
  assert.equal(app.state.services[0].url, 'https://legacy.example/');
  api.processes.push(processFixture({ pid: 5102, ports: [{ port: 3000, hosts: ['[::1]'] }] }));
  await app.refresh();
  assert.deepEqual(app.state.services.map(service => [service.url, service.customURL]), [
    ['http://127.0.0.1:3000', false], ['http://[::1]:3000', false],
  ]);
  app.dispose();
});

test('concurrent custom address saves retain both services after reopening', async () => {
  const { app, api } = await setup([
    processFixture(), processFixture({ pid: 5102, ports: [{ port: 3001, hosts: ['127.0.0.1'] }] }),
  ]);
  await Promise.all(app.state.services.map((service, index) => app.open(service.id, { url: `https://service-${index}.example/` })));
  const reopened = new ServiceMonitor(api);
  await reopened.refresh();
  assert.deepEqual(reopened.state.services.map(service => service.url), [
    'https://service-0.example/', 'https://service-1.example/',
  ]);
  app.dispose(); reopened.dispose();
});

test('a failed custom address write does not block queued or later saves', async () => {
  const { app, api } = await setup([
    processFixture(), processFixture({ pid: 5102, ports: [{ port: 3001, hosts: ['127.0.0.1'] }] }),
  ]);
  const [first, second] = app.state.services;
  const set = api.storage.set;
  let attempts = 0;
  api.storage.set = async (key, value) => {
    if (key === 'service-urls/v1' && ++attempts === 1) throw new Error('Storage unavailable');
    return set(key, value);
  };
  const results = await Promise.allSettled([
    app.open(first.id, { url: 'https://first.example/' }), app.open(second.id, { url: 'https://second.example/' }),
  ]);
  assert.equal(results[0].status, 'rejected');
  assert.match(results[0].reason.message, /Storage unavailable/);
  assert.equal(results[1].status, 'fulfilled');
  await app.open(first.id, { url: 'https://retry.example/' });
  const reopened = new ServiceMonitor(api);
  await reopened.refresh();
  assert.deepEqual(reopened.state.services.map(service => service.url), ['https://retry.example/', 'https://second.example/']);
  app.dispose(); reopened.dispose();
});
test('refresh requested during an external-stop confirmation runs after cancellation', async () => {
  const { app, api, id } = await setup([processFixture({ cwd: '/other' })]);
  const result = await app.stop(id, async () => { await app.refresh(); return false; });
  assert.equal(result.cancelled, true);
  assert.equal(execCalls(api).length, 2);
  assert(execCalls(api).every(call => call[1].shell === SCAN_SCRIPT));
  assert.equal(app.state.status, 'ready');
});
test('an automatic refresh that reaches a pending Stop cannot escape foreground scheduling', async () => {
  const { app, api, id } = await setup([processFixture({ cwd: '/other' })]);
  const checks = new ForegroundChecks(async ({ signal }) => {
    await app.refresh({ quiet: true, signal });
    return app.state.status === 'ready';
  }, () => {}, { clearTimeout() {}, setTimeout() { return 1; } });
  let release;
  const stopping = app.stop(id, () => new Promise(resolve => { release = resolve; }));
  try {
    checks.setEnabled(true);
    await checks.run(false, true);
    checks.setVisible(false);
    release(false); await stopping;
    assert.equal(execCalls(api).length, 1, 'hiding must not allow a deferred automatic scan after Stop confirmation');
  } finally { checks.dispose(); app.dispose(); }
});
test('context invalidation disables actions and discards an in-flight scan without starting another', async () => {
  const { app, api, id } = await setup();
  const exec = api.exec; let release;
  api.exec = async request => { await new Promise(resolve => { release = resolve; }); return exec(request); };
  const job = app.refresh({ quiet: true });
  await new Promise(resolve => setImmediate(resolve));
  app.invalidate(); await assert.rejects(app.stop(id), /Refresh/);
  api.switchContext(); release(); await job;
  assert.equal(execCalls(api).length, 2); assert.equal(app.state.status, 'loading');
  api.exec = exec; await app.refresh();
  assert.equal(app.state.status, 'ready'); assert.equal(app.state.context.worktreeId, 'tree-2');
});
test('cancelling inspection during asynchronous preflight prevents shell execution', async () => {
  for (const stage of ['context', 'storage']) {
    const api = fakeServices(); const app = new ServiceMonitor(api); const controller = new AbortController();
    let release;
    const owner = stage === 'context' ? api.projects : api.storage;
    const method = stage === 'context' ? 'list' : 'get'; const original = owner[method];
    owner[method] = (...args) => new Promise(resolve => { release = async () => resolve(await original(...args)); });
    const job = app.refresh({ signal: controller.signal });
    await new Promise(resolve => setImmediate(resolve));
    controller.abort(new Error('Automatic inspection paused. Refresh to continue.'));
    release(); await job;
    assert.equal(execCalls(api).length, 0, stage); assert.equal(app.state.status, 'error');
    assert.match(app.state.error, /paused/); assert.equal(app.state.checking, false);
    owner[method] = original; await app.refresh(); assert.equal(execCalls(api).length, 1);
    assert.equal(app.state.status, 'ready'); app.dispose();
  }
});
