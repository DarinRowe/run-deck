export function fakeMuxy(seed = {}) {
  const stored = new Map(Object.entries(seed));
  const listeners = new Map();
  const calls = [];
  let project = { id: 'project-1', name: 'Acme', path: '/Users/example/acme', isActive: true };
  let tree = { id: 'tree-1', name: 'main', branch: 'main', path: project.path, isActive: true };
  let tabs = [];
  let panes = [];
  const api = {
    projects: { list: async () => [{ ...project }] },
    worktrees: { list: async () => [{ ...tree }] },
    storage: {
      keys: async () => [...stored.keys()],
      get: async key => structuredClone(stored.get(key) ?? null),
      set: async (key, value) => { calls.push(['set', key]); stored.set(key, structuredClone(value)); },
      delete: async key => stored.delete(key),
    },
    tabs: {
      list: async () => structuredClone(tabs),
      open: async request => {
        calls.push(['open', request]);
        const id = `tab-${tabs.length + 1}`;
        const paneID = `pane-${tabs.length + 1}`;
        tabs.push({ id, kind: 'terminal', title: request.command, isActive: true });
        panes.push({ id: paneID });
        api.emit('tab.created', { tabID: id, paneID, kind: 'terminal', projectID: project.id, worktreeID: tree.id });
        return id;
      },
      switchTo: async id => calls.push(['focus', id]),
    },
    panes: { list: async () => structuredClone(panes), sendKeys: async (...args) => calls.push(['sendKeys', ...args]) },
    events: { subscribe: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); return () => listeners.get(name).delete(fn); } },
    exec: async (...args) => { calls.push(['exec', ...args]); return { stdout: 'p12\ncnode\nn127.0.0.1:3000\n', stderr: '', exitCode: 0, timedOut: false, truncated: false }; },
    files: {
      list: async () => [{ name: 'package.json' }, { name: 'pnpm-lock.yaml' }],
      stat: async () => ({ size: 100 }),
      read: async () => ({ content: '{"scripts":{"dev":"vite","test":"node --test"}}' }),
    },
    emit: (name, payload) => { for (const fn of listeners.get(name) || []) fn(payload); },
    switchContext: (id = 'tree-2') => { tree = { ...tree, id, path: '/Users/example/other' }; api.emit('worktree.switched', {}); },
    setTabs: value => { tabs = value; },
    stored, calls,
  };
  return api;
}
