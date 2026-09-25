import test from 'node:test';
import assert from 'node:assert/strict';
import { ForegroundChecks, ServiceHistory } from '../src/observation.js';
function scheduler() {
  let next = 0; const tasks = new Map();
  return { setTimeout(fn, delay) { assert(delay >= 0 && delay <= 5000); tasks.set(++next, fn); return next; }, clearTimeout(id) { tasks.delete(id); },
    async tick() { const jobs = [...tasks.values()]; tasks.clear(); await Promise.all(jobs.map(fn => fn())); }, get size() { return tasks.size; } };
}
test('foreground checks serialize, pause while hidden or held, and stop on failure or disposal', async () => {
  const clock = scheduler(); let checks = 0; let success = true;
  const loop = new ForegroundChecks(async () => { checks++; return success; }, () => {}, clock);
  assert.equal(clock.size, 0);
  loop.setEnabled(true); await clock.tick(); assert.equal(checks, 1); assert.equal(clock.size, 1);
  loop.setVisible(false); await clock.tick(); assert.equal(checks, 1);
  loop.setVisible(true); loop.setHeld(true); await clock.tick(); assert.equal(checks, 1);
  loop.setHeld(false); await clock.tick(); assert.equal(checks, 2);
  success = false; await clock.tick(); assert.equal(loop.enabled, false); assert.equal(clock.size, 0);
  loop.setEnabled(true); loop.dispose(); await clock.tick(); assert.equal(checks, 3);
});
test('focus lost during an automatic request pauses instead of prompting again', async () => {
  const clock = scheduler(); let resolve;
  const loop = new ForegroundChecks(() => new Promise(done => { resolve = done; }), () => {}, clock);
  loop.setEnabled(true); const tick = clock.tick();
  await Promise.resolve();
  loop.setVisible(false); loop.setVisible(true); assert.equal(clock.size, 0);
  resolve(true); await tick;
  assert.equal(loop.interrupted, true); assert.equal(loop.enabled, false); assert.equal(clock.size, 0);
});
test('invalidations coalesce while hidden or held and run once even with live mode off', async () => {
  const clock = scheduler(); const checks = [];
  const loop = new ForegroundChecks(({ full, automatic }) => { checks.push({ full, automatic }); return true; }, () => {}, clock);
  loop.setVisible(false);
  for (let i = 0; i < 20; i++) loop.invalidate(150);
  await clock.tick(); assert.equal(checks.length, 0);
  loop.setHeld(true); loop.setVisible(true); await clock.tick(); assert.equal(checks.length, 0);
  loop.setHeld(false); await clock.tick();
  assert.deepEqual(checks, [{ full: true, automatic: true }]); assert.equal(clock.size, 0);
  loop.dispose(); loop.invalidate(); await clock.tick(); assert.equal(checks.length, 1);
});
test('manual refresh shares an in-flight check and invalidation during it gets one follow-up', async () => {
  const clock = scheduler(); let resolve; let count = 0;
  const loop = new ForegroundChecks(() => { count++; return count === 1 ? new Promise(done => { resolve = done; }) : true; }, () => {}, clock);
  const first = loop.refresh(); const same = loop.refresh(); assert.equal(first, same);
  await Promise.resolve(); loop.invalidate(); loop.invalidate();
  resolve(true); await first; await clock.tick(); assert.equal(count, 2);
  assert.equal(clock.size, 0);
});
test('uninterrupted live checks retain a five-second interval after completion', async () => {
  const delays = [];
  const clock = { setTimeout(fn, delay) { delays.push(delay); return 1; }, clearTimeout() {} };
  const loop = new ForegroundChecks(() => true, () => {}, clock);
  loop.setEnabled(true); await loop.tick();
  assert.deepEqual(delays, [5000, 5000]); loop.dispose();
});
test('manual refresh during a periodic scan waits for a full check without overlapping it', async () => {
  const clock = scheduler(); let release; const calls = [];
  const loop = new ForegroundChecks(({ full, automatic }) => {
    calls.push({ full, automatic });
    return calls.length === 1 ? new Promise(resolve => { release = resolve; }) : true;
  }, () => {}, clock);
  loop.setEnabled(true); const tick = clock.tick(); await Promise.resolve();
  const manual = loop.refresh(); const duplicate = loop.refresh();
  assert.equal(calls.length, 1); release(true); await Promise.all([tick, manual, duplicate]);
  assert.deepEqual(calls, [{ full: false, automatic: true }, { full: true, automatic: false }]);
  loop.dispose();
});
test('manual refresh after an automatic full check reads fresh state and survives automatic cancellation', async () => {
  for (const cancelled of [false, true]) {
    const clock = scheduler(); const calls = []; let release;
    const loop = new ForegroundChecks(async options => {
      calls.push({ full: options.full, automatic: options.automatic });
      if (options.automatic) {
        await new Promise(resolve => { release = resolve; });
        options.signal.throwIfAborted();
      }
      return true;
    }, () => {}, clock);
    loop.invalidate(); const automatic = clock.tick(); await Promise.resolve();
    const manual = loop.refresh(); const duplicate = loop.refresh();
    assert.equal(calls.length, 1);
    if (cancelled) loop.setVisible(false);
    release(); await Promise.all([automatic, manual, duplicate]);
    assert.deepEqual(calls, [{ full: true, automatic: true }, { full: true, automatic: false }]);
    assert.equal(loop.interrupted, false);
    loop.dispose();
  }
});
test('hiding cancels automatic preflight work but not explicit refresh', async () => {
  const clock = scheduler(); let release; let signal;
  const loop = new ForegroundChecks(options => {
    signal = options.signal;
    return new Promise(resolve => { release = resolve; });
  }, () => {}, clock);
  loop.setEnabled(true); const automatic = clock.tick(); await Promise.resolve();
  assert.equal(signal.aborted, false); loop.setVisible(false); assert.equal(signal.aborted, true);
  release(true); await automatic;
  const manual = loop.refresh(); await Promise.resolve();
  assert.equal(signal, undefined); release(true); await manual; loop.dispose();
});
const service = (overrides = {}) => ({ cwd: '/project', executable: 'node', ports: [{ port: 3000 }], listeningIds: 'pid-a', cpuPercent: 90, memoryBytes: 200 * 1024 * 1024, ...overrides });
test('alerts require sustained CPU or substantial steady memory growth; gaps reset the window', () => {
  const history = new ServiceHistory();
  for (let i = 0; i < 6; i++) assert.deepEqual(history.observe(service({ memoryBytes: (200 + i * 20) * 1024 * 1024 }), 'host', i * 5000).alerts, []);
  assert.deepEqual(history.observe(service({ memoryBytes: 320 * 1024 * 1024 }), 'host', 30000).alerts, ['highCPU', 'memoryGrowth']);
  assert.deepEqual(history.observe(service(), 'host', 35000).alerts, ['highCPU']);
  assert.deepEqual(history.observe(service(), 'host', 60000).alerts, []);
});
test('brief peaks, missing metrics, and manual refresh bursts do not trigger alerts', () => {
  const history = new ServiceHistory();
  for (let i = 0; i <= 60; i++) {
    const alerts = history.observe(service({ cpuPercent: i % 3 ? 5 : 95, memoryBytes: i % 3 ? null : 1e9 }), 'host', i * 1000).alerts;
    assert.deepEqual(alerts, []);
  }
});
test('three observed replacements trigger an inline warning; deliberate reset clears it', () => {
  const history = new ServiceHistory();
  const item = service();
  history.observe(item, 'host', 0);
  for (let i=1;i<=3;i++) {
    item.listeningIds = 'pid-' + i;
    assert.deepEqual(history.observe(item, 'host', i * 5000).alerts, i === 3 ? ['restartingOften'] : []);
  }
  history.forget(item, 'host'); assert.deepEqual(history.observe(item, 'host', 20000).alerts, []);
});
test('sustained hints tolerate the inspection duration added to each five-second interval', () => {
  for (const interval of [5900, 9000]) {
    const history = new ServiceHistory();
    const count = Math.ceil(30000 / interval);
    for (let i = 0; i <= count; i++) {
      const result = history.observe(service({ memoryBytes: (200 + i * 40) * 1024 * 1024 }), 'host', i * interval);
      assert.deepEqual(result.alerts, i === count ? ['highCPU', 'memoryGrowth'] : [], `interval=${interval}, observation=${i}`);
    }
  }
});
test('nonuniform windows still reject brief peaks, missing readings, and interrupted observation', () => {
  for (const interval of [5900, 9000]) {
    const count = Math.ceil(30000 / interval);
    for (const scenario of ['peak', 'missing', 'gap']) {
      const history = new ServiceHistory();
      for (let i = 0; i <= count; i++) {
        const metrics = { cpuPercent: 90, memoryBytes: (200 + i * 40) * 1024 * 1024 };
        if (scenario === 'peak' && i < count) metrics.cpuPercent = 5;
        if (scenario === 'peak') metrics.memoryBytes = 200 * 1024 * 1024;
        if (scenario === 'missing' && i === count - 1) { metrics.cpuPercent = null; metrics.memoryBytes = null; }
        const time = i * interval + (scenario === 'gap' && i === count ? 16000 : 0);
        assert.deepEqual(history.observe(service(metrics), 'host', time).alerts, [], `${scenario}, interval=${interval}, observation=${i}`);
      }
    }
  }
});
