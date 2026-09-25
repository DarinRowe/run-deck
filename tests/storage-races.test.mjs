import test from 'node:test';
import assert from 'node:assert/strict';
import { Launchpad } from '../src/controller.js';
import { fakeMuxy } from './fake-muxy.mjs';

for (const operation of ['set', 'delete']) test(`a refresh started during ${operation} cannot restore the previous saved record`, async () => {
  const api = fakeMuxy(), app = new Launchpad(api);
  await app.refresh();
  const entry = await app.save({ name: 'Original', command: 'echo example' });
  const key = `v1/project-1/tree-1/${entry.id}`;
  const mutate = api.storage[operation], get = api.storage.get;
  let releaseMutation, releaseRead, mutationEntered, readEntered;
  const mutationWaiting = new Promise(resolve => { mutationEntered = resolve; });
  const readWaiting = new Promise(resolve => { readEntered = resolve; });
  api.storage[operation] = async (...args) => {
    await new Promise(resolve => { releaseMutation = resolve; mutationEntered(); });
    return mutate(...args);
  };
  const changing = operation === 'set'
    ? app.save({ ...entry, name: 'Edited' }, entry.id)
    : app.remove(entry.id, async () => true);
  await mutationWaiting;
  // Capture the old stored value while the write is still pending, then let
  // that response arrive after the mutation has updated the local cache.
  api.storage.get = async (...args) => {
    const value = await get(...args);
    api.storage.get = get;
    return new Promise(resolve => { releaseRead = () => resolve(value); readEntered(); });
  };
  const reading = app.refresh();
  await readWaiting;
  try {
    releaseMutation(); await changing;
    releaseRead(); await reading;
    assert.deepEqual(app.entries, operation === 'set' ? [api.stored.get(key)] : []);
    assert.equal(app.entries[0]?.name, operation === 'set' ? 'Edited' : undefined);
  } finally {
    releaseMutation(); releaseRead();
    await Promise.allSettled([changing, reading]);
    app.dispose();
  }
});

for (const outcome of ['success', 'failure']) for (const change of ['rename', 'remove', 'replace', 'forget']) {
  test(`a ${outcome} terminal response preserves a concurrent ${change}`, async () => {
    const api = fakeMuxy(), app = new Launchpad(api), other = new Launchpad(api);
    await app.refresh();
    const entry = await app.save({ name: 'Original', command: 'echo example' });
    const key = `v1/project-1/tree-1/${entry.id}`, open = api.tabs.open;
    let release, entered;
    const waiting = new Promise(resolve => { entered = resolve; });
    api.tabs.open = async request => {
      await new Promise(resolve => { release = resolve; entered(); });
      if (outcome === 'failure') throw new Error('Host response failed');
      return open(request);
    };
    const launching = app.launch(entry.id).then(value => ({ value }), error => ({ error }));
    await waiting;
    await other.refresh();
    try {
      if (change === 'rename') await other.save({ ...entry, name: 'Edited elsewhere' }, entry.id);
      else if (change === 'remove') await other.remove(entry.id, async () => true);
      else {
        await other.forget(entry.id, async () => true);
        if (change === 'replace') {
          api.tabs.open = open;
          await other.launch(entry.id);
        }
      }
      const changed = structuredClone(api.stored.get(key));
      release();
      const result = await launching;
      if (change === 'rename') {
        const stored = api.stored.get(key);
        assert.equal(stored.name, 'Edited elsewhere');
        assert.equal(stored.run.token, changed.run.token);
        assert.equal(stored.run.state, outcome === 'success' ? 'linked' : 'unknown');
        if (outcome === 'success') assert.deepEqual(result.value, stored);
        else assert.match(result.error?.message || '', /Host response failed/);
      } else {
        assert.deepEqual(api.stored.get(key), changed);
        assert.match(result.error?.message || '', outcome === 'success' ? /association changed/i : /Host response failed/);
        if (outcome === 'success') assert.match(result.error.message, /A terminal was opened/);
      }
    } finally { release(); await launching; app.dispose(); other.dispose(); }
  });
}

test('a failed storage acknowledgment does not demote an already linked launch', async () => {
  const api = fakeMuxy(), app = new Launchpad(api);
  await app.refresh();
  const entry = await app.save({ name: 'Example', command: 'echo example' });
  const set = api.storage.set;
  api.storage.set = async (key, value) => {
    await set(key, value);
    if (value.run?.state === 'linked') throw new Error('Storage acknowledgment lost');
  };
  try {
    await assert.rejects(app.launch(entry.id), /Storage acknowledgment lost.*A terminal was opened/);
    const stored = api.stored.get(`v1/project-1/tree-1/${entry.id}`);
    assert.equal(stored.run.state, 'linked');
    assert.equal(stored.run.tabId, 'tab-1');
  } finally { app.dispose(); }
});
