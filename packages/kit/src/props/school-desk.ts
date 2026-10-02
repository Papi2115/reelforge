/**
 * `kit.props.bench`: a school/exam desk (wood top on a tubular steel frame, book shelf, front
 * modesty panel) with an optional chair behind it, facing the camera. Different from
 * `kit.env.desk` (office desk with drawers) and `kit.env.bench` (workbench with a vise).
 */
import { z } from 'zod';
import { WOOD, WOOD_ALT } from '../env/shared.js';
import { defineProp } from '../registry.js';
import {
  asProp,
  colorField,
  DARK,
  gridPoint,
  MEDIUM_VOXEL,
  METAL,
  pick,
  propShell,
  scaleParam,
  setAnchors,
} from './shared.js';
import { Sketch } from './sketch.js';

const WIDTH = 26;
const DESK_DEPTH = 16;
/** Chair depth behind the desk (grid z 0..CHAIR). */
const CHAIR = 10;
const TOP = 13;
const SEAT = 8;

export const benchParams = z.object({
  chair: z
    .boolean()
    .default(true)
    .describe('Chair behind the desk (a student would face the camera)'),
  wood: colorField('the desk top and seat'),
  frame: colorField('the steel frame'),
  scale: scaleParam,
});

type Slot = 'wood' | 'edge' | 'metal' | 'panel';

function desk(sketch: Sketch<Slot>, z0: number): void {
  const z1 = z0 + DESK_DEPTH;
  sketch
    .box('wood', [0, TOP, z0], [WIDTH, TOP + 1, z1])
    .paint('edge', [0, TOP, z1 - 1], [WIDTH, TOP + 1, z1]);
  sketch.box('panel', [2, 10, z0 + 1], [WIDTH - 2, 11, z1 - 2]);
  for (const x of [2, WIDTH - 3]) sketch.box('panel', [x, 10, z0 + 1], [x + 1, TOP, z1 - 2]);
  sketch.box('panel', [2, 5, z1 - 2], [WIDTH - 2, TOP, z1 - 1]);
  for (const x of [1, WIDTH - 2]) {
    for (const z of [z0 + 1, z1 - 2]) sketch.box('metal', [x, 0, z], [x + 1, TOP, z + 1]);
    sketch.box('metal', [x, 0, z0 + 1], [x + 1, 1, z1 - 1]);
  }
}

function chair(sketch: Sketch<Slot>): void {
  const [x0, x1] = [7, WIDTH - 7];
  sketch.box('wood', [x0, SEAT, 1], [x1, SEAT + 1, CHAIR + 1]);
  sketch.box('wood', [x0, SEAT + 3, 0], [x1, SEAT + 8, 1]);
  for (const x of [x0, x1 - 1]) {
    for (const z of [1, CHAIR]) sketch.box('metal', [x, 0, z], [x + 1, SEAT, z + 1]);
    sketch
      .box('metal', [x, SEAT + 1, 0], [x + 1, SEAT + 3, 1])
      .box('metal', [x, SEAT, 0], [x + 1, SEAT + 1, 2]);
  }
}

export const bench = defineProp({
  name: 'bench',
  description:
    'School/exam desk (~1.6 x 1 units, top 0.875 high) on a steel frame with a book shelf and a front panel, plus an optional chair behind it. Put props on it with prop.on(bench) or at spotLeft/spotRight. Static.',
  params: benchParams,
  anchors: {
    top: 'centre of the desk top (so prop.on(bench) stands on the desk, not the chair back)',
    spotLeft: 'on the desk top, left',
    spotRight: 'on the desk top, right',
    seat: 'top of the chair seat (when chair is true)',
  },
  build(params, tools) {
    const z0 = params.chair ? CHAIR : 0;
    const sketch = new Sketch<Slot>([WIDTH, Math.max(TOP + 1, SEAT + 8), z0 + DESK_DEPTH], {
      wood: pick(tools, params.wood, WOOD),
      edge: pick(tools, params.wood, WOOD_ALT),
      metal: pick(tools, params.frame, METAL),
      panel: pick(tools, undefined, DARK),
    });
    desk(sketch, z0);
    if (params.chair) chair(sketch);
    const shell = propShell(tools, 'bench', MEDIUM_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    const middle = z0 + DESK_DEPTH / 2;
    setAnchors(shell.object, {
      top: gridPoint(body, [WIDTH / 2, TOP + 1, middle]),
      spotLeft: gridPoint(body, [WIDTH / 4, TOP + 1, middle]),
      spotRight: gridPoint(body, [(3 * WIDTH) / 4, TOP + 1, middle]),
      seat: gridPoint(body, [WIDTH / 2, SEAT + 1, CHAIR / 2 + 1]),
    });
    return asProp(shell.object, {});
  },
});
