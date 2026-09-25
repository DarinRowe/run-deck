import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('history of distinct listeners does not retain their full host scan buffers', t => {
  const benchmark = fileURLToPath(new URL('../scripts/benchmark-history-memory.mjs', import.meta.url));
  const result = JSON.parse(execFileSync(process.execPath, ['--expose-gc', benchmark], {
    encoding: 'utf8', timeout: 30000,
  }));
  t.diagnostic(JSON.stringify(result));
  assert.equal(result.lastSampleCount, 1);
  // A generous heap-growth budget, not an elapsed-time assertion. The broken
  // path retains roughly 140 MiB of text for only 200 small history records.
  assert(result.retainedBytes < 16 * 1024 * 1024,
    `History retained ${(result.retainedBytes / 2 ** 20).toFixed(1)} MiB`);
});
