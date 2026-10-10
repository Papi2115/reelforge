// Proof images: before (the original c-plus film's own engine + character, loaded from its folder) vs after (this
// engine + the ported character), same set-up, side by side; the film 15 deck handshake (old frame vs new); a
// handshake board; turnaround sheets; the line-up. Also measures the old deck handshake gap in the old engine.
// usage: node tools/proof.mjs            -> writes proof/*.png, prints evidence numbers
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire('C:/Users/galar/Desktop/yt/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/');
const { chromium } = require('./index.js');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), styles = path.join(root, '..');
const url = (p, q) => 'file:///' + p.split(path.sep).join('/') + (q || '');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--force-color-profile=srgb'] });
const errors = [];
async function run(page, code) {
  const tab = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  tab.on('pageerror', (e) => errors.push(page + ': ' + e.message));
  await tab.goto(page);
  const out = await tab.evaluate(code);
  await tab.close();
  return out;
}
const save = (name, dataUrl) => { fs.writeFileSync(path.join(root, 'proof', name), Buffer.from(dataUrl.split(',')[1], 'base64')); process.stdout.write('wrote proof/' + name + '\n'); };
// a flat stage: wall + floor (no set, no vignette: the comparison is about anatomy)
const STAGE = `const W = 960, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.fillStyle = '#5a5446'; c.fillRect(0, 0, W, H); c.fillStyle = '#3b3127'; c.fillRect(0, H * 0.86, W, H * 0.14);`;
const oldPage = (film) => url(path.join(styles, film, 'c-plus', 'test.html'));
const newPage = url(path.join(root, 'test.html'), '?sheets=0');
// find a time where the OLD engine says this seed is on viseme A (its own clock), so both sides open the mouth
const FIND_A = (seed) => `(() => { for (let k = 0; k < 96; k++) { const t = k / 24, v = ST.viseme(t, ${seed}, [[0, 9]]); if (v === 'A' || v === 'ah') return t; } return 0; })()`;

const SCENES = [
  { name: 'captain', film: '15-pirate-ship', title: 'Captain (film 15): open mouth + arms',
    old: `ST.setLight(-1, 'rgba(255,214,150,0.6)'); const P = ST.CAST.captain, t = ${FIND_A(1210)};
      P.draw(c, { x: 220, y: 650, s: 0.66, t, yaw: 0, expr: 'scared', talk: [[0, 9]], pose: ST.pose('stand', P.D) });
      P.draw(c, { x: 640, y: 1330, s: 1.55, t, yaw: -1, expr: 'grin', talk: [[0, 9]], pose: ST.pose('stand', P.D) });`,
    new: `ST.setLight(-1, 'rgba(255,214,150,0.6)'); const P = ST.CAST.captain;
      P.draw(c, { x: 220, y: 650, s: 0.66, t: 0.05, yaw: 0, expr: 'scared', vis: 'A', still: true, pose: ST.pose('stand', P.D) });
      P.draw(c, { x: 640, y: 1330, s: 1.55, t: 0.05, yaw: -1, expr: 'grin', vis: 'A', still: true, pose: ST.pose('stand', P.D) });` },
  { name: 'senator', film: '16-roman-emperor', title: 'Senator (film 16): hand under chin, folded arms, twiddle',
    old: `ST.KEY = { x: -1, y: -0.5 }; ST.camZ = 1; const Sn = ST.CAST.senator, D = Sn.D, lit = (p) => ST.lit(c, { d: 20 * p.s, rim: 5 * p.s, ink: 13 * Math.pow(p.s, 0.45) }, (cc) => Sn.draw(cc, p));
      lit({ x: 170, y: 640, s: 0.8, t: 0.05, yaw: 0, layer: { R: 2 }, pose: ST.pose('stand', D, null, { hR: ST.handAt(D, -1, -0.55, -0.12, 0.7), kR: 'fist', poleR: [-1, 0.5, -0.2] }) });
      lit({ x: 480, y: 640, s: 0.8, t: 0.05, yaw: 1, pose: ST.pose('stand', D, null, { hL: ST.handAt(D, 1, -1.0, 0.42, 0.45), hR: ST.handAt(D, -1, -1.0, 0.38, 0.5), kL: 'flat', kR: 'flat', poleL: [1, 0.55, 0.35], poleR: [-1, 0.55, 0.35] }) });
      lit({ x: 790, y: 640, s: 0.8, t: 0.05, yaw: -1, pose: ST.pose('stand', D, null, Sn.twiddle(0.05)) });`,
    new: `ST.setLight({ x: -1, y: -0.5 }); ST.camZ = 1; const D = ST.CAST.senator.D;
      ST.actor(c, 'senator', { x: 170, y: 640, s: 0.8, t: 0.05, yaw: 0, still: true, pose: ST.pose('stand', D, null, ST.touch('R', 'chin', 0, 12, 'fist')) });
      ST.actor(c, 'senator', { x: 480, y: 640, s: 0.8, t: 0.05, yaw: 1, still: true, pose: ST.pose('fold', D) });
      ST.actor(c, 'senator', { x: 790, y: 640, s: 0.8, t: 0.05, yaw: -1, still: true, pose: ST.pose('stand', D, null, ST.senatorTwiddle(0.05)) });` },
  { name: 'washer', film: '13-miami-80s', title: 'Laundromat Owner (film 13): reaching across the counter + standing',
    old: `ST.setLight({ x: 0.2, y: -1, rim: 'rgba(220,236,210,0.5)', shadow: 'rgba(20,24,30,0.4)' }); const W2 = ST.CAST.washer;
      W2.draw(c, { x: 220, y: 660, s: 0.86, t: 0.05, yaw: 0, expr: 'bored', pose: ST.pose('stand', W2.D) });
      c.fillStyle = '#7d6a4e'; c.fillRect(380, 470, 580, 40);
      W2.draw(c, { x: 820, y: 700, s: 0.95, t: 0.05, yaw: -2, head: -1, over: true, expr: 'smug', pose: ST.WASHER_STAMP(W2.D, 1), propR: (cc, x, y) => ST.stamp(cc, x, y + 10, true), layer: { R: 2 } });`,
    new: `ST.setLight({ x: 0.2, y: -1, rim: 'rgba(220,236,210,0.5)', shadow: 'rgba(20,24,30,0.4)' }); const W2 = ST.CAST.washer;
      W2.draw(c, { x: 220, y: 660, s: 0.86, t: 0.05, yaw: 0, expr: 'bored', still: true, pose: ST.pose('stand', W2.D) });
      c.fillStyle = '#7d6a4e'; c.fillRect(380, 470, 580, 40);
      const p = { x: 820, y: 700, s: 0.95, t: 0.05, yaw: -2, head: -1, over: true, expr: 'smug', still: true, pose: ST.WASHER_STAMP(W2.D, 1) };
      const r = ST.handAtWorld(W2, p, 'R', [690, 466]); // the palm on the counter top, in world space
      W2.draw(c, Object.assign(p, { pose: Object.assign({}, p.pose, r.over, { kR: 'grip' }), propR: (cc, x, y) => ST.stamp(cc, x, y + 10, true) }));` },
  { name: 'you', film: '12-mammoth-hunt', title: 'You (film 12): flail, hug + phone',
    old: `ST.light({ x: -1, rim: 'rgba(255,214,150,0.5)' }); const Y = ST.CAST.you, D = Y.D;
      Y.draw(c, { x: 170, y: 660, s: 0.72, t: 0.05, yaw: 0, expr: 'scared', pose: ST.pose('flail', D, 0.25) });
      Y.draw(c, { x: 480, y: 660, s: 0.72, t: 0.05, yaw: 1, expr: 'scared', pose: ST.pose('flail', D, 0.75) });
      Y.draw(c, { x: 790, y: 660, s: 0.72, t: 0.05, yaw: -1, expr: 'deadpan', phone: true, layer: { R: 2 }, pose: ST.pose('hug', D, null, { hR: ST.handAt(D, -1, -0.12, 0.2, 0.6), kR: 'grip', poleR: [-1, 0.6, -0.2] }) });`,
    new: `ST.setLight({ x: -1, rim: 'rgba(255,214,150,0.5)', deep: 0.2 }); const Y = ST.CAST.you, D = Y.D;
      Y.draw(c, { x: 170, y: 660, s: 0.72, t: 0.05, yaw: 0, expr: 'scared', still: true, pose: ST.pose('flail', D, 0.25) });
      Y.draw(c, { x: 480, y: 660, s: 0.72, t: 0.05, yaw: 1, expr: 'scared', still: true, pose: ST.pose('flail', D, 0.75) });
      Y.draw(c, { x: 790, y: 660, s: 0.72, t: 0.05, yaw: -1, expr: 'deadpan', still: true, phone: true, pose: ST.pose('hug', D, null, { hR: ST.handAt(D, -1, -0.12, 0.2, 0.6), kR: 'grip', poleR: [-1, 0.6, -0.2] }) });` },
];
const COMPOSE = (title, before, after) => `(async () => {
  const load = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
  const [a, b] = [await load(${JSON.stringify(before)}), await load(${JSON.stringify(after)})];
  const cv = document.createElement('canvas'); cv.width = a.width + b.width + 20; cv.height = a.height + 96; const c = cv.getContext('2d');
  c.fillStyle = '#16120e'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(a, 0, 96); c.drawImage(b, a.width + 20, 96);
  c.fillStyle = '#e2d8b8'; c.font = 'bold 26px Georgia'; c.fillText(${JSON.stringify(title)}, 14, 36);
  c.font = '22px Georgia'; c.fillText('BEFORE - the original c-plus engine + character', 14, 76); c.fillText('AFTER - 20-cplus-engine + ported character', a.width + 34, 76);
  return cv.toDataURL('image/png'); })()`;

for (const s of SCENES) {
  const before = await run(oldPage(s.film), `(() => { ${STAGE} ${s.old} return cv.toDataURL(); })()`);
  const after = await run(newPage, `(() => { ${STAGE} ${s.new} return cv.toDataURL(); })()`);
  save(`before-after-${s.name}.png`, await run(newPage, COMPOSE(s.title, before, after)));
}

// the film 15 deck handshake: the old frame (11.0 s) and the same set-up solved by ST.meet, lit + vignetted
const oldDeck = await run(url(path.join(styles, '15-pirate-ship', 'c-plus', 'showcase.html'), '?paused=1&captions=0'), 'window.__showcase.frame(11.0)');
const oldGap = await run(url(path.join(styles, '15-pirate-ship', 'c-plus', 'test.html')), `(() => {
  const P = ST.CAST.captain, R = ST.CAST.recruit, pump = 0;
  const world = (ch, p, P0, side, flipLean) => { const V = ST.view(p.yaw), J = ST.solve(V, ch.D, P0), g = ST.palm(J['a' + side], side === 'R' ? (ch === P ? 36 : 34) : 34);
    const lean = (flipLean + (P0.lean || 0)) * Math.PI / 180, x = g[0] * Math.cos(lean) - g[1] * Math.sin(lean), y = g[0] * Math.sin(lean) + g[1] * Math.cos(lean);
    return [p.x + (V.mir ? -1 : 1) * p.s * x, p.y + p.s * y]; };
  const a = world(P, { x: 1090, y: 1080, s: 1.0, yaw: -1 }, ST.pose('stand', P.D, null, ST.captainShake(P.D, pump)), 'R', -3);
  const bP = Object.assign(ST.pose('stand', R.D, null, { hR: ST.handAt(R.D, -1, -0.1, 0.5, 0.9), kR: 'grip', poleR: [-1, 0.4, -0.4] }), ST.recruitCarry(R.D));
  const b = world(R, { x: 640, y: 1500, s: 1.4, yaw: 2 }, bP, 'R', 0);
  return Math.hypot(a[0] - b[0], a[1] - b[1]); })()`);
const newDeck = await run(newPage, `(() => {
  const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; const c = cv.getContext('2d');
  ST.setLight(-1, 'rgba(255,214,150,0.6)'); ST.camera(c, 1180, 620, 1.12);
  c.fillStyle = '#6e5a3e'; c.fillRect(-400, -400, 3000, 1300); c.fillStyle = '#4a3a28'; c.fillRect(-400, 880, 3000, 900);
  for (let i = 0; i < 9; i++) ST.rect(c, -400, 880 + i * 34 * (1 + i * 0.25), 3000, 34 * (1 + i * 0.25), i % 2 ? '#4a3a28' : '#54422e', { seed: 900 + i, lw: 4 }); // deck planks
  const Cp = ST.CAST.captain, Rc = ST.CAST.recruit;
  const m = ST.meet({ a: { ch: Cp, hand: 'R', cam: null, p: { x: 1090, y: 1080, s: 1.0, t: 0.05, yaw: -1, expr: 'grin', still: true } },
    b: { ch: Rc, hand: 'R', cam: null, p: { x: 640, y: 1500, s: 1.4, t: 0.05, yaw: 2, expr: 'scared', still: true, sack: true, pose: ST.pose('stand', Rc.D, null, ST.recruitCarry(Rc.D)) } }, point: 'mid', move: true });
  Cp.draw(c, ST.captainClamp(m)); Rc.draw(c, m.b); ST.vignette(c, 0.9);
  const g = ST.palmWorld(Cp, m.a, 'R'), h = ST.palmWorld(Rc, m.b, 'R');
  window.__gap = Math.hypot(g[0] - h[0], g[1] - h[1]); return cv.toDataURL(); })()`);
save('handshake-deck.png', await run(newPage, COMPOSE('film 15 deck handshake at 11.0 s (old frame, with set)', oldDeck, newDeck)));
process.stdout.write(`old deck handshake: palms ${oldGap.toFixed(0)} px apart (old engine, same set-up)\n`);
save('handshake-board.png', await run(newPage, `window.__test.meetBoard([['captain', 'recruit', 1, 1.1, 1, -1], ['senator', 'washer', 1, 1, 1, -2], ['you', 'captain', 0.9, 1, 2, -1], ['recruit', 'senator', 1, 1.1, 1, -2]])`));
save('lineup.png', await run(newPage, 'window.__test.lineup(false)'));
save('turnarounds.png', await run(url(path.join(root, 'test.html')), 'window.__test.all(0.4)'));
await browser.close();
process.stdout.write(errors.length ? 'ERRORS:\n' + errors.join('\n') + '\n' : 'no page errors\n');
process.exit(errors.length ? 1 : 0);
