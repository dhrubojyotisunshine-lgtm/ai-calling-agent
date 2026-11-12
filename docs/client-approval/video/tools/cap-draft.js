// Captures approved draft screens (local copy of the platform draft) for the video. Everything stays on D:.
const puppeteer = require('puppeteer-core');
const V = 'D:/sunshine/ai-calling-agent/docs/client-approval/video/build/';
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', userDataDir: 'D:/voxura-video-tools/edge-profile' });
  const p = await b.newPage(); await p.setViewport({ width: 1600, height: 1000 });
  await p.goto('file:///' + V + 'draft-platform.html', { waitUntil: 'load' });
  await p.addStyleTag({ content: '.draftbar,.banner,[class*=draft-ban]{display:none!important}' });
  for (const r of ['workspace-settings', 'integrations', 'int-logs', 'automations', 'live', 'admin-home', 'admin-clients', 'admin-finance', 'admin-plans', 'journey', 'pipeline']) {
    await p.evaluate(r => { location.hash = r; }, r); await new Promise(x => setTimeout(x, 250));
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({ path: V + 'assets/draft-' + r + '.png' }); console.log('ok', r);
  }
  await b.close();
})();
