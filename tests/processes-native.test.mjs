import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCAN_SCRIPT, parseSnapshot, stopTreeScript, launchCommand } from '../src/processes.js';

const exec = promisify(execFile);

test('native macOS: parent shutdown may reap a worker after its identity recheck', { skip: process.platform !== 'darwin', timeout: 15000 }, async () => {
  const { groupServices } = await import('../src/processes.js');
  const { quoteShell } = await import('../src/model.js');
  const token = crypto.randomUUID();
  const script = `const net=require('node:net'); const {spawn}=require('node:child_process');
    const worker=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    const server=net.createServer();
    process.on('SIGTERM',()=>{
      worker.kill('SIGTERM');
      // Keep the exited worker unreaped through the next ps identity check.
      const until=Date.now()+300; while(Date.now()<until){}
      server.close();
    });
    server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({pid:process.pid,worker:worker.pid,port:server.address().port})));`;
  const child = spawn('/bin/sh', ['-c', launchCommand(`${quoteShell(process.execPath)} -e ${quoteShell(script)}`, token)], { stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  let info;
  try {
    info = await new Promise((resolve, reject) => {
      let output = '';
      child.stdout.on('data', chunk => {
        output += chunk;
        if (output.includes('\n')) { try { resolve(JSON.parse(output.trim())); } catch (error) { reject(error); } }
      });
      child.once('error', reject);
      child.once('exit', code => { if (!output) reject(new Error(`Launch exited ${code}`)); });
    });
    const snapshot = parseSnapshot((await shell(SCAN_SCRIPT)).stdout);
    const service = groupServices(snapshot, [{ id: 'parent-cleanup', run: { state: 'linked', token } }])
      .find(item => item.source?.entryId === 'parent-cleanup');
    assert(service?.members.some(member => member.pid === info.worker));
    const result = await shell(stopTreeScript(service, snapshot));
    assert.equal(result.exitCode, 0, `Exited worker must not be treated as a replacement: ${result.stderr}`);
    assert(!parseSnapshot(result.stdout).processes.some(item => service.members.some(old => old.id === item.id)));
    await exited;
  } finally {
    for (const pid of [info?.worker, info?.pid, child.pid].filter(Boolean)) {
      try { process.kill(pid, 'SIGTERM'); } catch {}
    }
    await exited;
  }
});

for (const launcher of ['/bin/sh', '/bin/dash']) test(`tagged launches preserve interactive stdin with ${launcher}`, { timeout: 5000, skip: !existsSync(launcher) }, async () => {
  const command = launchCommand('read reply; printf "received:%s" "$reply"', '99999999-9999-4999-8999-999999999999');
  const child = spawn('/bin/sh', ['-c', command.replace(/^\/bin\/sh /, `${launcher} `)]);
  const exited = once(child, 'exit');
  child.stdin.end('interactive input\n');
  let output = '';
  for await (const chunk of child.stdout) output += chunk;
  assert.equal((await exited)[0], 0);
  assert.equal(output, 'received:interactive input');
});

async function shell(script) {
  try { return { ...(await exec('/bin/sh', ['-c', script], { timeout: 7000, maxBuffer: 2 * 1024 * 1024 })), exitCode: 0 }; }
  catch (error) { if (typeof error.code !== 'number') throw error; return { stdout: error.stdout, stderr: error.stderr, exitCode: error.code }; }
}

test('native macOS: discover a real multiport server, reject stale identities, then stop only that server', { skip: process.platform !== 'darwin', timeout: 20000 }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'run-deck-test-'));
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import net from 'node:net';
    const a = net.createServer(); const b = net.createServer();
    await Promise.all([a, b].map(server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))));
    process.send({ ports: [a.address().port, b.address().port] });
  `], { cwd, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const exited = once(child, 'exit');
  try {
    const [message] = await once(child, 'message');
    const inspected = await shell(SCAN_SCRIPT);
    assert.equal(inspected.exitCode, 0);
    const snapshot = parseSnapshot(inspected.stdout);
    const service = snapshot.services.find(item => item.pid === child.pid);
    assert(service?.verified, 'The disposable server should have a verified process identity.');
    assert(Number.isFinite(service.cpuPercent) && service.cpuPercent >= 0);
    assert(Number.isSafeInteger(service.memoryBytes) && service.memoryBytes > 0);
    assert(Number.isSafeInteger(service.uptimeSeconds) && service.uptimeSeconds >= 0);
    assert.deepEqual(service.ports.map(item => item.port).sort((a,b) => a-b), message.ports.sort((a,b) => a-b));
    assert(service.cwd.endsWith(cwd.split('/').at(-1)));
    for (const [target, host, expectedCode] of [
      [service, { ...snapshot, hostId: '00000000-0000-0000-0000-000000000000' }, 71],
      [{ ...service, started: 'Thu Sep 24 00:00:00 1900' }, snapshot, 72],
      [{ ...service, ports: [{ port: 1, hosts: ['127.0.0.1'] }] }, snapshot, 72],
      [{ ...service, executable: service.executable + "'; exit 0; #" }, snapshot, 72],
    ]) {
      const rejected = await shell(stopTreeScript(target, host));
      assert.equal(rejected.exitCode, expectedCode);
      process.kill(child.pid, 0);
    }
    const stopped = await shell(stopTreeScript(service, snapshot));
    assert.equal(stopped.exitCode, 0, stopped.stderr);
    assert(!parseSnapshot(stopped.stdout).services.some(item => item.pid === child.pid));
    const [, signal] = await exited;
    assert.equal(signal, 'SIGTERM');
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await exited; }
    await rm(cwd, { recursive: true, force: true });
  }
});

test('native macOS: tagged launch, worker aggregation, guarded tree stop, restart, and occupied-port refusal', { skip: process.platform !== 'darwin', timeout: 30000 }, async () => {
  const { launchCommand, groupServices } = await import('../src/processes.js');
  const { quoteShell } = await import('../src/model.js');
  const cwd = await mkdtemp(join(tmpdir(), 'run-deck-tree-'));
  const children = [];
  const script = `const net=require('node:net'); const {spawn}=require('node:child_process');
    const worker=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    const server=net.createServer(); server.listen(Number(process.argv[1]||0),'127.0.0.1',()=>console.log(JSON.stringify({pid:process.pid,worker:worker.pid,port:server.address().port})));`;
  const command = port => `${quoteShell(process.execPath)} -e ${quoteShell(script)} ${port || 0}`;
  const start = (token, port, guard) => {
    const child = spawn('/bin/sh', ['-c', launchCommand(command(port), token, guard)], {cwd, stdio:['ignore','pipe','pipe']});
    children.push(child);
    const exited = once(child, 'exit');
    return {child, exited, ready: new Promise((resolve,reject) => {
      let output=''; child.stdout.on('data', chunk => { output+=chunk; if (output.includes('\n')) { try { resolve(JSON.parse(output.trim())); } catch(error) {reject(error);} } });
      child.once('error',reject); child.once('exit', code => { if (!output) reject(new Error(`Launch exited ${code}`)); });
    })};
  };
  let owned = [];
  try {
    const token = '33333333-3333-4333-8333-333333333333';
    const first = start(token);
    const info = await first.ready; owned.push(info.pid, info.worker);
    const initial = parseSnapshot((await shell(SCAN_SCRIPT)).stdout);
    const entry = {id:'native',name:'Native',run:{state:'linked',token,tabId:'native-tab'}};
    const group = groupServices(initial,[entry]).find(p => p.source.entryId === 'native');
    assert(group, 'The exact tagged launch should be found.');
    assert(group.members.some(p => p.pid === info.worker));
    assert(group.memoryBytes > 0 && group.members.length >= 3);
    const mismatched = await shell(stopTreeScript({...group,members:group.members.filter(p => p.pid !== info.worker)},initial));
    assert.equal(mismatched.exitCode,72); process.kill(info.pid,0);
    const stopped = await shell(stopTreeScript(group,initial)); assert.equal(stopped.exitCode,0,stopped.stderr);
    await first.exited;
    assert(!parseSnapshot(stopped.stdout).services.some(p => p.ports.some(e => e.port === info.port)));
    const guard = {hostId:initial.hostId,uid:initial.uid,members:group.members,ports:group.ports};
    const nextToken = '44444444-4444-4444-8444-444444444444';
    const next = start(nextToken,info.port,guard); const nextInfo=await next.ready; owned.push(nextInfo.pid,nextInfo.worker);
    assert.notEqual(nextInfo.pid,info.pid);
    const rejected = await shell(launchCommand('echo MUST_NOT_RUN', '55555555-5555-4555-8555-555555555555',guard));
    assert.equal(rejected.exitCode,74); assert(!rejected.stdout.includes('MUST_NOT_RUN'));
    const updated=parseSnapshot((await shell(SCAN_SCRIPT)).stdout);
    const nextGroup=groupServices(updated,[{...entry,run:{...entry.run,token:nextToken}}]).find(p=>p.source.entryId==='native');
    assert.equal((await shell(stopTreeScript(nextGroup,updated))).exitCode,0);
    await next.exited;
  } finally {
    for (const pid of owned.reverse()) { try { process.kill(pid,'SIGTERM'); } catch {} }
    for (const child of children) if (child.exitCode===null && child.signalCode===null) child.kill('SIGTERM');
    await rm(cwd,{recursive:true,force:true});
  }
});
