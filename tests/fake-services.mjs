import { fakeMuxy } from './fake-muxy.mjs';
import { SCAN_SCRIPT } from '../src/processes.js';

export const HOST_ID = 'A5E953C9-0270-47CD-BD1B-69E7390B624E';
export const STARTED = 'Thu Sep 24 18:00:00 2026';
export function processFixture(input = {}) {
  return { pid: 4102, ppid: 1, uid: 501, name: 'node', executable: '/opt/homebrew/bin/node', started: STARTED,
    cpuPercent: 3.6, rssKiB: 180000, elapsed: '01:23:45',
    cwd: '/Users/example/acme', ports: [{ port: 3000, hosts: ['127.0.0.1'] }], ...input };
}
export function snapshotOutput(processes = [processFixture()], { hostId = HOST_ID, hostname = 'dev-mac.local', uid = 501 } = {}) {
  let listeners = '';
  let ps = '';
  let markers = '';
  let cwd = '';
  for (const p of processes) {
    if (p.ports.length) listeners += `p${p.pid}\0c${p.name}\0u${p.uid}\0\n`;
    for (const endpoint of p.ports) for (const host of endpoint.hosts) listeners += `f10\0n${host}:${endpoint.port}\0\n`;
    if (p.started && p.executable) ps += ` ${p.pid} ${p.ppid} ${p.uid} ${p.cpuPercent ?? '-'} ${p.rssKiB ?? '-'} ${p.elapsed ?? '-'} ${p.started}     ${p.executable}\n`;
    if (p.runToken) markers += `${p.pid} ${p.runToken}\n`;
    if (p.cwd) cwd += `p${p.pid}\0fcwd\0n${p.cwd}\0\n`;
  }
  return `RUN_DECK_4\n${hostId}\n${uid}\n${hostname}\n${listeners}\0RUN_DECK_PS\0${ps}\0RUN_DECK_CWD\0${cwd}\0RUN_DECK_MARKERS\0${markers}\0RUN_DECK_END\0`;
}
export function fakeServices(processes = [processFixture()]) {
  const api = fakeMuxy();
  api.processes = structuredClone(processes);
  api.inspectOptions = {};
  api.exec = async request => {
    api.calls.push(['exec', request]);
    if (request.shell !== SCAN_SCRIPT) {
      const pids = [...request.shell.matchAll(/\/bin\/kill -TERM (\d+)/g)].map(match => Number(match[1]));
      api.processes = api.processes.filter(p => !pids.includes(p.pid));
    }
    return { stdout: snapshotOutput(api.processes, api.inspectOptions), stderr: '', exitCode: 0, timedOut: false, truncated: false };
  };
  api.browser = { open: async url => api.calls.push(['browser', url]) };
  return api;
}
