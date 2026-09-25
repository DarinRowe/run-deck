import { processFixture } from './fake-services.mjs';

// Run checkSystemFilters() inside tests/preview.html, using the real UI and fake host.
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const visible = parent => [...parent.querySelectorAll('.service')].filter(card => !card.hidden);

export async function checkSystemFilters() {
  assert(window.previewApi, 'Use the isolated fixture preview');
  const api = window.previewApi;
  const live = document.querySelector('.live-button');
  if (live.getAttribute('aria-pressed') === 'true') live.click();
  await settle();
  api.processes = [processFixture({ pid: 6000, name: 'Muxy', executable: '/Applications/Muxy.app/Contents/MacOS/Muxy',
    cwd: '/', ports: [{ port: 4865, hosts: ['127.0.0.1'] }] })];
  document.querySelector('.refresh').click();
  await settle();
  assert(!document.querySelector('.refresh').disabled, 'Fixture refresh did not finish');
  const filters = [...document.querySelectorAll('.filter')];
  const system = document.querySelector('.system');
  system.open = true;
  filters[0].click(); await settle();
  assert(visible(system).length === 1, 'Baseline: one app process should be visible');
  filters[2].click(); await settle();
  assert(visible(system).length === 1, 'Needs attention must not empty the app/system section while its badge shows 1');
  filters[1].click(); await settle();
  assert(visible(system).length === 1, 'This project must not hide app/system processes');
  const search = document.querySelector('.search');
  search.value = '4865'; search.dispatchEvent(new Event('input', { bubbles: true }));
  assert(visible(system).length === 1, 'Search must still find app/system ports');
  assert(document.querySelector('.system-count').textContent === '1/1', 'Search badge must show matched/total');
  search.value = 'no-such-process'; search.dispatchEvent(new Event('input', { bubbles: true }));
  assert(visible(system).length === 0, 'An unmatched search must hide unrelated system rows');
  assert(document.querySelector('.system-count').textContent === '0/1', 'Zero matches must not show a misleading total');
  assert(!document.querySelector('.system-empty').hidden, 'An expanded empty search must explain the missing rows');
  search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true }));
  assert(visible(system).length === 1 && document.querySelector('.system-empty').hidden, 'Clearing search must restore system rows');
  assert(document.querySelector('.system-count').textContent === '1', 'Clearing search must restore the total badge');
  api.processes.push(
    processFixture({ pid: 7000, cwd: '/Users/example/Projects/storefront' }),
    processFixture({ pid: 7001, cwd: '/Users/example/other-project', ports: [{ port: 3001, hosts: ['127.0.0.1'] }] }),
  );
  document.querySelector('.refresh').click(); await settle();
  const services = document.querySelector('.shell > .service-list');
  filters[0].click(); await settle();
  assert(visible(services).length === 2, 'All must show both development services');
  filters[1].click(); await settle();
  assert(visible(services).length === 1, 'This project must still exclude outside development services');
  filters[2].click(); await settle();
  assert(visible(services).length === 0 && visible(system).length === 1, 'Needs attention must still filter healthy development services only');
  assert(window.previewErrors.length === 0, window.previewErrors.join('\n'));
  return { systemProcesses: 1, attention: 'passed', project: 'passed', search: 'passed', developmentFilters: 'passed' };
}
