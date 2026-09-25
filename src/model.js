export const MAX_COMMANDS = 100;
export const MAX_PORT_ROWS = 200;

export function validateEntry(input) {
  const name = String(input.name ?? '').trim();
  const command = String(input.command ?? '').trim();
  let directory = String(input.directory ?? '.').trim() || '.';
  const port = input.port === '' || input.port == null ? null : Number(input.port);
  if (!name || name.length > 80) throw new Error('Name must contain 1–80 characters.');
  if (!command || command.length > 4096 || /[\x00-\x08\x0b-\x1f\x7f]/.test(command)) {
    throw new Error('Enter a command of 1–4096 characters without control characters.');
  }
  if (directory.length > 1024 || directory.startsWith('/') || directory.startsWith('~') || /[\x00-\x1f\x7f]/.test(directory) || directory.split('/').includes('..')) {
    throw new Error('Use a directory inside the current worktree, such as . or packages/web.');
  }
  directory = directory.replace(/\/+$/, '') || '.';
  if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    throw new Error('Port must be between 1 and 65535.');
  }
  return { name, command, directory, port, kind: input.kind === 'task' ? 'task' : 'service' };
}

export function decodeRecord(value, id) {
  if (!value || value.version !== 1 || value.id !== id) throw new Error('Saved command is invalid.');
  const entry = validateEntry(value);
  const run = value.run;
  if (run != null && (typeof run !== 'object' || !['opening', 'linked', 'unknown'].includes(run.state)
    || (run.tabId != null && typeof run.tabId !== 'string')
    || (run.paneId != null && typeof run.paneId !== 'string'))) throw new Error('Saved terminal association is invalid.');
  return { version: 1, id, ...entry, createdAt: Number(value.createdAt) || 0, run: run ? { ...run } : null };
}

export function scopeKey(context) {
  return `v1/${context.projectId}/${context.worktreeId}/`;
}

export function contextFrom(projects, worktrees) {
  const project = projects.find(p => p.isActive);
  if (!project) throw new Error('Open a project in Muxy first.');
  const tree = worktrees.find(w => w.isActive);
  if (!tree?.id || !tree.path) throw new Error('No active worktree. Open a terminal in this project first.');
  return { projectId: project.id, worktreeId: tree.id, name: project.name, path: tree.path, branch: tree.branch || tree.name };
}

export function sameContext(a, b) {
  return !!a && !!b && a.projectId === b.projectId && a.worktreeId === b.worktreeId && a.path === b.path;
}

export function terminalState(entry, tabs) {
  if (!entry.run) return 'ready';
  if (entry.run.state !== 'linked' || !entry.run.tabId) return 'unknown';
  return tabs.some(t => t.id === entry.run.tabId && t.kind === 'terminal') ? 'open' : 'missing';
}

export function parseListeners(text) {
  const rows = new Map();
  let pid = null;
  let name = '';
  for (const line of text.split('\n')) {
    const value = line.slice(1);
    if (line[0] === 'p') { pid = /^\d+$/.test(value) ? Number(value) : null; name = ''; }
    if (line[0] === 'c') name = value.slice(0, 120);
    if (line[0] !== 'n' || !pid) continue;
    const match = value.match(/^(.*):(\d+)$/);
    if (!match) continue;
    const port = Number(match[2]);
    if (port < 1 || port > 65535) continue;
    const key = `${pid}:${port}`;
    if (!rows.has(key) && rows.size < MAX_PORT_ROWS) rows.set(key, { pid, name, port, hosts: [] });
    const row = rows.get(key);
    if (row && !row.hosts.includes(match[1])) row.hosts.push(match[1]);
  }
  return [...rows.values()].sort((a, b) => a.port - b.port || a.pid - b.pid);
}

export function quoteShell(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function detectScripts(content, filenames = []) {
  const pkg = JSON.parse(content);
  if (!pkg || typeof pkg.scripts !== 'object' || !pkg.scripts || Array.isArray(pkg.scripts)) return [];
  const manager = filenames.includes('pnpm-lock.yaml') ? 'pnpm'
    : filenames.some(n => n === 'bun.lock' || n === 'bun.lockb') ? 'bun'
      : filenames.includes('yarn.lock') ? 'yarn' : 'npm';
  return Object.entries(pkg.scripts)
    .filter(([name, value]) => /^[a-zA-Z0-9_][a-zA-Z0-9_:.\/-]*$/.test(name) && typeof value === 'string')
    .slice(0, MAX_COMMANDS)
    .map(([name, script]) => ({ name, command: `${manager} run ${quoteShell(name)}`, directory: '.', port: null,
      kind: /^(dev|start|serve)(:|$)/.test(name) ? 'service' : 'task', detail: script.slice(0, 240) }));
}
