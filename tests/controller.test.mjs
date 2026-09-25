import test from 'node:test';
import assert from 'node:assert/strict';
import { Launchpad } from '../src/controller.js';
import { fakeMuxy } from './fake-muxy.mjs';

async function setup() {
  const api = fakeMuxy();
  const app = new Launchpad(api);
  app.subscribe();
  await app.refresh();
  const entry = await app.save({ name: 'Web', command: 'npm run dev', directory: '.', port: 3000 });
  return { app, api, entry };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('one-click start reuses a saved command and opens its terminal on the next click', async () => {
  const { app, api, entry } = await setup();
  try {
    const input = { name: 'dev', command: "npm run 'dev'", directory: '.' };
    assert.equal((await app.start(input)).entry.id, entry.id);
    assert.equal((await app.start(input)).action, 'terminal');
    assert.equal(api.stored.size, 1);
    assert.equal(api.calls.filter(c => c[0] === 'open').length, 1);
    assert.equal(api.calls.filter(c => c[0] === 'focus').length, 1);
  } finally { app.dispose(); }
});

test('concurrent one-click starts persist and launch a new script once', async () => {
  const { app, api } = await setup();
  try {
    const input = { name: 'API', command: 'npm run dev:api', directory: 'apps/api' };
    await Promise.all([app.start(input), app.start(input), app.start(input)]);
    assert.equal(api.stored.size, 2);
    assert.equal(api.calls.filter(c => c[0] === 'open').length, 1);
    assert.equal(api.calls.find(c => c[0] === 'open')[1].directory, 'apps/api');
  } finally { app.dispose(); }
});

test('one-click failure remains blocked on retry without creating duplicate records', async () => {
  const { app, api } = await setup();
  try {
    let opens = 0;
    api.tabs.open = async () => { opens++; throw new Error('response lost'); };
    const input = { name: 'API', command: 'npm run dev:api', directory: '.' };
    await assert.rejects(app.start(input), /Check Muxy/);
    await assert.rejects(app.start(input), /already has/);
    assert.equal(opens, 1); assert.equal(api.stored.size, 2);
    assert.equal(app.entries.find(entry => entry.name === 'API').run.state, 'unknown');
  } finally { app.dispose(); }
});

test('one-click start rejects a changed worktree before persisting or opening', async () => {
  const { app, api, entry } = await setup();
  try {
    const context = app.context; api.switchContext();
    await assert.rejects(app.start(entry, context), /Workspace changed/);
    assert.equal(api.stored.size, 1);
    assert.equal(api.calls.filter(c => c[0] === 'open').length, 0);
  } finally { app.dispose(); }
});

test('saved-command refresh never executes shell commands', async () => {
  const { app, api } = await setup();
  for (let i = 0; i < 5; i++) await app.refresh();
  assert.equal(api.calls.filter(c => c[0] === 'exec').length, 0);
  app.dispose();
});
test('launch persists intent before opening and recovers a linked terminal', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  const open = api.calls.find(c => c[0] === 'open');
  assert.equal(open[1].kind, 'terminal');
  assert.equal(open[1].directory, '.');
  assert(open[1].command.includes('npm run dev'));
  assert(open[1].command.endsWith('run-deck:' + app.entries[0].run.token));
  const loaded = new Launchpad(api); await loaded.refresh();
  assert.equal(loaded.entries[0].run.tabId, 'tab-1');
  await assert.rejects(loaded.launch(entry.id), /already has/);
  app.dispose(); loaded.dispose();
});
test('rapid repeated launches create only one terminal', async () => {
  const { app, api, entry } = await setup();
  await Promise.all([app.launch(entry.id), app.launch(entry.id), app.launch(entry.id)]);
  assert.equal(api.calls.filter(c => c[0] === 'open').length, 1);
  app.dispose();
});
test('ambiguous launch failure stays blocked until explicitly forgotten', async () => {
  const { app, api, entry } = await setup();
  api.tabs.open = async () => { throw new Error('response lost'); };
  await assert.rejects(app.launch(entry.id), /Check Muxy/);
  assert.equal(app.entries[0].run.state, 'unknown');
  await assert.rejects(app.launch(entry.id), /already has/);
  await app.forget(entry.id, async () => true);
  assert.equal(app.entries[0].run, null);
  app.dispose();
});
test('storage failure before launch prevents any command execution', async () => {
  const { app, api, entry } = await setup();
  api.storage.set = async () => { throw new Error('disk full'); };
  await assert.rejects(app.launch(entry.id), /disk full/);
  assert.equal(api.calls.filter(c => c[0] === 'open').length, 0);
  app.dispose();
});

test('closed or detached terminal is not assumed stopped and cannot be relaunched', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  api.setTabs([]);
  await assert.rejects(app.terminal(entry.id), /no longer visible/);
  await assert.rejects(app.launch(entry.id), /already has/);
  assert.equal(api.calls.filter(c => c[0] === 'sendKeys').length, 0);
  app.dispose();
});
test('workspace switch while editing rejects saving into another worktree', async () => {
  const { app, api } = await setup();
  const context = app.context;
  api.switchContext();
  await assert.rejects(app.save({ name: 'Wrong', command: 'echo x' }, null, context), /Workspace changed/);
  assert.equal([...api.stored.values()].filter(v => v.name === 'Wrong').length, 0);
  app.dispose();
});



test('discovery reads files without executing scripts', async () => {
  const { app, api } = await setup();
  const candidates = await app.discover();
  assert.equal(candidates[0].command, "pnpm run 'dev'");
  assert.equal(api.calls.filter(c => c[0] === 'exec' || c[0] === 'open').length, 0);
  api.files.stat = async () => ({ size: 300000 });
  await assert.rejects(app.discover(), /256 KiB/);
  app.dispose();
});
test('removal never closes a terminal or kills a process', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  await app.remove(entry.id, async () => true);
  assert.equal((await api.tabs.list()).length, 1);
  assert.equal(api.stored.size, 0);
  assert.equal(api.calls.filter(c => c[0] === 'sendKeys').length, 0);
  app.dispose();
});
test('disposing drops subscriptions and ignores subsequent host events', async () => {
  const { app, api } = await setup();
  app.dispose();
  api.emit('tab.created', { tabID: 'x', paneID: 'y', kind: 'terminal' });
  assert.equal(app.unsubscribers.length, 0);
});

test('tab event bursts refresh linked terminal availability without rereading saved commands', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  let reads = 0; let lists = 0;
  api.storage.get = async () => { reads++; throw new Error('Unexpected storage read'); };
  const list = api.tabs.list; api.tabs.list = async () => { lists++; return list(); };
  for (let i = 0; i < 100; i++) api.emit('tab.updated', { tabID: 'unrelated' });
  await settle(); assert.equal(lists, 0);
  api.setTabs([]);
  for (let i = 0; i < 100; i++) api.emit('tab.closed', { tabID: app.entries[0].run.tabId });
  await settle(); assert.equal(reads, 0); assert.equal(lists, 1); assert.deepEqual(app.tabs, []);
  app.dispose();
});
test('hidden host events perform no reads; foreground catches up once', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  let reads = 0; const get = api.storage.get;
  api.storage.get = async key => { reads++; return get(key); };
  let lists = 0; const list = api.tabs.list;
  api.tabs.list = async () => { lists++; return list(); };
  app.setVisible(false);
  for (let i = 0; i < 10; i++) api.emit('tab.closed', { tabID: app.entries[0].run.tabId });
  api.switchContext('tree-2'); api.switchContext('tree-1');
  await settle(); assert.equal(reads, 0); assert.equal(lists, 0);
  app.setVisible(true); await settle();
  assert.equal(reads, 1); assert.equal(lists, 1); assert.equal(app.entries[0].id, entry.id);
  app.dispose();
});
test('title-only changes do not notify the renderer', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  let changes = 0; app.changed = () => { changes++; };
  api.setTabs([{ id: app.entries[0].run.tabId, kind: 'terminal', title: 'New title' }]);
  api.emit('tab.updated', { tabID: app.entries[0].run.tabId }); await settle();
  assert.equal(changes, 0); app.dispose();
});
test('refresh callers wait for the new context when a workspace changes during a read', async () => {
  const { app, api } = await setup();
  let release; const keys = api.storage.keys;
  api.storage.keys = () => new Promise(resolve => { release = () => resolve(keys()); });
  const job = app.refresh(); await settle();
  api.switchContext(); api.storage.keys = keys; release();
  await job;
  assert.equal(app.context.worktreeId, 'tree-2'); assert.deepEqual(app.entries, []);
  app.dispose();
});
test('hiding before a queued event read starts defers it until foreground', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  let lists = 0; const list = api.tabs.list;
  api.tabs.list = async () => { lists++; return list(); };
  api.emit('tab.closed', { tabID: app.entries[0].run.tabId }); app.setVisible(false);
  await settle(); assert.equal(lists, 0);
  app.setVisible(true); await settle(); assert.equal(lists, 1); app.dispose();
});
test('automatic checks reuse commands but explicit refresh still observes storage changes', async () => {
  const { app, api, entry } = await setup();
  api.stored.set('v1/project-1/tree-1/' + entry.id, { ...entry, name: 'Renamed elsewhere' });
  let reads = 0; const get = api.storage.get;
  api.storage.get = async key => { reads++; return get(key); };
  await app.refresh({ cached: true }); assert.equal(reads, 0); assert.equal(app.entries[0].name, 'Web');
  await app.refresh(); assert.equal(reads, 1); assert.equal(app.entries[0].name, 'Renamed elsewhere');
  app.dispose();
});
test('hiding during automatic key enumeration prevents the saved-command read fanout', async () => {
  const { app, api } = await setup();
  const keys = api.storage.keys; const get = api.storage.get; let release; let reads = 0;
  api.storage.keys = () => new Promise(resolve => { release = () => resolve(keys()); });
  api.storage.get = async key => { reads++; return get(key); };
  api.emit('worktree.switched', {}); await settle();
  app.setVisible(false); release(); await settle(); assert.equal(reads, 0);
  api.storage.keys = keys; app.setVisible(true); await settle();
  assert.equal(reads, 1); assert.equal(app.entries.length, 1); app.dispose();
});
