import test from 'node:test';
import assert from 'node:assert/strict';
import { Launchpad } from '../src/controller.js';
import { fakeMuxy } from './fake-muxy.mjs';

test('missing root package.json is an empty discovery, while read errors remain errors', async () => {
  const api = fakeMuxy(); const app = new Launchpad(api); await app.refresh();
  try {
    api.files.list = async () => [];
    assert.deepEqual(await app.discover(), []);
    api.files.list = async () => { throw new Error('permission denied'); };
    await assert.rejects(app.discover(), /permission denied/);
  } finally { app.dispose(); }
});

async function fixture(stage = 'list') {
  const api = fakeMuxy();
  const app = new Launchpad(api);
  app.subscribe(); await app.refresh();
  const calls = [];
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  for (const method of ['list', 'stat', 'read']) {
    const original = api.files[method];
    api.files[method] = (...args) => {
      calls.push(method);
      if (method === stage && !release) return new Promise(resolve => {
        release = () => { release = null; resolve(original(...args)); }; entered();
      });
      return original(...args);
    };
  }
  return { app, api, calls, waiting, release: () => release?.() };
}

for (const stage of ['list', 'stat', 'read']) test(`cancelled discovery stops after the pending ${stage} response`, async () => {
  const f = await fixture(stage), controller = new AbortController();
  const pending = f.app.discover({ signal: controller.signal });
  const rejected = assert.rejects(pending, /dialog closed/);
  await f.waiting;
  const before = [...f.calls];
  controller.abort(new Error('dialog closed')); f.release();
  try { await rejected; assert.deepEqual(f.calls, before); }
  finally { f.app.dispose(); }
});

test('discovery cancelled before starting performs no host reads', async () => {
  const { app, api } = await fixture();
  let reads = 0;
  api.projects.list = async () => { reads++; throw new Error('Unexpected read'); };
  const controller = new AbortController(); controller.abort(new Error('dialog closed'));
  try {
    await assert.rejects(app.discover({ signal: controller.signal }), /dialog closed/);
    assert.equal(reads, 0);
  } finally { app.dispose(); }
});

test('a reopened dialog can discover scripts without waiting for a cancelled host request', async () => {
  const f = await fixture(), controller = new AbortController();
  const old = f.app.discover({ signal: controller.signal }).catch(() => null);
  await f.waiting; controller.abort();
  try {
    const candidates = await f.app.discover();
    assert.equal(candidates?.[0].command, "pnpm run 'dev'");
    assert.deepEqual(f.calls, ['list', 'list', 'stat', 'read']);
  } finally { f.release(); await old; f.app.dispose(); }
});

for (const action of ['dispose', 'switch']) test(`discovery stops stale file reads after ${action}`, async () => {
  const f = await fixture();
  const pending = f.app.discover();
  const rejected = assert.rejects(pending, /Workspace changed/);
  await f.waiting;
  if (action === 'dispose') f.app.dispose(); else f.api.switchContext();
  f.release();
  try { await rejected; assert.deepEqual(f.calls, ['list']); }
  finally { f.app.dispose(); }
});

for (const phase of ['initial', 'final']) for (const transition of ['cancel', 'dispose', 'workspace event']) {
  test(`${transition} during ${phase} discovery context lookup prevents its next host read`, async () => {
    const api = fakeMuxy(), app = new Launchpad(api), controller = new AbortController();
    app.subscribe(); await app.refresh();
    const calls = [];
    let release, entered, projectReads = 0;
    const waiting = new Promise(resolve => { entered = resolve; });
    const list = api.projects.list;
    api.projects.list = async () => {
      calls.push('projects');
      const projects = await list();
      if (++projectReads !== (phase === 'initial' ? 1 : 2)) return projects;
      return new Promise(resolve => { release = () => resolve(projects); entered(); });
    };
    const worktrees = api.worktrees.list;
    api.worktrees.list = (...args) => { calls.push('worktrees'); return worktrees(...args); };
    for (const method of ['list', 'stat', 'read']) {
      const original = api.files[method];
      api.files[method] = (...args) => { calls.push(method); return original(...args); };
    }
    const pending = app.discover({ signal: controller.signal });
    const rejected = assert.rejects(pending, transition === 'cancel' ? /dialog closed/ : /Workspace changed/);
    await waiting;
    const before = [...calls];
    if (transition === 'cancel') controller.abort(new Error('dialog closed'));
    else if (transition === 'dispose') app.dispose();
    else { app.setVisible(false); api.emit('worktree.switched', {}); }
    release();
    try { await rejected; assert.deepEqual(calls, before); }
    finally { app.dispose(); }
  });
}

test('discovery discards an invalidated file read even when refreshed context is unchanged', async () => {
  const f = await fixture();
  const pending = f.app.discover();
  const rejected = assert.rejects(pending, /Workspace changed/);
  await f.waiting;
  f.api.emit('worktree.switched', {});
  await f.app.refresh();
  f.release();
  try { await rejected; assert.deepEqual(f.calls, ['list']); }
  finally { f.app.dispose(); }
});
