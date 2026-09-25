import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, decodeRecord, terminalState, parseListeners, detectScripts, scopeKey } from '../src/model.js';

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
test('parses IPv4 and IPv6 listeners without conflating different processes', () => {
  const rows = parseListeners('p12\ncnode\nn127.0.0.1:3000\nn[::1]:3000\np13\ncpython\nn*:3000\nninvalid\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].hosts, ['127.0.0.1', '[::1]']);
  assert.equal(rows[1].pid, 13);
});
test('caps listener memory and ignores malformed records', () => {
  const input = Array.from({ length: 2000 }, (_, i) => `p${i+1}\ncnode\nn*:${1000+i}`).join('\n');
  assert.equal(parseListeners(input).length, 200);
  assert.deepEqual(parseListeners('n*:3000\npabc\nn*:80\np1\nn*:99999'), []);
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
