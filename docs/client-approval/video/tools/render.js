// Renders video.html frame by frame straight into ffmpeg (no frame files on disk). Everything on D:.
//   node render.js preview   -> contact sheets of sample frames (build/preview-*.jpg)
//   node render.js           -> full MP4
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const B = 'D:/sunshine/ai-calling-agent/docs/client-approval/video/build/';
const OUT = 'D:/sunshine/ai-calling-agent/docs/client-approval/video/Voxura-Product-Walkthrough.mp4';
const FF = 'D:/voxura-video-tools/py/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe';
const FPS = 30;
(async () => {
  const preview = process.argv[2] === 'preview';
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
    userDataDir: 'D:/voxura-video-tools/edge-profile', args: ['--allow-file-access-from-files', '--force-device-scale-factor=1'] });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
  await p.goto('file:///' + B + 'video.html', { waitUntil: 'networkidle0' });
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const fontsOk = await p.evaluate(() => document.fonts.check('800 40px "Bricolage Grotesque"') && document.fonts.check('500 20px "IBM Plex Sans"'));
  const broken = await p.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src));
  console.log('fonts loaded:', fontsOk, ' broken images:', broken.length, broken.join(' '));
  const TOTAL = await p.evaluate(() => window.TOTAL);
  if (preview) {
    const scenes = await p.evaluate(() => DATA.scenes.map(s => [s.id, s.start, s.dur]));
    for (const [id, st, d] of scenes) for (const k of [0.35, 0.85]) {
      await p.evaluate(t => seek(t), st + d * k);
      await p.screenshot({ path: `${B}preview-${id}-${Math.round(k * 100)}.jpg`, type: 'jpeg', quality: 70 });
    }
    console.log('preview frames written'); await b.close(); return;
  }
  const n = Math.ceil(TOTAL * FPS);
  const ff = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', B + 'audio-mix.m4a', '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-c:a', 'copy', '-movflags', '+faststart', '-shortest', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => seek(t), i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 93, optimizeForSpeed: true });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 900 === 0) console.log(`frame ${i}/${n}  ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done in', Math.round((Date.now() - t0) / 1000), 's ->', OUT);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
