import { performance } from 'node:perf_hooks';
import { parseSnapshot, groupServices } from '../src/processes.js';
import { ServiceHistory } from '../src/observation.js';
import { processFixture, snapshotOutput } from '../tests/fake-services.mjs';

// Synthetic input only: this benchmark never inspects or signals host processes.
for (const [services, members] of [[20, 10], [200, 30]]) {
  const processes = [];
  for (let i = 0; i < services; i++) for (let j = 0; j < members; j++) {
    processes.push(processFixture({ pid: 10000 + i * members + j, ppid: j ? 10000 + i * members : 1,
      ports: j ? [] : [{ port: 10000 + i, hosts: ['127.0.0.1'] }] }));
  }
  const raw = snapshotOutput(processes);
  const history = new ServiceHistory();
  const durations = [];
  let latest;
  const batch = start => {
    for (let i = start; i < start + 100; i++) {
      const at = performance.now();
      const snapshot = parseSnapshot(raw);
      latest = groupServices(snapshot).map(service => ({ ...service, ...history.observe(service, snapshot.hostId, i * 5000) }));
      if (i >= 10) durations.push(performance.now() - at);
    }
    global.gc?.();
    return process.memoryUsage().heapUsed;
  };
  const before = batch(0), after = batch(100);
  durations.sort((a, b) => a - b);
  console.log(JSON.stringify({ services: latest.length, processes: processes.length, inputBytes: Buffer.byteLength(raw),
    medianMs: +durations[Math.floor(durations.length / 2)].toFixed(2), p95Ms: +durations[Math.floor(durations.length * 0.95)].toFixed(2),
    heapBefore: before, heapAfter: after, forcedGC: !!global.gc,
    historyKeys: history.records.size, maxSamples: Math.max(...[...history.records.values()].map(record => record.samples.length)) }));
}
