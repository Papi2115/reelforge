/**
 * Gadgets and things of `art.object` (PLAN.md#13.15a): clock, hourglass, phone, laptop, tv, lamp,
 * candle, bulb, battery, compass, globe, gear, magnet; bone, coin, key, gem, furniture, weapons,
 * rock, log, campfire, bell, anchor, envelope, food, trophy - each drawn as its defining features.
 */
import type { ObjectOptions } from './gen-objects.js';
import type { Sketch } from './sketch.js';

const L = { shade: 0.4 };

export function drawGadget(sk: Sketch, o: ObjectOptions, fill: string, t: number): boolean {
  switch (o.kind) {
    case 'clock': {
      sk.oval(0, -50, 46, 46, fill, { outline: 'outer' });
      for (let i = 0; i < 12; i += 1)
        sk.dot(
          Math.cos((i / 12) * Math.PI * 2) * 38,
          -50 + Math.sin((i / 12) * Math.PI * 2) * 38,
          2,
          'ink',
        );
      const a = t * 0.5 - Math.PI / 2;
      sk.stroke([0, -50, Math.cos(a) * 32, -50 + Math.sin(a) * 32], { w: 'outer' });
      sk.stroke([0, -50, Math.cos(a / 12) * 20, -50 + Math.sin(a / 12) * 20], { w: 'outer' });
      return true;
    }
    case 'hourglass':
      sk.shape([-30, -100, 30, -100, 4, -50, 30, 0, -30, 0, -4, -50], 'paper', {
        outline: 'outer',
      });
      sk.flat([-22, -6, 22, -6, 0, -30], 'yellow');
      for (const y of [0, -100])
        sk.shape([-36, y, 36, y, 36, y - 6, -36, y - 6], fill, { outline: 'inner' });
      return true;
    case 'phone':
      sk.shape([-26, 0, -26, -100, 26, -100, 26, 0], fill, { outline: 'outer' });
      sk.flat([-20, -10, 20, -10, 20, -90, -20, -90], o.open ? 'cyan' : 'night');
      return true;
    case 'laptop':
      sk.shape([-50, 0, 50, 0, 44, -8, -44, -8], fill, L);
      sk.shape([-40, -8, -44, -70, 44, -70, 40, -8], fill, L);
      sk.flat([-36, -14, -38, -64, 38, -64, 36, -14], o.open ? 'cyan' : 'night');
      return true;
    case 'tv':
      sk.shape([-50, -10, -50, -90, 50, -90, 50, -10], fill, L);
      sk.shape([-40, -20, -40, -80, 30, -80, 30, -20], o.open ? 'cyan' : 'greyDark', {
        outline: 'inner',
      });
      sk.stroke([-20, -90, -34, -110], {});
      sk.stroke([0, -90, 14, -112], {});
      sk.line(-36, -10, -40, 0, 'ink', sk.widthOf('outer'));
      sk.line(36, -10, 40, 0, 'ink', sk.widthOf('outer'));
      return true;
    case 'lamp':
      sk.shape([-6, -6, -4, -60, 4, -60, 6, -6], 'greyDark', { outline: 'inner' });
      sk.shape([-30, 0, 30, 0, 26, -8, -26, -8], 'greyDark', { outline: 'inner' });
      if (o.open)
        sk.flat([-30, -60, 30, -60, 60, 10, -60, 10], sk.g.tone('yellowPale', 0.35, { cell: 3 }));
      sk.shape([-30, -60, -16, -100, 16, -100, 30, -60], fill, L);
      return true;
    case 'candle':
      sk.shape([-12, 0, -12, -70, 12, -70, 12, 0], fill, L);
      sk.shape([-4, -72, 0, -100 - Math.sin(t * 12) * 3, 5, -74], 'yellow', { outline: 'inner' });
      return true;
    case 'bulb':
      if (o.open)
        for (let i = 0; i < 8; i += 1) {
          const a = -Math.PI + (i / 7) * Math.PI;
          sk.stroke(
            [Math.cos(a) * 44, -66 + Math.sin(a) * 44, Math.cos(a) * 56, -66 + Math.sin(a) * 56],
            { w: 'outer', color: 'yellow' },
          );
        }
      sk.oval(0, -64, 32, 34, fill, { outline: 'outer' });
      sk.shape([-14, -30, 14, -30, 12, 0, -12, 0], 'greyMid', { outline: 'inner' });
      sk.stroke([-8, -32, -4, -54, 4, -54, 8, -32], { color: 'greyDark' });
      return true;
    case 'battery':
      sk.shape([-24, 0, -24, -88, 24, -88, 24, 0], fill, L);
      sk.shape([-8, -88, 8, -88, 8, -98, -8, -98], 'greyLight', { outline: 'inner' });
      sk.flat([-18, -6, 18, -6, 18, -40, -18, -40], 'phosphor');
      return true;
    case 'compass':
    case 'globe':
      if (o.kind === 'globe') {
        sk.stroke([-34, -10, -40, -50, -20, -90], { w: 'outer', color: 'greyDark' });
        sk.shape([-20, 0, 20, 0, 6, -10, -6, -10], 'greyDark', { outline: 'inner' });
      }
      sk.oval(0, -52, 40, 40, fill, L);
      if (o.kind === 'globe')
        for (const [x, y] of [
          [-12, -64],
          [14, -44],
          [6, -70],
        ] as const)
          sk.oval(x, y, 12, 8, 'phosphor', { outline: 'inner' });
      else {
        sk.oval(0, -52, 30, 30, 'paper', { outline: 'inner' });
        sk.shape([0, -80, 6, -52, 0, -24, -6, -52], 'red', { outline: 'inner' });
      }
      return true;
    case 'gear':
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + t * 0.6;
        sk.cap(
          Math.cos(a) * 32,
          -50 + Math.sin(a) * 32,
          Math.cos(a) * 44,
          -50 + Math.sin(a) * 44,
          8,
          fill,
          { outline: 'inner' },
        );
      }
      sk.oval(0, -50, 36, 36, fill, L);
      sk.oval(0, -50, 12, 12, 'paper', { outline: 'inner' });
      return true;
    case 'magnet':
      sk.stroke([-26, 0, -26, -60, 0, -92, 26, -60, 26, 0], { w: 22, color: fill });
      for (const x of [-26, 26])
        sk.shape([x - 11, 0, x + 11, 0, x + 11, -16, x - 11, -16], 'greyLight', {
          outline: 'inner',
        });
      return true;
    default:
      return false;
  }
}

export function drawThing(sk: Sketch, o: ObjectOptions, fill: string, t: number): void {
  switch (o.kind) {
    case 'bone':
      sk.blob(
        [
          { c: [-34, -20, 34, -20, 9] },
          { e: [-38, -28, 10, 9] },
          { e: [-38, -12, 10, 9] },
          { e: [38, -28, 10, 9] },
          { e: [38, -12, 10, 9] },
        ],
        fill,
      );
      return;
    case 'coin':
      sk.oval(0, -50, 46, 48, fill, L);
      sk.oval(0, -50, 34, 36, 'none', { outline: 'inner' });
      sk.shape([-6, -70, 6, -70, 6, -30, -6, -30], 'magenta', { outline: false });
      return;
    case 'key':
      sk.oval(-26, -50, 22, 22, fill, L);
      sk.oval(-26, -50, 8, 8, 'paper', { outline: 'inner' });
      sk.shape([-6, -56, 50, -56, 50, -44, -6, -44], fill, L);
      sk.shape([30, -44, 30, -30, 38, -30, 38, -44, 44, -44, 44, -34, 50, -34, 50, -44], fill, {
        outline: 'inner',
      });
      return;
    case 'gem':
      sk.shape([-40, -66, -22, -90, 22, -90, 40, -66, 0, 0], fill, { shade: 0.5 });
      sk.stroke([-40, -66, 40, -66], {});
      sk.stroke([-22, -90, -10, -66, 0, 0, 10, -66, 22, -90], {});
      return;
    case 'chair':
      sk.shape([-30, -50, 30, -50, 30, -58, -30, -58], fill, L);
      sk.shape([-30, -58, -30, -110, -22, -110, -22, -58], fill, L);
      for (const x of [-28, 26]) sk.line(x, -50, x, 0, 'ink', sk.widthOf('outer'));
      return;
    case 'table':
      sk.shape([-60, -60, 60, -60, 60, -70, -60, -70], fill, L);
      for (const x of [-52, 52])
        sk.shape([x - 4, -60, x + 4, -60, x + 4, 0, x - 4, 0], fill, { outline: 'inner' });
      return;
    case 'sword':
      sk.shape([-4, -24, 4, -24, 3, -96, 0, -104, -3, -96], fill, L);
      sk.shape([-18, -24, 18, -24, 18, -18, -18, -18], 'aged', { outline: 'inner' });
      sk.shape([-4, -18, 4, -18, 4, 0, -4, 0], 'sepiaMid', { outline: 'inner' });
      return;
    case 'shield':
      sk.shape([-40, -100, 40, -100, 40, -50, 0, 0, -40, -50], fill, L);
      sk.shape([-6, -92, 6, -92, 6, -16, -6, -16], 'yellow', { outline: false });
      sk.shape([-32, -66, 32, -66, 32, -56, -32, -56], 'yellow', { outline: false });
      return;
    case 'rock':
      sk.shape([-50, 0, -46, -30, -20, -56, 10, -60, 40, -40, 52, 0], fill, { shade: 0.5 });
      sk.stroke([-10, -50, -4, -30, 8, -22], {});
      return;
    case 'log':
      sk.cap(-50, -16, 40, -16, 16, fill, L);
      sk.oval(44, -16, 12, 16, 'aged', { outline: 'outer' });
      sk.oval(44, -16, 5, 7, 'none', { outline: 'inner' });
      return;
    case 'campfire': {
      for (const a of [-0.5, 0.5]) sk.sub(0, -6, 1, a).cap(-40, 0, 40, 0, 7, fill, L);
      const f = Math.sin(t * 9) * 4;
      sk.shape(
        [-26, -10, -20, -60 + f, -8, -40, 0, -90 - f, 10, -42, 20, -64 + f, 26, -10],
        'yellow',
        { outline: 'outer' },
      );
      sk.shape([-12, -10, -6, -40, 2, -56 + f, 10, -34, 12, -10], 'red', { outline: false });
      return;
    }
    case 'bell':
      sk.shape([-44, -8, -30, -30, -28, -76, 0, -92, 28, -76, 30, -30, 44, -8], fill, L);
      sk.oval(0, -4, 8, 8, 'greyDark');
      return;
    case 'anchor':
      sk.oval(0, -88, 10, 10, 'none', { outline: 'outer' });
      sk.stroke([0, -78, 0, -6], { w: 10, color: fill });
      sk.stroke([-40, -36, -30, -10, 0, -4, 30, -10, 40, -36], { w: 9, color: fill });
      sk.stroke([-20, -62, 20, -62], { w: 8, color: fill });
      return;
    case 'envelope':
      sk.shape([-50, -10, 50, -10, 50, -76, -50, -76], fill, L);
      sk.stroke([-50, -76, 0, -36, 50, -76], {});
      sk.shape([20, -70, 42, -70, 42, -50, 20, -50], 'red', { outline: 'inner' });
      return;
    case 'apple':
      sk.shape(
        [0, -70, -22, -82, -42, -60, -38, -20, -16, 0, 0, -8, 16, 0, 38, -20, 42, -60, 22, -82],
        fill,
        L,
      );
      sk.stroke([0, -70, 4, -94], { w: 'outer', color: 'sepiaMid' });
      sk.shape([4, -86, 24, -98, 16, -82], 'phosphor', { outline: 'inner' });
      return;
    case 'bread':
      sk.shape([-50, 0, -54, -30, -30, -54, 30, -54, 54, -30, 50, 0], fill, L);
      for (const x of [-20, 0, 20]) sk.stroke([x - 6, -48, x + 6, -30], {});
      return;
    case 'egg':
      sk.shape([0, -100, -26, -76, -36, -36, -22, -4, 0, 0, 22, -4, 36, -36, 26, -76], fill, L);
      return;
    case 'trophy':
      sk.shape([-34, -100, 34, -100, 26, -60, 8, -50, 8, -26, -8, -26, -8, -50, -26, -60], fill, L);
      for (const s of [-1, 1])
        sk.stroke([s * 32, -94, s * 46, -86, s * 30, -70], { w: 'outer', color: fill });
      sk.shape([-26, 0, 26, 0, 22, -26, -22, -26], 'sepiaMid', { outline: 'inner' });
      return;
    default:
      sk.oval(0, -40, 40, 40, fill, L);
  }
}
