// Proof renders: a contact sheet of every shot (start / mid / end) + optional full-size frames.
// usage: node tools/proof.mjs <out-sheet.png> [frames-dir|-] [times|-|cuts] [page.html]
//   times: comma list of global seconds; "-" = 12 % / 50 % / 93 % of every shot;
//   "cuts" = the middle of every in-shot framing (each shot def lists its cut times in `cuts`).
// Paths: see tools/pw.mjs (PW_CORE, CHROME_PATH env overrides).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launch, fileUrl } from './pw.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , sheetPath, framesDir, timesArg, pageArg] = process.argv;
const page = pageArg || path.join(here, '..', 'showcase.html');
const browser = await launch();
const tab = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
tab.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await tab.goto(fileUrl(page) + '?paused=1');
const info = await tab.evaluate(() => ({
  duration: window.__duration,
  shots: window.ST.SHOTS.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1, cuts: s.cuts || [0] })),
}));
process.stdout.write(`duration ${info.duration} s, ${info.shots.length} shots\n`);

const label = (i, s, t) => `${String(i + 1).padStart(2, '0')}-${s.id}-${t.toFixed(2)}`;
let picks;
if (timesArg === 'cuts') {
  picks = info.shots.flatMap((s, i) => s.cuts.map((at, k) => {
    const end = k + 1 < s.cuts.length ? s.cuts[k + 1] : s.t1 - s.t0;
    const t = Math.round((s.t0 + (at + end) / 2) * 24) / 24;
    return { t, label: label(i, s, t) };
  }));
} else if (timesArg && timesArg !== '-') {
  picks = timesArg.split(',').map((x) => ({ t: parseFloat(x), label: x }));
} else {
  picks = info.shots.flatMap((s, i) => [0.12, 0.5, 0.93].map((k) => {
    const t = Math.round((s.t0 + (s.t1 - s.t0) * k) * 24) / 24;
    return { t, label: label(i, s, t) };
  }));
}
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
