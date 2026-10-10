// Proof renders: a contact sheet of every shot (start, the middle of every in-shot cut, end) + optional full-size frames.
// usage: node tools/proof.mjs <out-sheet.png> [frames-dir] [times: comma list of global seconds] [page.html]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire('C:/Users/galar/Desktop/yt/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/');
const { chromium } = require('./index.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , sheetPath, framesDir, timesArg, pageArg] = process.argv;
const page = pageArg || path.join(here, '..', 'showcase.html');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--force-color-profile=srgb'] });
const tab = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
tab.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await tab.goto('file:///' + page.split(path.sep).join('/').replace(/^\/+/, '') + '?paused=1');
const info = await tab.evaluate(() => ({ duration: window.__duration, shots: window.ST.SHOTS.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1, cuts: s.cuts || [[0, 'main']] })) }));
process.stdout.write(`duration ${info.duration} s, ${info.shots.length} shots\n`);

const picks = timesArg && timesArg !== '-'
  ? timesArg.split(',').map((s) => ({ t: parseFloat(s), label: s }))
  : info.shots.flatMap((s, i) => { // shot start + the middle of every in-shot cut + shot end
      const f = (t, cut) => {
        const q = Math.round(t * 24) / 24;
        return { t: q, label: `${String(i + 1).padStart(2, '0')}-${s.id}.${cut}-${q.toFixed(2)}` };
      };
      const mids = s.cuts.map((c, k) => f(s.t0 + (c[0] + (k + 1 < s.cuts.length ? s.cuts[k + 1][0] : s.t1 - s.t0)) / 2, c[1]));
      return [f(s.t0 + 0.1, s.cuts[0][1])].concat(mids, [f(s.t1 - 0.08, s.cuts[s.cuts.length - 1][1])]);
    });
const sheet = await tab.evaluate(async (list) => {
  const cols = 3, w = 480, h = 270, rows = Math.ceil(list.length / cols);
  const out = document.createElement('canvas');
  out.width = cols * w;
  out.height = rows * (h + 30);
  const o = out.getContext('2d');
  o.fillStyle = '#16130f';
  o.fillRect(0, 0, out.width, out.height);
  const frames = [];
  for (let i = 0; i < list.length; i++) {
    const url = window.__showcase.frame(list[i].t);
    frames.push(url);
    const img = new Image();
    img.src = url;
    await img.decode();
    const x = (i % cols) * w, y = Math.floor(i / cols) * (h + 30);
    o.drawImage(img, x, y + 30, w, h);
    o.fillStyle = '#d8cfb4';
    o.font = '18px Georgia';
    o.fillText(list[i].label, x + 8, y + 22);
  }
  return { sheet: out.toDataURL('image/png'), frames };
}, picks);
fs.writeFileSync(sheetPath, Buffer.from(sheet.sheet.split(',')[1], 'base64'));
process.stdout.write('wrote ' + sheetPath + '\n');
if (framesDir && framesDir !== '-') {
  fs.mkdirSync(framesDir, { recursive: true });
  sheet.frames.forEach((u, i) => fs.writeFileSync(path.join(framesDir, picks[i].label + '.png'), Buffer.from(u.split(',')[1], 'base64')));
}
process.stdout.write(errors.length ? `ERRORS:\n${errors.join('\n')}\n` : 'no console errors\n');
await browser.close();
process.exit(errors.length ? 1 : 0);
