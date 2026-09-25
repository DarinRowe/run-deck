import { fakeServices, processFixture } from './fake-services.mjs';

const themes = {
  dark: { background: '#151a1e', foreground: '#e4e8ea', 'foreground-muted': '#98a4ac', 'surface-solid': '#1c2329', surface: '#ffffff08', border: '#ffffff18', hover: '#26333b', accent: '#a5dccb', 'accent-foreground': '#11241d', 'accent-soft': '#a5dccb14', 'diff-add': '#a5dccb', 'diff-remove': '#d59390', 'diff-hunk': '#7ca2cc' },
  light: { background: '#fafbfc', foreground: '#263237', 'foreground-muted': '#65767c', 'surface-solid': '#ffffff', surface: '#00000004', border: '#24384021', hover: '#eff4f4', accent: '#236f5a', 'accent-foreground': '#ffffff', 'accent-soft': '#236f5a0f', 'diff-add': '#236f5a', 'diff-remove': '#a5423f', 'diff-hunk': '#395d8c' },
};
function theme(name) { for (const [key, value] of Object.entries(themes[name])) document.documentElement.style.setProperty('--muxy-' + key, value); }
window.setPreviewTheme = theme;
theme(new URLSearchParams(location.search).get('theme') || 'dark');
const previewToken = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const api = fakeServices([
  processFixture({ pid:4100, name:'sh', executable:'/bin/sh', ports:[], runToken:previewToken, cpuPercent:0, rssKiB:1500 }),
  processFixture({ ppid:4100, cwd: '/Users/example/Projects/storefront', cpuPercent: 2.4, rssKiB: 480000 }),
  processFixture({ pid:4103, ppid:4102, name:'node', ports:[], cpuPercent:8.5, rssKiB:270000 }),
  processFixture({ pid: 4197, name: 'bun', cpuPercent: 38.2, rssKiB: 248000, elapsed: '02-03:04:05', executable: '/opt/homebrew/bin/bun', cwd: '/Users/example/Projects/storefront/apps/api', ports: [{ port: 8787, hosts: ['127.0.0.1'] }] }),
  processFixture({ pid: 5011, name: 'redis-server', cpuPercent: 0.1, rssKiB: 42000, executable: '/opt/homebrew/bin/redis-server', cwd: '/opt/homebrew/var', ports: [{ port: 6379, hosts: ['127.0.0.1'] }] }),
  processFixture({ pid: 6000, name: 'Muxy', cpuPercent: 4.1, rssKiB: 320000, executable: '/Applications/Muxy.app/Contents/MacOS/Muxy', cwd: '/', ports: [{ port: 4865, hosts: ['*'] }] }),
]);
api.dialog = { confirm: async options => { api.calls.push(['confirm', options]); return window.previewChoice ?? null; }, alert: async () => {} };
api.browser = { open: async url => { api.calls.push(['browser', url]); } };
api.modal = { open: async ({ items }) => items[0] };
api.onFocus = callback => { api.focusChanged = callback; return () => { api.focusChanged = null; }; };
api.projects.list = async () => [{ id: 'project-1', name: 'Acme storefront', path: '/Users/example/Projects/storefront', isActive: true }];
api.worktrees.list = async () => [{ id: 'tree-1', name: 'main', branch: 'feature/checkout', path: '/Users/example/Projects/storefront', isActive: true }];
const samples = [
  { id: 'web', name: 'Storefront', command: 'pnpm run dev', directory: 'apps/storefront', port: 3000, kind: 'service', run: { state: 'linked', token: previewToken, tabId: 'preview-web', paneId: 'preview-pane-web' } },
  { id: 'api', name: 'API server', command: 'pnpm run dev:api', directory: '.', port: 8787, kind: 'service', run: null },
  { id: 'test', name: 'Unit tests', command: 'pnpm run test:unit', directory: '.', port: null, kind: 'task', run: null },
];
for (const [i, sample] of samples.entries()) await api.storage.set('v1/project-1/tree-1/' + sample.id, { version: 1, createdAt: i + 1, ...sample });
api.setTabs([{ id: 'preview-web', kind: 'terminal', title: 'Storefront', isActive: false }]);
// Real repository scripts with a fake host: preview Start without running a shell.
if (new URLSearchParams(location.search).get('project') === 'run-deck') {
  const content = await (await fetch('../package.json')).text();
  api.processes = []; api.setTabs([]); api.stored.clear();
  api.projects.list = async () => [{ id: 'project-1', name: 'Run Deck', isActive: true }];
  api.worktrees.list = async () => [{ id: 'tree-1', branch: 'main', path: '/Users/example/Projects/run-deck', isActive: true }];
  api.files.list = async () => [{ name: 'package.json' }, { name: 'package-lock.json' }];
  api.files.stat = async () => ({ size: content.length });
  api.files.read = async () => ({ content });
}
window.muxy = api;
window.previewApi = api;
const realNow = Date.now;
window.previewTimeOffset = 0;
Date.now = () => realNow() + window.previewTimeOffset;
const openTab = api.tabs.open;
let nextPID = 9000;
api.tabs.open = async request => {
  const id = await openTab(request);
  const token = request.command.match(/run-deck:([a-f0-9-]+)$/)?.[1];
  if (token) {
    const root = nextPID++;
    api.processes.push(processFixture({pid:root, name:'sh', executable:'/bin/sh', ports:[],runToken:token,cpuPercent:0,rssKiB:1000}),
      processFixture({pid:nextPID++,ppid:root,cwd:'/Users/example/Projects/storefront',ports:[{port:3000,hosts:['127.0.0.1']}]}));
  }
  return id;
};
window.previewErrors = [];
window.addEventListener('error', event => window.previewErrors.push(event.message));
window.addEventListener('unhandledrejection', event => window.previewErrors.push(String(event.reason)));
if (new URLSearchParams(location.search).get('empty') === '1') api.processes = [];
if (new URLSearchParams(location.search).get('error') === '1') api.exec = async () => { throw new Error('User denied consent for service inspection.'); };
if (new URLSearchParams(location.search).get('build') === '1') {
  const entry = new URL('../dist/panel/index.html', import.meta.url);
  const html = new DOMParser().parseFromString(await (await fetch(entry)).text(), 'text/html');
  for (const source of html.querySelectorAll('link[rel=stylesheet]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet';
    link.href = new URL(source.getAttribute('href'), entry).href; document.head.append(link);
  }
  await import(/* @vite-ignore */ new URL(html.querySelector('script[type=module][src*="/assets/"]').getAttribute('src'), entry).href);
} else await import('../src/main.js');

if (new URLSearchParams(location.search).has('postLaunchCheck')) await import('./post-launch-refresh.mjs');

if (new URLSearchParams(location.search).has("cardStability")) await import("./card-stability.mjs");
if (new URLSearchParams(location.search).has('localeLayout')) await import('./locale-layout.mjs');
