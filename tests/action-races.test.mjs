import test from 'node:test';
import assert from 'node:assert/strict';
import { Launchpad } from '../src/controller.js';
import { fakeMuxy } from './fake-muxy.mjs';
import { ServiceMonitor } from '../src/services.js';
import { fakeServices } from './fake-services.mjs';

async function setup() {
  const api = fakeMuxy(), app = new Launchpad(api);
  app.subscribe(); await app.refresh();
  const entry = await app.save({ name: 'Example', command: 'echo original' });
  return { api, app, entry, key: `v1/project-1/tree-1/${entry.id}` };
}

for (const action of ['launch', 'restart']) for (const event of ['dispose', 'workspace switch']) test(`${event} during final ${action} preflight prevents a new terminal`, async () => {
  const { api, app, entry } = await setup();
  if (action === 'restart') await app.launch(entry.id);
  const initialOpens = api.calls.filter(call => call[0] === 'open').length;
  const list = api.worktrees.list;
  let reads = 0, release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  api.worktrees.list = async (...args) => {
    const trees = await list(...args);
    if (++reads !== (action === 'launch' ? 2 : 3)) return trees;
    return new Promise(resolve => { release = () => resolve(trees); entered(); });
  };
  const pending = action === 'launch' ? app.launch(entry.id)
    : app.restart(entry.id, app.entries[0].run.token, async () => null);
  const rejected = assert.rejects(pending, /Workspace changed/);
  await waiting;
  if (event === 'dispose') app.dispose(); else api.switchContext();
  release();
  try {
    await rejected;
    assert.equal(api.calls.filter(call => call[0] === 'open').length, initialOpens);
  } finally { app.dispose(); }
});

test('workspace invalidation during stop preflight prevents dispatching any signal', async () => {
  const api = fakeServices(), monitor = new ServiceMonitor(api);
  await monitor.refresh();
  const id = monitor.state.services[0].id;
  const before = api.calls.filter(call => call[0] === 'exec').length;
  const list = api.worktrees.list;
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  api.worktrees.list = async (...args) => {
    const trees = await list(...args);
    api.worktrees.list = list;
    return new Promise(resolve => { release = () => resolve(trees); entered(); });
  };
  const rejected = assert.rejects(monitor.stop(id), /workspace changed/i);
  await waiting; api.switchContext(); monitor.invalidate(); release();
  try {
    await rejected;
    assert.equal(api.calls.filter(call => call[0] === 'exec').length, before);
  } finally { monitor.dispose(); }
});

test('disposal after terminal dispatch still records the returned association', async () => {
  const { api, app, entry, key } = await setup();
  const open = api.tabs.open;
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  api.tabs.open = request => new Promise(resolve => { release = () => resolve(open(request)); entered(); });
  const pending = app.launch(entry.id);
  await waiting; app.dispose(); release();
  const linked = await pending;
  assert.equal(linked.run.state, 'linked');
  assert.deepEqual(api.stored.get(key).run, linked.run);
  assert.equal(api.calls.filter(call => call[0] === 'open').length, 1);
});

test('saving another command in the same workspace does not cancel launch preflight', async () => {
  const { api, app, entry } = await setup();
  const list = api.worktrees.list;
  let reads = 0, release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  api.worktrees.list = async (...args) => {
    const trees = await list(...args);
    if (++reads !== 2) return trees;
    return new Promise(resolve => { release = () => resolve(trees); entered(); });
  };
  const pending = app.launch(entry.id);
  await waiting;
  try {
    await app.save({ name: 'Independent command', command: 'echo other' });
    release();
    assert.equal((await pending).run.state, 'linked');
    assert.equal(api.calls.filter(call => call[0] === 'open').length, 1);
  } finally { release(); await pending.catch(() => {}); app.dispose(); }
});

test('a failed post-launch refresh preserves the confirmed terminal association', async () => {
  const { api, app, entry, key } = await setup();
  try {
    const keys = api.storage.keys;
    api.storage.keys = async () => { throw new Error('Storage unavailable during refresh'); };
    const linked = await app.launch(entry.id);
    assert.equal(linked.run.state, 'linked');
    assert.equal(linked.run.tabId, 'tab-1');
    assert.deepEqual(api.stored.get(key).run, linked.run);
    assert.match(app.error, /Storage unavailable/);
    api.storage.keys = keys;
    await app.refresh(); await app.terminal(entry.id);
    assert.deepEqual(api.calls.at(-1), ['focus', 'tab-1']);
    await assert.rejects(app.launch(entry.id), /already has a terminal association/);
    assert.equal(api.calls.filter(call => call[0] === 'open').length, 1);
  } finally { app.dispose(); }
});

for (const transition of ['switch', 'dispose']) test(`terminal navigation cancels on ${transition} during tab lookup`, async () => {
  const { api, app, entry } = await setup();
  try {
    await app.launch(entry.id);
    const list = api.tabs.list;
    let release, entered;
    const waiting = new Promise(resolve => { entered = resolve; });
    api.tabs.list = async () => {
      const tabs = await list();
      return new Promise(resolve => { release = () => resolve(tabs); entered(); });
    };
    const pending = app.terminal(entry.id);
    const rejected = assert.rejects(pending, /Workspace changed/);
    await waiting;
    // Keep the subscription refresh from introducing another tab read.
    app.setVisible(false);
    if (transition === 'switch') api.switchContext(); else app.dispose();
    release(); await rejected;
    assert.equal(api.calls.filter(call => call[0] === 'focus').length, 0);
  } finally { app.dispose(); }
});

test('cancelled restart preserves edits made while stopping and restores only its run state', async () => {
  const { api, app, entry, key } = await setup();
  try {
    await app.launch(entry.id);
    let edited;
    await assert.rejects(app.restart(entry.id, app.entries[0].run.token, async () => {
      edited = { ...api.stored.get(key), name: 'Edited elsewhere', command: 'echo updated', directory: 'apps/api' };
      api.stored.set(key, edited);
      return null;
    }), /association changed during restart/);
    assert.deepEqual(api.stored.get(key), { ...edited, run: { ...edited.run, state: 'linked' } });
    assert.equal(api.calls.filter(call => call[0] === 'open').length, 1);
  } finally { app.dispose(); }
});

test('failed restart does not roll back a newer launch token', async () => {
  const { api, app, entry, key } = await setup();
  try {
    await app.launch(entry.id);
    let updated;
    await assert.rejects(app.restart(entry.id, app.entries[0].run.token, async () => {
      const current = api.stored.get(key);
      updated = { ...current, run: { ...current.run, token: '22222222-2222-4222-8222-222222222222' } };
      api.stored.set(key, updated);
      throw new Error('stop failed');
    }), /stop failed/);
    assert.deepEqual(api.stored.get(key), updated);
  } finally { app.dispose(); }
});

test('forgetting an association preserves command edits made during confirmation', async () => {
  const { api, app, entry, key } = await setup();
  try {
    await app.launch(entry.id);
    let edited;
    await app.forget(entry.id, async () => {
      edited = { ...api.stored.get(key), name: 'Renamed elsewhere', port: 8080, kind: 'task' };
      api.stored.set(key, edited);
      return true;
    });
    assert.deepEqual(api.stored.get(key), { ...edited, run: null });
  } finally { app.dispose(); }
});

for (const change of ['replaced', 'removed']) test(`forget does not overwrite a ${change} launch during confirmation`, async () => {
  const { api, app, entry, key } = await setup();
  try {
    await app.launch(entry.id);
    let updated;
    await assert.rejects(app.forget(entry.id, async () => {
      updated = { ...api.stored.get(key), run: { state: 'linked', token: crypto.randomUUID(), tabId: 'new-tab' } };
      if (change === 'removed') api.stored.delete(key); else api.stored.set(key, updated);
      return true;
    }), /changed|removed/);
    assert.deepEqual(api.stored.get(key), change === 'removed' ? undefined : updated);
  } finally { app.dispose(); }
});

test('successful restart preserves metadata edited while the old service stops', async () => {
  const { api, app, entry, key } = await setup();
  try {
    await app.launch(entry.id);
    const token = app.entries[0].run.token;
    const linked = await app.restart(entry.id, token, async () => {
      api.stored.set(key, { ...api.stored.get(key), name: 'Renamed elsewhere', port: 8080, kind: 'task' });
      return null;
    });
    assert.equal(linked.name, 'Renamed elsewhere');
    assert.equal(linked.port, 8080); assert.equal(linked.kind, 'task');
    assert.notEqual(linked.run.token, token);
    assert.deepEqual(api.stored.get(key), linked);
  } finally { app.dispose(); }
});

test('terminal navigation refuses a stored association replaced since the last read', async () => {
  const { api, app, entry, key } = await setup();
  try {
    await app.launch(entry.id);
    const saved = api.stored.get(key);
    api.stored.set(key, { ...saved, run: { ...saved.run, token: crypto.randomUUID(), tabId: 'new-tab' } });
    api.setTabs([{ id: 'tab-1', kind: 'terminal' }, { id: 'new-tab', kind: 'terminal' }]);
    await assert.rejects(app.terminal(entry.id), /association changed/i);
    assert.equal(api.calls.filter(call => call[0] === 'focus').length, 0);
  } finally { app.dispose(); }
});
