import './style.css';
import { Launchpad } from './controller.js';
import { terminalState } from './model.js';
import { dictionaries } from './i18n.js';

const root = document.querySelector('#app');
let language = navigator.language.startsWith('zh') ? 'zh' : 'en';
try { language = localStorage.getItem('run-deck-language') || language; } catch {}
if (!dictionaries[language]) language = 'en';
const t = key => dictionaries[language][key] || key;
let filter = 'all';
let query = '';
let editor = null;
let noticeTimer = null;
let initialized = false;
let renderQueued = false;
const cards = new Map();
const api = window.muxy;
const model = api ? new Launchpad(api, scheduleRender) : null;

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}
function button(label, action, className = '') {
  const el = element('button', className, label);
  el.type = 'button';
  el.addEventListener('click', () => Promise.resolve().then(action).catch(showError));
  return el;
}
function text(el, value) { if (el.textContent !== value) el.textContent = value; }
function icon(type = 'terminal') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', type === 'task' ? 'M8 3h8v3h4v15H4V6h4z M8 3v5h8V3 M8 12h8 M8 16h5' : 'M4 5h16v14H4z M7 9l3 3-3 3 M13 15h4');
  svg.append(path);
  return svg;
}
function showError(error) { if (model) model.report(error); else text(errorBox, error.message); }
function announce(message) {
  text(notice, message);
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
}
async function confirm(title, message, action) {
  return await api.dialog.confirm({ title, message, buttons: [action, t('cancel')], default: t('cancel'), cancel: t('cancel'), style: 'warning' }) === action;
}

const shell = element('div', 'shell');
const header = element('header', 'header');
const brand = element('div', 'brand');
brand.append(icon());
const heading = element('div');
const h1 = element('h1', '', 'Run Deck');
const subtitle = element('p', 'muted');
heading.append(h1, subtitle);
brand.append(heading);
const languageButton = button('', () => {
  language = language === 'en' ? 'zh' : 'en';
  try { localStorage.setItem('run-deck-language', language); } catch {}
  render();
}, 'quiet language');
header.append(brand, languageButton);
const scope = element('section', 'scope');
const scopeTop = element('div', 'scope-top');
const eyebrow = element('span', 'eyebrow');
const branch = element('span', 'branch mono');
scopeTop.append(eyebrow, branch);
const projectName = element('h2');
const projectPath = element('p', 'path mono');
const scopeNote = element('p', 'scope-note muted');
scope.append(scopeTop, projectName, projectPath, scopeNote);
const stats = element('div', 'stats');
const commandStat = element('div');
const commandCount = element('strong', 'mono');
const commandLabel = element('span', 'muted');
commandStat.append(commandCount, commandLabel);
const terminalStat = element('div');
const terminalCount = element('strong', 'mono');
const terminalLabel = element('span', 'muted');
terminalStat.append(terminalCount, terminalLabel);
stats.append(commandStat, terminalStat);
const toolbar = element('div', 'toolbar');
const search = element('input', 'search');
search.type = 'search';
search.addEventListener('input', () => { query = search.value.toLocaleLowerCase(); renderCards(); });
const addButton = button('', () => openEditor(), 'primary');
const importButton = button('', importScripts, 'secondary');
toolbar.append(search, importButton, addButton);
const filters = element('nav', 'filters');
const filterButtons = new Map();
for (const value of ['all', 'services', 'tasks']) {
  const b = button('', () => { filter = value; renderCards(); });
  filterButtons.set(value, b);
  filters.append(b);
}
const refreshButton = button('', () => model.refresh(), 'quiet refresh');
filters.append(refreshButton);
const notice = element('div', 'notice');
notice.setAttribute('role', 'status');
notice.hidden = true;
const errorBox = element('div', 'error');
errorBox.setAttribute('role', 'alert');
errorBox.hidden = true;
const list = element('div', 'command-list');
const empty = element('div', 'empty');
const stateHint = element('p', 'state-hint muted');
const portSection = element('section', 'ports');
const portsHeader = element('div', 'section-header');
const portsHeading = element('div');
const portsTitle = element('h2');
const portsHint = element('p', 'muted');
portsHeading.append(portsTitle, portsHint);
const inspectButton = button('', () => model.scanPorts());
portsHeader.append(portsHeading, inspectButton);
const portRows = element('div', 'port-rows');
const portFootnote = element('p', 'muted small');
portSection.append(portsHeader, portRows, portFootnote);
const footer = element('footer');
const footerText = element('span');
const badge = element('span', 'efficiency');
footer.append(footerText, badge);
shell.append(header, scope, stats, toolbar, filters, notice, errorBox, list, empty, stateHint, portSection, footer);
root.append(shell);

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => { renderQueued = false; render(); });
}
function makeCard(id) {
  const card = element('article', 'command');
  card.dataset.id = id;
  const titleRow = element('div', 'command-heading');
  const glyph = element('span', 'command-icon');
  const name = element('h3');
  const state = element('span', 'state');
  titleRow.append(glyph, name, state);
  const code = element('code', 'command-code');
  const meta = element('div', 'command-meta');
  const directory = element('span', 'mono');
  const port = element('span', 'port-status');
  meta.append(directory, port);
  const actions = element('div', 'actions');
  const launch = button('', () => model.launch(id), 'primary');
  const terminal = button('', () => model.terminal(id));
  const interrupt = button('', async () => {
    let sent = false;
    await model.interrupt(id, async () => { sent = await confirm(t('interruptTitle'), t('interruptText'), t('interrupt')); return sent; });
    if (sent) announce(t('sent'));
  });
  const browser = button('', () => openBrowser(id));
  const edit = button('', () => openEditor(model.entries.find(e => e.id === id)), 'quiet');
  const menu = element('details', 'more');
  const summary = element('summary', '', '···');
  summary.setAttribute('aria-label', 'More actions');
  const menuBody = element('div', 'menu');
  const forget = button('', async () => { menu.open = false; await model.forget(id, () => confirm(t('forgetTitle'), t('forgetText'), t('forgetButton'))); });
  const remove = button('', async () => { menu.open = false; await model.remove(id, () => confirm(t('removeTitle'), t('removeText'), t('remove'))); });
  menuBody.append(forget, remove);
  menu.append(summary, menuBody);
  actions.append(launch, terminal, interrupt, browser, edit, menu);
  card.append(titleRow, code, meta, actions);
  card.parts = { glyph, name, state, code, directory, port, launch, terminal, interrupt, browser, edit, forget, remove, summary };
  return card;
}
function renderCards() {
  for (const [key, b] of filterButtons) {
    text(b, t(key));
    b.setAttribute('aria-pressed', String(filter === key));
  }
  if (!model) return;
  const entries = model.entries.filter(e => (filter === 'all' || e.kind === (filter === 'tasks' ? 'task' : 'service'))
    && `${e.name} ${e.command} ${e.directory}`.toLocaleLowerCase().includes(query));
  const ids = new Set(entries.map(e => e.id));
  for (const [id, card] of cards) if (!ids.has(id)) { card.remove(); cards.delete(id); }
  for (const entry of entries) {
    let card = cards.get(entry.id);
    if (!card) { card = makeCard(entry.id); cards.set(entry.id, card); list.append(card); }
    const p = card.parts;
    const status = terminalState(entry, model.tabs);
    const busy = model.busy.has(entry.id);
    if (card.dataset.kind !== entry.kind) { p.glyph.replaceChildren(icon(entry.kind)); card.dataset.kind = entry.kind; }
    text(p.name, entry.name);
    text(p.state, t(status));
    p.state.dataset.state = status;
    text(p.code, entry.command);
    text(p.directory, entry.directory);
    const listening = model.ports?.some(row => row.port === entry.port);
    text(p.port, entry.port ? `:${entry.port} · ${t(model.ports === null ? 'unverified' : listening ? 'listening' : 'notListening')}` : t(entry.kind));
    p.port.title = t('portNote');
    text(p.launch, busy ? t('busy') : t('run'));
    p.launch.hidden = !!entry.run;
    p.terminal.hidden = status !== 'open';
    p.interrupt.hidden = status !== 'open';
    p.browser.hidden = !entry.port;
    p.forget.hidden = !entry.run;
    for (const key of ['terminal', 'interrupt', 'edit', 'forget', 'remove']) text(p[key], t(key));
    text(p.browser, t('openBrowser'));
    p.summary.setAttribute('aria-label', language === 'zh' ? `${entry.name} 的更多操作` : `More actions for ${entry.name}`);
    for (const b of card.querySelectorAll('button')) b.disabled = busy;
  }
  empty.hidden = entries.length > 0;
  if (!entries.length) {
    empty.replaceChildren(icon());
    empty.append(element('h2', '', t(model.entries.length ? 'emptySearch' : 'empty')), element('p', 'muted', t('emptyText')));
    if (model.context) empty.append(button(t('emptyAction'), () => openEditor(), 'primary'));
  }
}
let lastPorts = null;
let lastPortsLanguage = null;
function renderPorts() {
  if (!model) return;
  if (lastPorts === model.ports && lastPortsLanguage === language) return;
  lastPorts = model.ports;
  lastPortsLanguage = language;
  portRows.replaceChildren();
  if (!model.ports?.length) portRows.append(element('p', 'port-empty muted', t(model.ports === null ? 'noScan' : 'noPorts')));
  else {
    const table = element('table');
    const head = element('thead');
    const row = element('tr');
    for (const key of ['portColumn', 'process', 'pid', 'address']) row.append(element('th', '', t(key)));
    head.append(row);
    const body = element('tbody');
    for (const port of model.ports) {
      const tr = element('tr');
      for (const value of [`:${port.port}`, port.name, String(port.pid), port.hosts.join(', ')]) tr.append(element('td', 'mono', value));
      body.append(tr);
    }
    table.append(head, body);
    portRows.append(table);
  }
  text(portFootnote, model.portsAt ? `${t('checked')} ${model.portsAt.toLocaleTimeString()} · ${t('portNote')} ${t('limit')}` : t('portNote'));
}
function render() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  text(subtitle, t('subtitle'));
  text(languageButton, t('language'));
  text(eyebrow, t('scope'));
  text(projectName, model?.context?.name || t(api ? 'loading' : 'noHost'));
  text(projectPath, model?.context?.path || '—');
  projectPath.title = model?.context?.path || '';
  text(branch, model?.context?.branch || '');
  text(scopeNote, t(api ? 'contextNote' : 'noHostText'));
  text(commandCount, String(model?.entries.length || 0).padStart(2, '0'));
  text(terminalCount, String(model?.entries.filter(e => terminalState(e, model.tabs) === 'open').length || 0).padStart(2, '0'));
  text(commandLabel, t('countLabel'));
  text(terminalLabel, t('terminalLabel'));
  search.placeholder = t('search');
  search.setAttribute('aria-label', t('search'));
  text(addButton, `+ ${t('add')}`);
  text(importButton, t('discover'));
  text(refreshButton, t('refresh'));
  text(stateHint, t('fullNote'));
  text(portsTitle, t('portsTitle'));
  text(portsHint, t('portsHint'));
  text(inspectButton, model?.busy.has('ports') ? t('busy') : t('inspect'));
  text(footerText, t('footer'));
  text(badge, t('noTimers'));
  for (const b of [addButton, importButton, inspectButton]) b.disabled = !model?.context;
  importButton.disabled ||= model?.busy.has('discover');
  inspectButton.disabled ||= model?.busy.has('ports');
  refreshButton.disabled = !api;
  errorBox.hidden = !model?.error;
  text(errorBox, model?.error || '');
  renderCards();
  renderPorts();
}

function field(labelText, control, help = '') {
  const wrapper = element('label', 'field');
  wrapper.append(element('span', 'field-label', labelText), control);
  if (help) wrapper.append(element('span', 'muted small', help));
  return wrapper;
}
function input(value, placeholder = '') {
  const control = element('input');
  control.value = value || '';
  control.placeholder = placeholder;
  return control;
}
async function openEditor(entry = null, candidate = null) {
  if (!model.context || editor) return;
  const context = { ...model.context };
  const source = entry || candidate || {};
  const dialog = element('dialog', 'editor');
  editor = dialog;
  const form = element('form');
  const title = element('h2', '', t(entry ? 'editTitle' : 'newTitle'));
  title.id = 'editor-title';
  dialog.setAttribute('aria-labelledby', title.id);
  const name = input(source.name, t('inputName'));
  name.required = true;
  name.maxLength = 80;
  const command = element('textarea', 'mono');
  command.rows = 3;
  command.required = true;
  command.maxLength = 4096;
  command.value = source.command || '';
  command.placeholder = t('inputCommand');
  const directory = input(source.directory || '.', '.');
  const port = input(source.port == null ? '' : String(source.port), t('optional'));
  port.type = 'number'; port.min = '1'; port.max = '65535'; port.step = '1';
  const kind = element('select');
  for (const value of ['service', 'task']) {
    const option = element('option', '', t(value)); option.value = value; kind.append(option);
  }
  kind.value = source.kind || 'service';
  if (entry?.run) { command.disabled = true; directory.disabled = true; }
  const fields = () => ({ name: name.value, command: command.value, directory: directory.value, port: port.value, kind: kind.value });
  const initial = JSON.stringify(fields());
  let saving = false;
  const close = async () => {
    if (saving) return;
    if (initial !== JSON.stringify(fields()) && !await confirm(t('discardTitle'), t('discardText'), t('discard'))) return;
    dialog.close();
  };
  const formError = element('p', 'error');
  formError.hidden = true;
  formError.setAttribute('role', 'alert');
  const actions = element('div', 'form-actions');
  const cancel = button(t('cancel'), close);
  const save = element('button', 'primary', t('save')); save.type = 'submit';
  actions.append(cancel, save);
  form.append(title, field(t('name'), name), field(t('command'), command, t(entry?.run ? 'association' : 'commandHelp')),
    field(t('directory'), directory, t('directoryHelp')), field(t('kind'), kind), field(t('port'), port, t('formPortHelp')),
    formError, element('p', 'small muted', t('permissions')), actions);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true; save.disabled = true; cancel.disabled = true;
    try { await model.save(fields(), entry?.id || null, context); dialog.close(); announce(t('saved')); }
    catch (error) { formError.hidden = false; text(formError, error.message); }
    finally { saving = false; save.disabled = false; cancel.disabled = false; }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close().catch(showError); });
  dialog.addEventListener('close', () => { editor = null; dialog.remove(); addButton.focus(); });
  dialog.append(form); root.append(dialog); dialog.showModal(); name.focus();
}
async function importScripts() {
  const context = model.context;
  const candidates = await model.discover();
  if (!candidates?.length) { announce(t('noScripts')); return; }
  const choice = await api.modal.open({ placeholder: t('importTitle'), items: candidates.map((c, i) => ({ id: String(i), title: c.name, subtitle: c.detail })) });
  if (!choice) return;
  await model.assertContext(context);
  const candidate = candidates[Number(choice.id)];
  if (candidate) await openEditor(null, candidate);
}
async function openBrowser(id) {
  const entry = model.entries.find(e => e.id === id);
  if (!entry?.port) return;
  if (await confirm(t('openBrowserTitle'), t('openBrowserText'), t('openButton'))) await api.browser.open(`http://localhost:${entry.port}`);
}
render();
if (model) {
  try {
    model.subscribe();
    await model.refresh();
    initialized = true;
  } catch (error) { model.report(error); }
  api.onFocus?.(focused => { if (focused && initialized && !editor) model.refresh().catch(showError); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && initialized) model.refresh().catch(showError); });
  window.addEventListener('pagehide', () => { clearTimeout(noticeTimer); model.dispose(); }, { once: true });
}
