import test from 'node:test';
import assert from 'node:assert/strict';
import { groupServices, parseSnapshot, stopTreeScript } from '../src/processes.js';
import { Launchpad } from '../src/controller.js';
import { ServiceMonitor } from '../src/services.js';
import { fakeServices, processFixture, snapshotOutput } from './fake-services.mjs';
const token = '11111111-1111-4111-8111-111111111111';
const fixtures = () => [
  processFixture({ pid: 100, name: 'sh', executable: '/bin/sh', runToken: token, ports: [], cpuPercent: 0, rssKiB: 1000 }),
  processFixture({ pid: 101, ppid: 100, cpuPercent: 20, rssKiB: 100000 }),
  processFixture({ pid: 102, ppid: 101, ports: [], cpuPercent: 70, rssKiB: 300000 }),
  processFixture({ pid: 103, ppid: 100, ports: [{port: 3001, hosts:['*']}], cpuPercent: 10, rssKiB: 10000 }),
  processFixture({ pid: 104, ports: [{port: 8080, hosts:['*']}], cpuPercent: 1, rssKiB: 2000 }),
];
const entry = { id: 'web', name: 'Web', command: 'node server.js', directory: '.', run: { state:'linked', token, tabId:'tab-web' } };
test('a launch token folds sibling listeners and workers once, without absorbing unrelated processes', () => {
  const snapshot = parseSnapshot(snapshotOutput(fixtures()));
  const groups = groupServices(snapshot, [entry]);
  assert.equal(groups.length, 2);
  const group = groups.find(p => p.pid === 100);
  assert.equal(group.cpuPercent, 100); assert.equal(group.memoryBytes, 411000 * 1024);
  assert.deepEqual(group.ports.map(p => p.port), [3000,3001]);
  assert.equal(group.members.length, 4); assert.equal(group.source.tabId, 'tab-web');
  assert(!stopTreeScript(group, snapshot).includes('/bin/kill -TERM 104'));
});
test('matching directories do not establish a launch association and unknown metrics stay unknown', () => {
  const data = fixtures(); data[2].rssKiB = null;
  const groups = groupServices(parseSnapshot(snapshotOutput(data)), []);
  assert.equal(groups.find(p => p.pid === 101).source.entryId, undefined);
  assert.equal(groups.find(p => p.pid === 101).memoryBytes, null);
});

function wideTree() {
  return [
    fixtures()[0],
    ...Array.from({ length: 300 }, (_, i) => processFixture({ pid: 200 + i, ppid: 100, ports: [] })),
    processFixture({ pid: 500, ppid: 100, ports: [{ port: 3000, hosts: ['127.0.0.1'] }] }),
    processFixture({ pid: 501, ppid: 100, ports: [{ port: 3001, hosts: ['[::1]'] }] }),
    processFixture({ pid: 900, ports: [{ port: 9000, hosts: ['127.0.0.1'] }] }),
  ];
}
test('tree display limits retain every known listener and withhold incomplete totals', () => {
  const data = wideTree();
  for (const order of [data, [...data].reverse()]) {
    const snapshot = parseSnapshot(snapshotOutput(order));
    const group = groupServices(snapshot, [entry]).find(service => service.pid === 100);
    assert.equal(group.members.length, 256);
    assert.deepEqual(group.ports.map(endpoint => endpoint.port), [3000, 3001]);
    assert.equal(group.listeningIds, snapshot.services.filter(service => service.ppid === 100).map(service => service.id).sort().join('|'));
    assert.equal(group.cpuPercent, null); assert.equal(group.memoryBytes, null);
    assert.equal(group.verified, false);
    assert.throws(() => stopTreeScript(group, snapshot), /cannot be stopped safely/);
  }
});
test('a wide launch tree does not break refresh or disable an unrelated service', async () => {
  const api = fakeServices(wideTree());
  const commands = new Launchpad(api); await commands.refresh();
  const saved = await commands.save(entry);
  await commands.persist(commands.context, { ...saved, run: entry.run });
  const monitor = new ServiceMonitor(api, () => {}, { commands });
  try {
    await monitor.refresh();
    assert.equal(monitor.state.status, 'ready', monitor.state.error);
    assert.deepEqual(monitor.state.services.map(service => service.ports.map(endpoint => endpoint.port)), [[3000, 3001], [9000]]);
    assert.equal(monitor.state.services.find(service => service.pid === 900).restriction, null);
  } finally { monitor.dispose(); commands.dispose(); }
});
async function setup() {
  const api = fakeServices(fixtures());
  const commands = new Launchpad(api); await commands.refresh();
  const saved = await commands.save({name:'Web', command:'node server.js', directory:'.'});
  await commands.persist(commands.context, {...saved, run: entry.run});
  api.setTabs([{id:'tab-web',kind:'terminal'}]); await commands.refresh();
  const monitor = new ServiceMonitor(api, () => {}, {commands}); await monitor.refresh();
  return {api, commands, monitor, id: monitor.state.services.find(p => p.pid === 100).id};
}
test('restarting stops the exact old tree before opening one guarded replacement terminal', async () => {
  const {api,commands,monitor,id} = await setup();
  await monitor.terminal(id); assert.deepEqual(api.calls.at(-1), ['focus','tab-web']);
  await Promise.all([monitor.restart(id),monitor.restart(id)]);
  const opened = api.calls.filter(c => c[0] === 'open'); assert.equal(opened.length, 1);
  assert(api.calls.findIndex(c => c[0] === 'exec' && c[1].shell.includes('/bin/kill -TERM')) < api.calls.findIndex(c => c[0] === 'open'));
  assert(opened[0][1].command.includes('port is occupied'));
  assert.notEqual(commands.entries[0].run.token, token);
  assert.deepEqual(api.processes.map(p => p.pid), [104]);
});
test('still-running children, occupied ports, and failed stops never open a replacement', async () => {
  for (const mode of ['child','port','failed']) {
    const {api,monitor,id} = await setup();
    api.exec = async () => ({exitCode: mode === 'failed' ? 72 : 0, stdout: snapshotOutput(mode === 'child' ? [fixtures()[2]] : [processFixture({pid:999})]), stderr:''});
    await assert.rejects(monitor.restart(id));
    assert.equal(api.calls.filter(c => c[0] === 'open').length, 0);
  }
});
test('a changed launch record fails before any stop signal', async () => {
  const {api,commands,monitor,id} = await setup();
  const saved = commands.entries[0]; await commands.persist(commands.context, {...saved,run:{...saved.run,token:'22222222-2222-4222-8222-222222222222'}});
  const before = api.calls.filter(c => c[0] === 'exec').length;
  await assert.rejects(monitor.restart(id), /association changed/);
  assert.equal(api.calls.filter(c => c[0] === 'exec').length, before);
});

test('an old service row never navigates to a replacement launch terminal', async () => {
  const { api, commands, monitor, id } = await setup();
  try {
    const saved = commands.entries[0];
    await commands.persist(commands.context, {
      ...saved, run: { ...saved.run, token: crypto.randomUUID(), tabId: 'replacement-tab' },
    });
    api.setTabs([{ id: 'tab-web', kind: 'terminal' }, { id: 'replacement-tab', kind: 'terminal' }]);
    await assert.rejects(monitor.terminal(id), /association changed/i);
    assert.equal(api.calls.filter(call => call[0] === 'focus').length, 0);
  } finally { monitor.dispose(); commands.dispose(); }
});

test('Terminal awaits an in-flight quiet scan and refuses a failed inspection', async () => {
  const { api, commands, monitor, id } = await setup();
  let release;
  api.exec = () => new Promise(resolve => { release = resolve; });
  const scan = monitor.refresh({ quiet: true });
  await new Promise(resolve => setImmediate(resolve));
  const rejected = assert.rejects(monitor.terminal(id), /Refresh/);
  release({ exitCode: 1, stdout: '', stderr: 'denied' });
  try {
    await scan; await rejected;
    assert.equal(api.calls.filter(call => call[0] === 'focus').length, 0);
  } finally { monitor.dispose(); commands.dispose(); }
});
