import { parseSnapshot, groupServices } from '../src/processes.js';
import { ServiceHistory } from '../src/observation.js';
import { processFixture, snapshotOutput } from '../tests/fake-services.mjs';

if (!global.gc) throw new Error('Run with node --expose-gc');

// New listeners arrive in separate full-host snapshots. Reusing a single raw
// string would hide retention of older scan buffers through sliced identities.
const processes = Array.from({ length: 6000 }, (_, i) =>
  processFixture({ pid: 10000 + i, ppid: 1, ports: [] }));
const history = new ServiceHistory();
const heap = () => { global.gc(); return process.memoryUsage().heapUsed; };
const before = heap();
function observe(index) {
  processes[0].ports = [{ port: 10000 + index, hosts: ['127.0.0.1'] }];
  const snapshot = parseSnapshot(snapshotOutput(processes));
  const service = groupServices(snapshot)[0];
  return history.observe(service, snapshot.hostId, index * 5000);
}
for (let i = 0; i < 200; i++) observe(i);
const after = heap();
// Keep the history observably live across collection without exposing its
// implementation as the test surface.
const latest = observe(199);
console.log(JSON.stringify({ scenario: 'distinct-snapshot-history', snapshots: 200,
  processes: processes.length, heapBefore: before, heapAfter: after,
  retainedBytes: after - before, lastSampleCount: latest.samples.length }));
