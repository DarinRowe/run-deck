import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const source = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const built = JSON.parse(await readFile(resolve(dist, 'package.json'), 'utf8'));
assert.deepEqual(built, source, 'The installable package must contain the exact source manifest.');
assert.equal(built.name, 'run-deck');
assert(built.muxy.permissions.includes('panels:write'), 'Panel toggle requires panels:write in Muxy.');
assert.equal(built.muxy.background, undefined, 'Run Deck must not start a background host.');
assert.equal(Object.keys(built.dependencies || {}).length, 0, 'No runtime npm dependencies.');
const files = [];
async function walk(dir) { for (const item of await readdir(dir, { withFileTypes: true })) {
  const file = resolve(dir, item.name);
  assert(!item.isSymbolicLink(), 'No symlinks in the distribution.');
  if (item.isDirectory()) await walk(file); else files.push(file);
} }
await walk(dist);
let codeBytes = 0;
for (const file of files) {
  const rel = relative(dist, file);
  assert(!/(node_modules|tests|preview|\.map$|\.py$)/.test(rel), `Unexpected shipped file: ${rel}`);
  if (/\.(js|css|html)$/.test(file)) codeBytes += (await stat(file)).size;
  if (file.endsWith('.js')) {
    const text = await readFile(file, 'utf8');
    assert(!text.includes('setInterval('), 'Use a serialized foreground timeout, not an unconditional interval.');
    assert(!text.includes('fakeMuxy'), 'No mock host in production.');
  }
}
assert(codeBytes < 128 * 1024, `UI exceeds the 128 KiB budget (seven complete locale dictionaries): ${codeBytes}`);
for (const shot of built.muxy.marketplace.screenshots) {
  const data = await readFile(resolve(dist, shot));
  assert.equal(data.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16), 1600);
  assert.equal(data.readUInt32BE(20), 1000);
  assert(data.length <= 3 * 1024 * 1024);
}
console.log(`Distribution verified: ${files.length} files; ${(codeBytes / 1024).toFixed(1)} KiB HTML/JS/CSS; no background script or runtime dependencies.`);
