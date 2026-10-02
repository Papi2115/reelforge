/** `kit.props.lock` (padlock that unlocks: `lock.unlock(amount)`) and `kit.props.key`. */
import { z } from 'zod';
import { defineProp } from '../registry.js';
import {
  amountArg,
  asProp,
  colorField,
  DARKEST,
  GOLD,
  GOLD_DARK,
  gridPoint,
  METAL,
  pick,
  propShell,
  scaleParam,
  setAnchors,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

const BODY = [16, 13, 7] as const;
/** Shackle (front view): the long left leg stays in the body, the short right leg lifts out. */
const SHACKLE = [
  '...xxxxxx...',
  '..xxxxxxxx..',
  '.xxx....xxx.',
  '.xx......xx.',
  '.xx......xx.',
  '.xx......xx.',
  '.xx......xx.',
  '.xx......xx.',
  '.xx......xx.',
  '.xx......xx.',
  '.xx......xx.',
  '.xx.........',
  '.xx.........',
  '.xx.........',
];
/** How deep the long leg reaches into the body; the short leg ends 3 voxels higher. */
const LONG_LEG_DEPTH = 6;
const LIFT = 4;

export const lockParams = z.object({
  open: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe('0 locked .. 1 open (animate with lock.unlock)'),
  body: colorField('the body (default: brass)'),
  scale: scaleParam,
});

type LockSlot = 'body' | 'bodyDark' | 'hole' | 'metal';

export const lock = defineProp({
  name: 'lock',
  description:
    'Padlock (~0.5 units wide, 0.75 tall) with a brass body, keyhole and steel shackle. lock.unlock(amount): 0..0.5 lifts the shackle, 0.5..1 swings it open. For security, privacy, "locked out", hacks.',
  params: lockParams,
  anchors: { keyhole: 'the keyhole on the front' },
  methods: {
    'unlock(amount)': '0 locked .. 1 open (lift, then swing); set every frame when animating',
  },
  build(params, tools) {
    const colors = {
      body: pick(tools, params.body, GOLD),
      bodyDark: pick(tools, undefined, GOLD_DARK),
      hole: pick(tools, undefined, DARKEST),
      metal: pick(tools, undefined, METAL),
    };
    const body = new Sketch<LockSlot>(BODY, colors);
    body.box('body', [0, 0, 0], [16, 13, 7]);
    for (const x of [0, 15]) {
      for (const y of [0, 12]) body.box(null, [x, y, 0], [x + 1, y + 1, 7]);
    }
    body.paint('bodyDark', [0, 0, 0], [16, 1, 7]).paint('bodyDark', [0, 12, 0], [16, 13, 7]);
    body.pattern(['.xx.', 'xxxx', '.xx.', '.xx.', '.xx.', '.xx.'], { x: null }, 'xy', [6, 3, 6]);
    body.paint('hole', [6, 2, 5], [10, 9, 6]);
    const shackle = new Sketch<LockSlot>([12, SHACKLE.length, 2], colors);
    shackle
      .pattern(SHACKLE, { x: 'metal' }, 'xy', [0, 0, 0])
      .pattern(SHACKLE, { x: 'metal' }, 'xy', [0, 0, 1]);
    const shell = propShell(tools, 'lock', SMALL_VOXEL, params.scale);
    const bodyMesh = shell.mesh(body);
    const swing = tools.voxel.group();
    swing.position.set(...gridPoint(bodyMesh, [4, BODY[1] - LONG_LEG_DEPTH, 3.5]));
    swing.add(
      tools.voxel.mesh(shackle.model(tools.voxel), { voxelSize: SMALL_VOXEL, pivot: [2, 0, 1] }),
    );
    shell.object.add(swing);
    const restY = swing.position.y;
    const unlock = (amount: number): void => {
      const k = amountArg('lock.unlock(amount)', amount);
      swing.position.y = restY + Math.min(1, k * 2) * LIFT * SMALL_VOXEL;
      swing.rotation.y = Math.max(0, k * 2 - 1) * (Math.PI / 2);
    };
    unlock(params.open);
    setAnchors(shell.object, { keyhole: gridPoint(bodyMesh, [8, 6, 7]) });
    const methods: { unlock(amount: number): void } = { unlock };
    return asProp(shell.object, methods);
  },
});

const CLASSIC_KEY = [
  '..xxxxx.......................',
  '.xxxxxxx......................',
  'xxx...xxx.....................',
  'xx.....xxxxxxxxxxxxxxxxxxxxxxx',
  'xx.....xxxxxxxxxxxxxxxxxxxxxxx',
  'xxx...xxx..............xx.xxxx',
  '.xxxxxxx...............xx.xxxx',
  '..xxxxx................xx..xx.',
];
const MODERN_KEY = [
  'hhhhhhhh......................',
  'hhhhhhhhh.....................',
  'hh..hhhhhxxxxxxxxxxxxxxxxxxx..',
  'hh..hhhhhxxxxxxxxxxxxxxxxxxxxx',
  'hhhhhhhhhxx.xx.xxx.x.xx.xxxxx.',
  'hhhhhhhh......................',
];

export const keyParams = z.object({
  style: z
    .enum(['classic', 'modern'])
    .default('classic')
    .describe('classic (ring bow, bits) or modern (plastic head, cut blade)'),
  pose: z
    .enum(['upright', 'flat'])
    .default('upright')
    .describe('upright (faces +z, stands on its edge) or flat on a surface'),
  color: colorField('the metal (default: brass for classic, steel for modern)'),
  scale: scaleParam,
});

export const key = defineProp({
  name: 'key',
  description:
    'A key (~0.95 units long): classic brass key with a ring bow and bits, or a modern key with a plastic head. Upright facing the camera or lying flat. For access, passwords, solutions. Static.',
  params: keyParams,
  anchors: { bow: 'centre of the bow/head (where a hand holds it)', tip: 'tip of the blade' },
  build(params, tools) {
    const modern = params.style === 'modern';
    const rows = modern ? MODERN_KEY : CLASSIC_KEY;
    const sketch = new Sketch<'metal' | 'head'>([30, rows.length, 2], {
      metal: pick(tools, params.color, modern ? METAL : GOLD),
      head: pick(tools, undefined, DARKEST),
    });
    for (const z of [0, 1]) sketch.pattern(rows, { x: 'metal', h: 'head' }, 'xy', [0, 0, z]);
    const shell = propShell(tools, 'key', SMALL_VOXEL, params.scale);
    const inner = tools.voxel.group();
    const mesh = tools.voxel.mesh(sketch.model(tools.voxel), {
      voxelSize: SMALL_VOXEL,
      pivot: [15, 0, 1],
    });
    inner.add(mesh);
    if (params.pose === 'flat') {
      inner.rotation.x = -Math.PI / 2;
      inner.position.set(0, SMALL_VOXEL, (rows.length / 2) * SMALL_VOXEL);
    }
    shell.object.add(inner);
    inner.updateMatrix();
    const local = (point: readonly [number, number, number]) => {
      const vector = mesh.gridToLocal(point).applyMatrix4(inner.matrix);
      return [vector.x, vector.y, vector.z] as const;
    };
    setAnchors(shell.object, {
      bow: local([4, rows.length - 3.5, 2]),
      tip: local([30, rows.length - 4, 1]),
    });
    return asProp(shell.object, {});
  },
});
