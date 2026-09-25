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

test('opening and refreshing never launch system commands', async () => {
  const { app, api } = await setup();
  for (let i = 0; i < 5; i++) await app.refresh();
  assert.equal(api.calls.filter(c => c[0] === 'exec').length, 0);
  app.dispose();
});
test('launch persists intent before opening and recovers a linked terminal', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  const open = api.calls.find(c => c[0] === 'open');
  assert.deepEqual(open[1], { kind: 'terminal', directory: '.', command: 'npm run dev' });
  const loaded = new Launchpad(api); await loaded.refresh();
  assert.equal(loaded.entries[0].run.tabId, 'tab-1');
  assert.equal(loaded.entries[0].run.paneId, 'pane-1');
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
test('interrupt targets a verified pane and cancellation is a no-op', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  await app.interrupt(entry.id, async () => false);
  assert.equal(api.calls.filter(c => c[0] === 'sendKeys').length, 0);
  await app.interrupt(entry.id, async () => true);
  assert.deepEqual(api.calls.find(c => c[0] === 'sendKeys'), ['sendKeys', 'pane-1', 'ctrl+c']);
  app.dispose();
});
test('closed or detached terminal is not assumed stopped and cannot be interrupted', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  api.setTabs([]);
  await assert.rejects(app.interrupt(entry.id, async () => true), /terminal changed/);
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
test('workspace switch while confirmation is open prevents interrupt', async () => {
  const { app, api, entry } = await setup();
  await app.launch(entry.id); await settle();
  await assert.rejects(app.interrupt(entry.id, async () => { api.switchContext(); return true; }), /Workspace changed/);
  assert.equal(api.calls.filter(c => c[0] === 'sendKeys').length, 0);
  app.dispose();
});
test('port query is bounded, manual, and cannot signal any process', async () => {
  const { app, api } = await setup();
  await app.scanPorts();
  assert.equal(app.ports[0].port, 3000);
  assert.deepEqual(api.calls.find(c => c[0] === 'exec')[1], ['/usr/sbin/lsof', '-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn']);
  api.exec = async () => ({ exitCode: 1, stdout: '', stderr: 'permission denied', timedOut: false, truncated: false });
  await assert.rejects(app.scanPorts(), /failed/);
  app.dispose();
});
test('truncated and timed out scans do not turn into empty healthy results', async () => {
  const { app, api } = await setup();
  for (const flag of ['truncated', 'timedOut']) {
    api.exec = async () => ({ exitCode: 0, stdout: '', stderr: '', [flag]: true });
    await assert.rejects(app.scanPorts());
    assert.equal(app.ports, null);
  }
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
  assert.equal(app.events.size, 0);
});
