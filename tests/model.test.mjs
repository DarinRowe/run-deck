import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, decodeRecord, terminalState, detectScripts, scopeKey, matchingCommand } from '../src/model.js';

const base = { name: 'Web', command: 'pnpm dev', directory: '.', kind: 'service', port: '' };
test('validates command boundaries and ports', () => {
  assert.equal(validateEntry(base).port, null);
  for (const port of ['0', '-1', '65536', 'abc', '3.14']) assert.throws(() => validateEntry({ ...base, port }));
  for (const directory of ['../app', 'app/../x', '/tmp/x', '~/x', 'x\ny']) assert.throws(() => validateEntry({ ...base, directory }));
  assert.throws(() => validateEntry({ ...base, command: 'echo\0x' }));
  assert.equal(validateEntry({ ...base, directory: 'packages/web' }).directory, 'packages/web');
});
test('rejects corrupt or future records instead of discarding them', () => {
  for (const value of [null, {}, { ...base, id: 'x', version: 2 }, { ...base, id: 'x', version: 1, run: { state: 'running' } }]) assert.throws(() => decodeRecord(value, 'x'));
});
test('terminal association never implies process health', () => {
  const entry = { run: { state: 'linked', tabId: 't' } };
  assert.equal(terminalState(entry, [{ id: 't', kind: 'terminal' }]), 'open');
  assert.equal(terminalState(entry, []), 'missing');
  assert.equal(terminalState({ run: { state: 'opening' } }, []), 'unknown');
  assert.equal(terminalState({}, []), 'ready');
});
test('imports only explicit script names with safe shell quoting', () => {
  const scripts = detectScripts(JSON.stringify({ scripts: { dev: 'vite', 'test:unit': 'node test', '--evil': 'x', 'x; echo danger': 'x', bad: 3 } }), ['pnpm-lock.yaml']);
  assert.equal(scripts.length, 2);
  assert.equal(scripts[0].command, "pnpm run 'dev'");
  assert.equal(scripts[0].kind, 'service');
  assert.equal(scripts[1].kind, 'task');
});
test('storage is scoped by project and worktree, not a display name', () => {
  assert.notEqual(scopeKey({ projectId: 'p1', worktreeId: 'w1' }), scopeKey({ projectId: 'p1', worktreeId: 'w2' }));
});

test('explicit package manager wins over stale lockfiles and service scripts come first', () => {
  const scripts = detectScripts(JSON.stringify({ packageManager: 'npm@10.9.0', scripts: {
    build: 'vite build', 'dev:api': 'node server.js', serve: 'vite preview', start: 'node app.js', dev: 'vite', test: 'node --test',
  } }), ['pnpm-lock.yaml', 'yarn.lock']);
  assert.deepEqual(scripts.map(script => script.name), ['dev', 'start', 'serve', 'dev:api', 'build', 'test']);
  assert(scripts.every(script => script.command.startsWith('npm run ')));
  for (const [file, manager] of [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['package-lock.json', 'npm']]) {
    assert.equal(detectScripts('{"scripts":{"dev":"vite"}}', [file])[0].command, `${manager} run 'dev'`);
  }
});

test('command matching tolerates literal script quoting while preserving shell and directory distinctions', () => {
  const entry = { ...base, command: 'npm run dev', directory: './apps/web/' };
  assert.equal(matchingCommand([entry], { command: "npm run 'dev'", directory: 'apps/web' }), entry);
  assert.equal(matchingCommand([entry], { command: 'npm run "dev"', directory: 'apps/web' }), entry);
  for (const command of ['npm run dev -- --host', 'npm run dev && echo done', 'pnpm run dev', 'npm run "d$ev"']) {
    assert.equal(matchingCommand([entry], { command, directory: 'apps/web' }), undefined);
  }
  assert.equal(matchingCommand([entry], { command: entry.command, directory: '.' }), undefined);
  const linked = { ...entry, run: { state: 'unknown' } };
  assert.equal(matchingCommand([entry, linked], entry), linked);
});
