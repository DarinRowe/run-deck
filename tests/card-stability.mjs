// Real renderer + fake host: foreground metric updates must not move controls.
const api = window.previewApi;
const tick = () => new Promise(resolve => setTimeout(resolve, 80));
while (!document.querySelector('.service')) await tick();
const live = document.querySelector('.live-button');
if (live?.getAttribute('aria-pressed') === 'true') live.click();
const measure = () => {
  const card = [...document.querySelectorAll('.service')].find(card => card.querySelector('h3')?.textContent === 'Storefront');
  const box = element => { const r = element.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; };
  return { card:box(card), actions:box(card.querySelector('.service-actions')), memory:box(card.querySelectorAll('.resource')[1]) };
};
const refresh = async () => {
  document.querySelector('.refresh').click();
  const button = document.querySelector('.refresh');
  const deadline = performance.now() + 3000;
  do { await tick(); } while (button.disabled && performance.now() < deadline);
  if (button.disabled) throw new Error('Refresh did not finish');
  await new Promise(requestAnimationFrame);
};
const readings = [measure()];
for (const [cpu, rss, elapsed] of [[90,480000,5000],[0,900000,5000],[1000,480000,5000],[0,480000,20000],[null,null,5000],[0,480000,5000]]) {
  const process = api.processes.find(p => p.pid === 4102);
  process.cpuPercent = cpu; process.rssKiB = rss;
  window.previewTimeOffset += elapsed;
  await refresh(); readings.push(measure());
}
const result = document.createElement('pre'); result.id = 'card-stability-result';
const base = readings[0];
const stable = readings.every(r => ['card','actions','memory'].every(key => ['x','y','width','height'].every(prop => Math.abs(r[key][prop] - base[key][prop]) < 1)));
result.textContent = JSON.stringify({passed:stable,readings}); document.body.append(result);
