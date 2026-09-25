import { processFixture } from './fake-services.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

// Run in tests/preview.html; inspect rendered SVG visibility, not a JS property.
export async function checkTrendVisibility() {
  assert(window.previewApi, 'Use the isolated fixture preview');
  const api = window.previewApi;
  api.focusChanged(true);
  const live = document.querySelector('.live-button');
  if (live.getAttribute('aria-pressed') === 'true') live.click();
  await settle();
  const originalProcesses = api.processes;
  const originalOffset = window.previewTimeOffset;
  const fixture = processFixture({ pid: 17001, cpuPercent: 10, ports: [{ port: 17001, hosts: ['127.0.0.1'] }] });
  const refresh = async () => {
    document.querySelector('.refresh').click(); await settle();
    assert(!document.querySelector('.refresh').disabled, 'Fixture refresh did not finish');
    assert(document.querySelector('.scan-error').hidden, 'Fixture inspection failed');
    return document.querySelector('.service .sparkline');
  };
  const hidden = trend => getComputedStyle(trend).display === 'none';
  try {
    api.processes = [fixture];
    let trend = await refresh();
    assert(hidden(trend), 'One observation must not display a CPU trend');
    window.previewTimeOffset += 5000;
    trend = await refresh();
    assert(!hidden(trend), 'Two valid observations should display a CPU trend');
    window.previewTimeOffset += 5000;
    fixture.cpuPercent = null;
    trend = await refresh();
    assert(hidden(trend), 'Missing CPU readings must not draw a false zero-CPU trend');
    window.previewTimeOffset += 16000;
    fixture.cpuPercent = 10;
    trend = await refresh();
    assert(hidden(trend), 'The first observation after a gap must hide the old trend');
    window.previewTimeOffset += 5000;
    trend = await refresh();
    assert(!hidden(trend), 'The trend should recover after two new valid observations');
    assert(window.previewErrors.length === 0, window.previewErrors.join('\n'));
    return { singleSampleHidden: true, validSamplesShown: true, missingSampleHidden: true, gapAndRecovery: true };
  } finally {
    api.processes = originalProcesses;
    window.previewTimeOffset = originalOffset;
    await refresh();
  }
}
