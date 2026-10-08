/**
 * Symbols in the comic grammar (PLAN.md#13.15a): `art.icon` (heart, star, check, question,
 * warning, pin, ... placed by their centre). Charts, maps and signs: gen-charts.ts.
 */
import { z } from 'zod';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape } from './common.js';
import { sketchFor } from './sketch.js';

export const ICONS = [
  'heart',
  'star',
  'check',
  'cross',
  'question',
  'exclamation',
  'arrow',
  'plus',
  'minus',
  'warning',
  'pin',
  'target',
  'lock',
  'eye',
  'speech',
  'music',
  'drop',
  'leaf',
  'flame',
  'atom',
  'house',
  'figure',
] as const;

export const iconSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(ICONS),
  size: z.number().min(0).max(600).default(30).describe('Height; placed by its centre'),
  fill: colorSchema.optional(),
  angle: z.number().default(0).describe('Turn in radians (an arrow points right at 0)'),
});

const ICON_FILL: Readonly<Partial<Record<(typeof ICONS)[number], string>>> = {
  heart: 'red',
  star: 'yellow',
  check: 'phosphor',
  cross: 'red',
  question: 'yellow',
  exclamation: 'red',
  arrow: 'red',
  warning: 'yellow',
  pin: 'red',
  target: 'red',
  lock: 'yellow',
  eye: 'paper',
  speech: 'paper',
  drop: 'cyan',
  leaf: 'phosphor',
  flame: 'yellow',
  atom: 'cyan',
  house: 'paper',
  figure: 'ink',
};

export function drawIcon(g: ComicPen, o: z.output<typeof iconSchema>): void {
  const sk = sketchFor(g, { ...o, angle: o.angle }, 100, artKey(`icon-${o.kind}`, o.seed));
  const fill = o.fill ?? ICON_FILL[o.kind] ?? 'paper';
  const L = { shade: 0.3 };
  const bar = (pts: number[]) => {
    sk.shape(pts, fill, L);
  };
  switch (o.kind) {
    case 'heart': {
      sk.shape([0, 44, -44, 0, -46, -26, -26, -46, 0, -28, 26, -46, 46, -26, 44, 0], fill, L);
      return;
    }
    case 'star': {
      const pts: number[] = [];
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 50 : 21;
        pts.push(Math.cos(a) * r, Math.sin(a) * r + 4);
      }
      sk.shape(pts, fill, L);
      return;
    }
    case 'check': {
      bar([-46, -2, -30, -18, -12, 2, 34, -46, 48, -30, -12, 32]);
      return;
    }
    case 'cross': {
      bar([
        -44, -30, -30, -44, 0, -14, 30, -44, 44, -30, 14, 0, 44, 30, 30, 44, 0, 14, -30, 44, -44,
        30, -14, 0,
      ]);
      return;
    }
    case 'plus': {
      bar([
        -12, -46, 12, -46, 12, -12, 46, -12, 46, 12, 12, 12, 12, 46, -12, 46, -12, 12, -46, 12, -46,
        -12, -12, -12,
      ]);
      return;
    }
    case 'minus': {
      bar([-46, -12, 46, -12, 46, 12, -46, 12]);
      return;
    }
    case 'arrow': {
      bar([-46, -12, 6, -12, 6, -34, 48, 0, 6, 34, 6, 12, -46, 12]);
      return;
    }
    case 'question':
      sk.stroke([-22, -26, -16, -44, 6, -48, 22, -36, 18, -16, 0, -4, 0, 14], {
        w: 18,
        color: fill,
      });
      sk.stroke([-22, -26, -16, -44, 6, -48, 22, -36, 18, -16, 0, -4, 0, 14], { w: 'outer' });
      {
        sk.oval(0, 38, 9, 9, fill);
        return;
      }
    case 'exclamation':
      bar([-12, -50, 12, -50, 7, 20, -7, 20]);
      {
        sk.oval(0, 40, 10, 10, fill);
        return;
      }
    case 'warning':
      sk.shape([0, -50, 50, 42, -50, 42], fill, L);
      sk.shape([-5, -18, 5, -18, 3, 16, -3, 16], 'ink', { outline: false });
      {
        sk.dot(0, 28, 5, 'ink');
        return;
      }
    case 'pin':
      sk.shape([0, 50, -30, -6, -32, -28, -18, -46, 0, -52, 18, -46, 32, -28, 30, -6], fill, L);
      {
        sk.oval(0, -22, 11, 11, 'paper', { outline: 'inner' });
        return;
      }
    case 'target':
      for (const [r, f] of [
        [48, fill],
        [34, 'paper'],
        [20, fill],
        [8, 'paper'],
      ] as const)
        sk.oval(0, 0, r, r, f, { outline: 'inner' });
      return;
    case 'lock':
      sk.stroke([-22, -6, -22, -30, 0, -48, 22, -30, 22, -6], { w: 10, color: 'greyMid' });
      sk.shape([-36, -8, 36, -8, 36, 46, -36, 46], fill, L);
      {
        sk.dot(0, 16, 7, 'ink');
        return;
      }
    case 'eye':
      sk.shape([-50, 0, -24, -26, 24, -26, 50, 0, 24, 26, -24, 26], fill, { outline: 'outer' });
      sk.oval(0, 0, 20, 20, 'cyan', { outline: 'inner' });
      {
        sk.dot(0, 0, 9, 'ink');
        return;
      }
    case 'speech': {
      sk.shape([-48, -36, 48, -36, 48, 22, -8, 22, -30, 46, -22, 22, -48, 22], fill, {
        outline: 'outer',
      });
      return;
    }
    case 'music':
      sk.stroke([-14, 30, -14, -40, 30, -50, 30, 20], { w: 'outer' });
      sk.oval(-24, 32, 12, 9, 'ink');
      {
        sk.oval(20, 22, 12, 9, 'ink');
        return;
      }
    case 'drop': {
      sk.shape([0, -50, 30, 6, 30, 22, 14, 44, -14, 44, -30, 22, -30, 6], fill, L);
      return;
    }
    case 'leaf':
      sk.shape([-44, 40, -40, -10, -6, -44, 44, -46, 30, 6, -2, 34], fill, L);
      {
        sk.stroke([-44, 40, 30, -34], {});
        return;
      }
    case 'flame':
      sk.shape([-30, 46, -38, 4, -16, -20, -6, -50, 18, -18, 34, -4, 30, 46], fill, {
        outline: 'outer',
      });
      {
        sk.shape([-14, 46, -14, 18, 2, -6, 14, 22, 12, 46], 'red', { outline: false });
        return;
      }
    case 'atom':
      for (const a of [0, 1.05, -1.05])
        sk.sub(0, 0, 1, a).oval(0, 0, 50, 18, 'none', { outline: 'outer' });
      {
        sk.oval(0, 0, 10, 10, fill);
        return;
      }
    case 'house':
      sk.shape([-38, 46, -38, -4, 0, -44, 38, -4, 38, 46], fill, L);
      {
        sk.shape([-10, 46, -10, 18, 10, 18, 10, 46], 'ink', { outline: false });
        return;
      }
    case 'figure':
      sk.oval(0, -34, 14, 14, fill, { outline: false });
      {
        sk.shape([-26, 50, -24, -4, -12, -16, 12, -16, 24, -4, 26, 50], fill, {
          outline: false,
        });
        return;
      }
  }
}
