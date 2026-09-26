import test from 'node:test';
import assert from 'node:assert/strict';
import { Launchpad } from '../src/controller.js';
import { scopeKey } from '../src/model.js';
import { fakeMuxy } from './fake-muxy.mjs';

async function setup(state = 'linked') {
  const api = fakeMuxy();
  const app = new Launchpad(api);
  app.subscribe();
  await app.refresh();
  const input = { name: 'dev', command: "pnpm run 'dev'", directory: '.' };
  const { entry } = await app.start(input);
  const key = scopeKey(app.context) + entry.id;
  const old = { ...entry, run: { ...entry.run, state } };
  await api.storage.set(key, old);
  api.setTabs([]);
  await app.refresh();
  api.calls.length = 0;
  return { app, api, input, key, old };
}

for (const state of ['linked', 'unknown', 'opening', 'restarting']) {
  test(`explicit recovery replaces a ${state} association and launches once`, async t => {
    const { app, api, input, key, old } = await setup(state);
    t.after(() => app.dispose());
    let confirmations = 0;
    const result = await app.start(input, app.context, async entry => {
      confirmations++;
      assert.deepEqual(entry, old);
      assert.equal(api.calls.length, 0, 'No writes or launches before confirmation');
      return true;
    });
    assert.equal(confirmations, 1);
    assert.equal(result.action, 'launch');
    assert.equal(api.stored.size, 1);
    assert.equal(result.entry.id, old.id);
    assert.notEqual(result.entry.run.token, old.run.token);
    assert.equal(api.stored.get(key).run.state, 'linked');
    assert.equal(api.calls.filter(call => call[0] === 'open').length, 1);
    assert.equal(api.calls.filter(call => call[0] === 'exec').length, 0);
  });
}

test('cancelled recovery preserves the association and makes no writes', async t => {
  const { app, api, input, key, old } = await setup();
  t.after(() => app.dispose());
  assert.equal(await app.start(input, app.context, async () => false), undefined);
  assert.deepEqual(api.stored.get(key), old);
  assert.deepEqual(api.calls, []);
});

test('recovery retains metadata edited during confirmation', async t => {
  const { app, api, input, key, old } = await setup();
  t.after(() => app.dispose());
  const result = await app.start(input, app.context, async () => {
    await api.storage.set(key, { ...old, name: 'Renamed', port: 4321 });
    return true;
  });
  assert.equal(result.entry.name, 'Renamed');
  assert.equal(result.entry.port, 4321);
});

for (const change of ['removed', 'association', 'command', 'directory', 'restored terminal', 'workspace', 'same-path workspace event', 'disposed']) {
  test(`recovery rejects ${change} during confirmation`, async t => {
    const { app, api, input, key, old } = await setup();
    t.after(() => app.dispose());
    await assert.rejects(app.start(input, app.context, async () => {
      if (change === 'removed') await api.storage.delete(key);
      if (change === 'association') await api.storage.set(key, { ...old, run: { ...old.run, token: crypto.randomUUID() } });
      if (change === 'command' || change === 'directory') await api.storage.set(key, { ...old, [change]: change === 'command' ? 'echo changed' : 'other' });
      if (change === 'restored terminal') api.setTabs([{ id: old.run.tabId, kind: 'terminal' }]);
      if (change === 'workspace') api.switchContext();
      if (change === 'same-path workspace event') api.emit('worktree.switched', {});
      if (change === 'disposed') app.dispose();
      return true;
    }), /changed|removed|available|Workspace/);
    assert.equal(api.calls.filter(call => call[0] === 'open').length, 0);
    const current = api.stored.get(key);
    if (current) assert.equal(current.run.state, 'linked');
  });
}

test('recovery does not retry a denied or ambiguous new launch', async t => {
  const { app, api, input, key, old } = await setup();
  t.after(() => app.dispose());
  let launches = 0;
  api.tabs.open = async () => { launches++; throw new Error('Denied'); };
  await assert.rejects(app.start(input, app.context, async () => true), /Denied/);
  assert.equal(api.stored.get(key).run.state, 'unknown');
  assert.notEqual(api.stored.get(key).run.token, old.run.token);
  await assert.rejects(app.start(input), /already has/);
  assert.equal(launches, 1);
});

test('repeated clicks share one recovery confirmation and launch', async t => {
  const { app, api, input } = await setup();
  t.after(() => app.dispose());
  let confirmations = 0;
  const confirm = async () => { confirmations++; return true; };
  await Promise.all([app.start(input, app.context, confirm), app.start(input, app.context, confirm)]);
  assert.equal(confirmations, 1);
  assert.equal(api.calls.filter(call => call[0] === 'open').length, 1);
});

test('failed recovery intent write preserves the old association', async t => {
  const { app, api, input, key, old } = await setup();
  t.after(() => app.dispose());
  api.storage.set = async () => { throw new Error('Disk full'); };
  await assert.rejects(app.start(input, app.context, async () => true), /Disk full/);
  assert.deepEqual(api.stored.get(key), old);
  assert.equal(api.calls.filter(call => call[0] === 'open').length, 0);
});
