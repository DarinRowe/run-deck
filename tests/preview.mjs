import { fakeMuxy } from './fake-muxy.mjs';

const themes = {
  dark: { background: '#151a1e', foreground: '#e4e8ea', 'foreground-muted': '#98a4ac', 'surface-solid': '#1c2329', surface: '#ffffff08', border: '#ffffff18', hover: '#26333b', accent: '#a5dccb', 'accent-foreground': '#11241d', 'accent-soft': '#a5dccb14', 'diff-add': '#a5dccb', 'diff-remove': '#d59390', 'diff-hunk': '#7ca2cc' },
  light: { background: '#fafbfc', foreground: '#263237', 'foreground-muted': '#65767c', 'surface-solid': '#ffffff', surface: '#00000004', border: '#24384021', hover: '#eff4f4', accent: '#236f5a', 'accent-foreground': '#ffffff', 'accent-soft': '#236f5a0f', 'diff-add': '#236f5a', 'diff-remove': '#a5423f', 'diff-hunk': '#395d8c' },
};
function theme(name) { for (const [key, value] of Object.entries(themes[name])) document.documentElement.style.setProperty('--muxy-' + key, value); }
window.setPreviewTheme = theme;
theme(new URLSearchParams(location.search).get('theme') || 'dark');
const api = fakeMuxy();
api.dialog = { confirm: async () => window.previewChoice ?? null, alert: async () => {} };
api.browser = { open: async url => { api.calls.push(['browser', url]); } };
api.modal = { open: async ({ items }) => items[0] };
api.onFocus = () => () => {};
api.projects.list = async () => [{ id: 'project-1', name: 'Acme storefront', path: '/Users/example/Projects/storefront', isActive: true }];
api.worktrees.list = async () => [{ id: 'tree-1', name: 'main', branch: 'feature/checkout', path: '/Users/example/Projects/storefront', isActive: true }];
api.exec = async (...args) => {
  api.calls.push(['exec', ...args]);
  return { exitCode: 0, stdout: 'p4102\ncnode\nn127.0.0.1:3000\np4197\ncnode\nn127.0.0.1:8787\n', stderr: '', timedOut: false, truncated: false };
};
const samples = [
  { id: 'web', name: 'Storefront', command: 'pnpm run dev', directory: 'apps/storefront', port: 3000, kind: 'service', run: { state: 'linked', tabId: 'preview-web', paneId: 'preview-pane-web' } },
  { id: 'api', name: 'API server', command: 'pnpm run dev:api', directory: '.', port: 8787, kind: 'service', run: null },
  { id: 'test', name: 'Unit tests', command: 'pnpm run test:unit', directory: '.', port: null, kind: 'task', run: null },
];
for (const [i, sample] of samples.entries()) await api.storage.set('v1/project-1/tree-1/' + sample.id, { version: 1, createdAt: i + 1, ...sample });
api.setTabs([{ id: 'preview-web', kind: 'terminal', title: 'Storefront', isActive: false }]);
window.muxy = api;
window.previewApi = api;
window.previewErrors = [];
window.addEventListener('error', event => window.previewErrors.push(event.message));
window.addEventListener('unhandledrejection', event => window.previewErrors.push(String(event.reason)));
await import('../src/main.js');
