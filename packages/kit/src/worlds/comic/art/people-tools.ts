/**
 * Things a comic figure holds (art.person `tool`, PLAN.md#13.15a), drawn at the near hand in the
 * figure's model units. Each is its defining silhouette only (a lantern = a cage with a glow, an
 * axe = a haft and a wedge), so it still reads at thumbnail size.
 */
import type { Pose, Pt } from './people-pose.js';
import type { Sketch } from './sketch.js';

export const TOOLS = [
  'none',
  'staff',
  'lantern',
  'torch',
  'book',
  'phone',
  'sword',
  'flag',
  'binoculars',
  'briefcase',
  'axe',
  'basket',
  'clipboard',
  'magnifier',
  'shovel',
  'wrench',
  'cup',
  'fishing-rod',
] as const;
export type Tool = (typeof TOOLS)[number];

export function drawTool(
  sk: Sketch,
  tool: Tool,
  hand: Pt,
  color: string | undefined,
  pose: Pose,
): void {
  const [x, y] = hand;
  const wood = color ?? 'sepiaTan';
  const metal = color ?? 'greyLight';
  switch (tool) {
    case 'staff':
      sk.cap(x + 1, y - 34, x + 1, y + 44, 1.6, wood, { outline: 'inner' });
      return;
    case 'lantern':
      sk.line(x + 1, y, x + 1, y + 6);
      sk.shape([x - 4, y + 6, x + 6, y + 6, x + 7, y + 18, x - 5, y + 18], color ?? 'yellow', {
        outline: 'outer',
      });
      sk.line(x + 1, y + 6, x + 1, y + 18);
      sk.dot(x + 1, y + 12, 2.2, 'yellowPale');
      return;
    case 'torch':
      sk.cap(x, y + 10, x + 3, y - 12, 1.6, wood, { outline: 'inner' });
      sk.shape([x - 2, y - 12, x + 3, y - 26, x + 5, y - 17, x + 8, y - 13], 'yellow', {
        outline: 'inner',
      });
      sk.shape([x, y - 13, x + 3, y - 20, x + 6, y - 13], 'red', { outline: false });
      return;
    case 'book':
      sk.shape([x - 2, y - 7, x + 11, y - 9, x + 12, y + 4, x - 1, y + 6], color ?? 'red', {
        outline: 'outer',
      });
      sk.line(x + 1, y - 4, x + 9, y - 5, 'paper');
      return;
    case 'phone':
      sk.shape([x - 1, y - 9, x + 5, y - 9, x + 5, y + 2, x - 1, y + 2], 'ink', {
        outline: 'inner',
      });
      sk.flat([x, y - 8, x + 4, y - 8, x + 4, y, x, y], color ?? 'cyan');
      return;
    case 'sword':
      sk.shape([x, y - 4, x + 2, y - 4, x + 2.5, y - 40, x + 1, y - 44, x - 0.5, y - 40], metal, {
        outline: 'inner',
      });
      sk.cap(x - 5, y - 4, x + 7, y - 4, 1.2, 'aged', { outline: 'inner' });
      return;
    case 'flag':
      sk.cap(x + 1, y + 20, x + 1, y - 44, 1, 'greyDark', { outline: 'inner' });
      sk.shape(
        [x + 2, y - 44, x + 26, y - 39, x + 22, y - 33, x + 26, y - 26, x + 2, y - 28],
        color ?? 'red',
        { outline: 'outer' },
      );
      return;
    case 'binoculars':
      sk.cap(x, y - 3, x + 8, y - 4, 2.8, metal === 'greyLight' ? 'greyDark' : metal, {
        outline: 'inner',
      });
      sk.cap(x, y + 3, x + 8, y + 2, 2.8, metal === 'greyLight' ? 'greyDark' : metal, {
        outline: 'inner',
      });
      return;
    case 'briefcase':
      sk.shape([x - 9, y + 4, x + 9, y + 4, x + 9, y + 18, x - 9, y + 18], color ?? 'sepiaMid', {
        outline: 'outer',
        shade: 0.4,
      });
      sk.stroke([x - 3, y + 4, x - 3, y + 1, x + 3, y + 1, x + 3, y + 4]);
      return;
    case 'axe':
      sk.cap(x + 1, y + 16, x + 1, y - 26, 1.4, wood, { outline: 'inner' });
      sk.shape([x + 1, y - 26, x + 11, y - 30, x + 12, y - 16, x + 1, y - 19], metal, {
        outline: 'outer',
      });
      return;
    case 'basket':
      sk.shape([x - 10, y + 6, x + 10, y + 6, x + 7, y + 18, x - 7, y + 18], color ?? 'aged', {
        outline: 'outer',
        hatch: { gap: 3, angle: 0.6, color: 'sepiaMid' },
      });
      sk.stroke([x - 8, y + 6, x - 3, y - 2, x + 3, y - 2, x + 8, y + 6]);
      return;
    case 'clipboard':
      sk.shape([x - 2, y - 14, x + 12, y - 15, x + 13, y + 4, x - 1, y + 5], 'sepiaTan', {
        outline: 'outer',
      });
      sk.flat([x, y - 12, x + 11, y - 13, x + 11, y + 2, x + 1, y + 3], 'paper');
      for (let i = 0; i < 3; i += 1)
        sk.line(x + 2, y - 8 + i * 4, x + 9, y - 8.5 + i * 4, 'greyMid');
      return;
    case 'magnifier':
      sk.cap(x, y + 2, x + 6, y - 6, 1.4, 'sepiaMid', { outline: 'inner' });
      sk.oval(x + 10, y - 11, 5.5, 5.5, 'cyan', { outline: 'outer' });
      sk.stroke([x + 7, y - 13, x + 9, y - 15], { color: 'paper' });
      return;
    case 'shovel':
      sk.cap(x + 1, y - 18, x + 1, y + 30, 1.3, wood, { outline: 'inner' });
      sk.shape([x - 5, y + 30, x + 7, y + 30, x + 6, y + 42, x + 1, y + 45, x - 4, y + 42], metal, {
        outline: 'outer',
      });
      return;
    case 'wrench':
      sk.cap(x, y + 4, x + 10, y - 10, 1.8, metal, { outline: 'inner' });
      sk.shape(
        [x + 8, y - 10, x + 11, y - 16, x + 15, y - 14, x + 12, y - 11, x + 14, y - 8],
        metal,
        { outline: 'inner' },
      );
      return;
    case 'cup':
      sk.shape([x - 1, y - 6, x + 8, y - 6, x + 7, y + 3, x, y + 3], color ?? 'paper', {
        outline: 'outer',
      });
      sk.stroke([x + 8, y - 4, x + 11, y - 2, x + 8, y + 1]);
      return;
    case 'fishing-rod': {
      const tipX = pose === 'hold' ? x + 46 : x + 30;
      sk.stroke([x - 6, y + 8, tipX, y - 36], { w: 'inner', color: wood });
      sk.stroke([tipX, y - 36, tipX + 2, y + 30], { color: 'greyMid' });
      return;
    }
    case 'none':
      return;
  }
}
