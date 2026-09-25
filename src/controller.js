import { MAX_COMMANDS, validateEntry, decodeRecord, scopeKey, contextFrom, sameContext, terminalState, parseListeners, detectScripts } from './model.js';

export class Launchpad {
  constructor(api, changed = () => {}) {
    this.api = api;
    this.changed = changed;
    this.context = null;
    this.entries = [];
    this.tabs = [];
    this.ports = null;
    this.portsAt = null;
    this.busy = new Set();
    this.events = new Map();
    this.unsubscribers = [];
    this.disposed = false;
    this.epoch = 0;
    this.refreshJob = null;
    this.refreshAgain = false;
    this.error = '';
    this.storageError = '';
  }

  async currentContext() {
    const projects = await this.api.projects.list();
    const active = projects.find(p => p.isActive);
    if (!active) throw new Error('Open a project in Muxy first.');
    const worktrees = await this.api.worktrees.list(active.id);
    return contextFrom(projects, worktrees);
  }

  async assertContext(expected = this.context) {
    if (this.disposed || !sameContext(expected, await this.currentContext())) {
      throw new Error('Workspace changed. Refresh Run Deck and try again.');
    }
  }

  subscribe() {
    for (const name of ['tab.created', 'tab.updated', 'pane.created', 'tab.closed', 'pane.closed', 'project.switched', 'worktree.switched']) {
      this.unsubscribers.push(this.api.events.subscribe(name, event => {
        if (this.disposed) return;
        if (event.tabID && event.paneID && event.kind === 'terminal') {
          this.events.set(event.tabID, { ...event });
          if (this.events.size > 256) this.events.delete(this.events.keys().next().value);
        }
        if (name === 'project.switched' || name === 'worktree.switched') {
          this.epoch++;
          this.ports = null;
          this.portsAt = null;
        }
        this.refresh().catch(error => this.report(error));
      }));
    }
  }

  report(error) {
    if (this.disposed) return;
    this.error = error.message || String(error);
    this.changed();
  }

  refresh() {
    if (this.disposed) return Promise.resolve();
    if (this.refreshJob) { this.refreshAgain = true; return this.refreshJob; }
    this.refreshJob = this.readState().finally(() => {
      this.refreshJob = null;
      if (this.refreshAgain && !this.disposed) {
        this.refreshAgain = false;
        this.refresh().catch(error => this.report(error));
      }
    });
    return this.refreshJob;
  }

  async readState() {
    const epoch = this.epoch;
    const context = await this.currentContext();
    const prefix = scopeKey(context);
    const keys = (await this.api.storage.keys()).filter(key => key.startsWith(prefix));
    if (keys.length > MAX_COMMANDS) throw new Error(`This worktree exceeds the ${MAX_COMMANDS} command limit.`);
    const [records, tabs] = await Promise.all([
      Promise.all(keys.map(async key => decodeRecord(await this.api.storage.get(key), key.slice(prefix.length)))),
      this.api.tabs.list(),
    ]);
    if (this.disposed || epoch !== this.epoch) { this.refreshAgain = true; return; }
    if (!sameContext(context, await this.currentContext())) { this.refreshAgain = true; return; }
    if (!sameContext(this.context, context)) { this.ports = null; this.portsAt = null; }
    this.context = context;
    this.tabs = tabs;
    this.entries = records.sort((a, b) => a.createdAt - b.createdAt);
    this.storageError = '';
    this.error = '';
    this.changed();
  }

  async exclusive(key, action) {
    if (this.busy.has(key)) return;
    this.busy.add(key);
    this.error = '';
    this.changed();
    try { return await action(); }
    catch (error) { this.report(error); throw error; }
    finally { this.busy.delete(key); if (!this.disposed) this.changed(); }
  }

  async persist(context, entry) {
    this.epoch++;
    await this.api.storage.set(scopeKey(context) + entry.id, entry);
    if (!this.disposed && sameContext(this.context, context)) {
      const index = this.entries.findIndex(item => item.id === entry.id);
      if (index < 0) this.entries.push(entry);
      else this.entries[index] = entry;
      this.changed();
    }
  }

  async save(input, id = null, expected = this.context) {
    return this.exclusive(id || 'new', async () => {
      await this.assertContext(expected);
      if (this.storageError) throw new Error(this.storageError);
      const fields = validateEntry(input);
      const key = id || crypto.randomUUID();
      const stored = id ? await this.api.storage.get(scopeKey(expected) + id) : null;
      if (id && !stored) throw new Error('This command was removed. Refresh first.');
      if (!id && (await this.api.storage.keys()).filter(k => k.startsWith(scopeKey(expected))).length >= MAX_COMMANDS) {
        throw new Error(`At most ${MAX_COMMANDS} commands per worktree.`);
      }
      const old = stored ? decodeRecord(stored, id) : null;
      if (old?.run && (old.command !== fields.command || old.directory !== fields.directory)) {
        throw new Error('Forget the terminal association before changing its command or directory.');
      }
      const entry = { version: 1, id: key, ...fields, createdAt: old?.createdAt || Date.now(), run: old?.run || null };
      await this.persist(expected, entry);
      return entry;
    });
  }

  async launch(id) {
    return this.exclusive(id, async () => {
      const context = this.context;
      await this.assertContext(context);
      const entry = decodeRecord(await this.api.storage.get(scopeKey(context) + id), id);
      if (entry.run) throw new Error('This command already has a terminal association. Review or forget it first.');
      const staged = { ...entry, run: { state: 'opening', tabId: null, paneId: null, requestedAt: Date.now() } };
      await this.persist(context, staged);
      let opened = false;
      try {
        await this.assertContext(context);
        const tabId = await this.api.tabs.open({ kind: 'terminal', directory: entry.directory, command: entry.command });
        if (typeof tabId !== 'string' || !tabId) throw new Error('Muxy did not return a terminal ID. Review the terminal before retrying.');
        opened = true;
        const event = this.events.get(tabId);
        const paneId = event?.projectID === context.projectId && event?.worktreeID === context.worktreeId ? event.paneID : null;
        const linked = { ...staged, run: { ...staged.run, state: 'linked', tabId, paneId } };
        await this.persist(context, linked);
        await this.refresh();
      } catch (error) {
        try { await this.persist(context, { ...staged, run: { ...staged.run, state: 'unknown' } }); } catch {}
        throw new Error(`${error.message} ${opened ? 'A terminal was opened. ' : ''}Check Muxy before starting another instance.`);
      }
    });
  }

  async terminal(id) {
    const entry = this.entries.find(item => item.id === id);
    await this.assertContext();
    const tabs = await this.api.tabs.list();
    if (!entry || terminalState(entry, tabs) !== 'open') throw new Error('The linked terminal is no longer visible. Check Muxy background sessions.');
    await this.api.tabs.switchTo(entry.run.tabId);
  }

  async interrupt(id, confirm) {
    return this.exclusive(id, async () => {
      const context = this.context;
      await this.assertContext(context);
      const entry = this.entries.find(item => item.id === id);
      if (!entry?.run?.tabId) throw new Error('No verified terminal association.');
      const event = this.events.get(entry.run.tabId);
      const paneId = event?.projectID === context.projectId && event?.worktreeID === context.worktreeId ? event.paneID : entry.run.paneId;
      if (!paneId) throw new Error('The pane ID is unavailable. Open the terminal and press Ctrl+C there.');
      if (!await confirm(entry)) return;
      await this.assertContext(context);
      const [tabs, panes] = await Promise.all([this.api.tabs.list(), this.api.panes.list()]);
      if (terminalState(entry, tabs) !== 'open' || !panes.some(p => p.id === paneId)) throw new Error('The terminal changed. Nothing was interrupted.');
      await this.api.panes.sendKeys(paneId, 'ctrl+c');
    });
  }

  async forget(id, confirm) {
    return this.exclusive(id, async () => {
      const context = this.context;
      const entry = this.entries.find(item => item.id === id);
      if (!entry || !await confirm(entry)) return;
      await this.assertContext(context);
      await this.persist(context, { ...entry, run: null });
    });
  }

  async remove(id, confirm) {
    return this.exclusive(id, async () => {
      const context = this.context;
      const entry = this.entries.find(item => item.id === id);
      if (!entry || !await confirm(entry)) return;
      await this.assertContext(context);
      this.epoch++;
      await this.api.storage.delete(scopeKey(context) + id);
      this.entries = this.entries.filter(item => item.id !== id);
      this.changed();
    });
  }

  async scanPorts() {
    return this.exclusive('ports', async () => {
      const context = this.context;
      await this.assertContext(context);
      const result = await this.api.exec(['/usr/sbin/lsof', '-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'], { timeoutMs: 5000, cwd: context.path });
      await this.assertContext(context);
      if (result.timedOut || result.truncated || (result.exitCode !== 0 && !(result.exitCode === 1 && !result.stdout.trim() && !result.stderr.trim()))) {
        throw new Error(result.timedOut ? 'Port inspection timed out. Retry when needed.' : 'Port inspection failed or was incomplete. Check lsof availability and permissions.');
      }
      this.ports = parseListeners(result.stdout);
      this.portsAt = new Date();
      this.changed();
    });
  }

  async discover() {
    return this.exclusive('discover', async () => {
      const context = this.context;
      await this.assertContext(context);
      const entries = await this.api.files.list('', { project: context.projectId });
      if (!entries.some(file => file.name === 'package.json')) throw new Error('No package.json in this worktree. Add a command manually.');
      const metadata = await this.api.files.stat('package.json', { project: context.projectId });
      if (metadata.size > 256 * 1024) throw new Error('package.json exceeds the 256 KiB inspection limit.');
      const file = await this.api.files.read('package.json', { project: context.projectId });
      await this.assertContext(context);
      return detectScripts(file.content, entries.map(file => file.name));
    });
  }

  dispose() {
    this.disposed = true;
    this.epoch++;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.events.clear();
  }
}
