import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceMonitor } from '../src/services.js';
import { ServiceHistory } from '../src/observation.js';
import { fakeServices, processFixture } from './fake-services.mjs';

test('stable listeners on different addresses keep separate samples without false replacements', async () => {
  const api = fakeServices([
    processFixture({ pid: 5101, cpuPercent: 5, ports: [{ port: 3000, hosts: ['127.0.0.1'] }] }),
    processFixture({ pid: 5102, cpuPercent: 90, ports: [{ port: 3000, hosts: ['[::1]'] }] }),
  ]);
  let now = 0;
  const monitor = new ServiceMonitor(api, () => {}, { now: () => now });
  try {
    for (; now <= 30000; now += 5000) {
      await monitor.refresh();
      assert.equal(monitor.state.status, 'ready');
      for (const service of monitor.state.services) {
        assert(!service.alerts.includes('restartingOften'));
        assert.equal(service.samples.length, now / 5000 + 1);
        assert(service.samples.every(sample => sample.cpu === service.cpuPercent));
      }
    }
    assert.deepEqual(monitor.state.services.find(service => service.pid === 5101).alerts, []);
    assert.deepEqual(monitor.state.services.find(service => service.pid === 5102).alerts, ['highCPU']);
  } finally { monitor.dispose(); }
});

test('endpoint ordering does not reset history, while real identity changes still count', () => {
  const history = new ServiceHistory();
  const service = { cwd: '/project', executable: 'node', listeningIds: 'pid-a', cpuPercent: 5, memoryBytes: 1,
    ports: [{ port: 3000, hosts: ['127.0.0.1', '[::1]'] }, { port: 3001, hosts: ['127.0.0.2'] }] };
  history.observe(service, 'host', 0);
  const reordered = { ...service, ports: [{ port: 3001, hosts: ['127.0.0.2'] }, { port: 3000, hosts: ['[::1]', '127.0.0.1'] }] };
  assert.equal(history.observe(reordered, 'host', 5000).samples.length, 2);
  for (let i = 1; i <= 3; i++) {
    const result = history.observe({ ...reordered, listeningIds: `replacement-${i}` }, 'host', 5000 + i * 5000);
    assert.deepEqual(result.alerts, i === 3 ? ['restartingOften'] : []);
  }
});
