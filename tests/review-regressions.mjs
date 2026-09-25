import { processFixture } from './fake-services.mjs';

// Run in the isolated preview; no host shell or real browser navigation occurs.
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function refresh() {
  document.querySelector('.refresh').click(); await settle();
  assert(!document.querySelector('.refresh').disabled, 'Refresh did not settle');
  assert(document.querySelector('.scan-error').hidden, 'Inspection failed');
}

export async function checkReviewRegressions() {
  assert(window.previewApi, 'Use the isolated preview');
  const api = window.previewApi;
  const live = document.querySelector('.live-button');
  if (live.getAttribute('aria-pressed') === 'true') live.click();
  await settle();
  api.processes = [
    processFixture({ pid: 5101, cwd: '/review/ipv4', cpuPercent: 5, ports: [{ port: 3210, hosts: ['127.0.0.1'] }] }),
    processFixture({ pid: 5102, cwd: '/review/ipv4', cpuPercent: 90, ports: [{ port: 3210, hosts: ['[::1]'] }] }),
  ];
  const realNow = Date.now, start = realNow();
  let now = start;
  Date.now = () => now;
  try {
    for (let i = 0; i <= 6; i++) {
      now = start + i * 5900;
      await refresh();
      const cards = [...document.querySelectorAll('.service')];
      assert(cards.length === 2, 'Distinct bindings must remain separate rows');
      const highCPU = cards.find(card => card.querySelector('.service-resources').textContent.includes('90.0%'));
      const lowCPU = cards.find(card => card !== highCPU);
      assert(lowCPU.querySelectorAll('.alert-badge').length === 0, 'Stable low-CPU listener received a false warning');
      assert(highCPU.querySelectorAll('.alert-badge').length === (i === 6 ? 1 : 0), 'Sustained CPU warning must follow actual sample timing');
    }
  } finally { Date.now = realNow; }
  const cards = [...document.querySelectorAll('.service')];
  for (const card of cards) card.querySelector('.service-details').open = true;
  await settle();
  const urls = cards.map((_, i) => `https://review-${i}.example/`);
  for (const [i, card] of cards.entries()) {
    card.querySelector('input[type=url]').value = urls[i];
    card.querySelector('.url-form').requestSubmit();
  }
  await settle();
  assert(cards.every(card => !card.querySelector('.service-details').open), 'Both URL saves must finish');
  await refresh();
  assert(cards.every((card, i) => card.querySelector('.open').title === urls[i]), 'Concurrent URL saves must survive refresh without crossing bindings');
  assert(previewErrors.length === 0, previewErrors.join('\n'));
  return { distinctBindings: 2, intervalMs: 5900, sustainedCPU: 'passed', falseRestartWarnings: 0, concurrentURLForms: 'passed' };
}
