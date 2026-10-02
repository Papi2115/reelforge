/**
 * `kit.props.laptop` and `kit.props.monitor`: computers with a palette-limited pixel screen
 * (text, code, chart, doom, glitch, blank). The laptop lid is hinged: `laptop.open(amount)`.
 */
import { z } from 'zod';
import type { KitTools } from '../registry.js';
import { defineProp } from '../registry.js';
import type { VoxelObject } from '../voxel/mesh.js';
import { createPixelScreen, displayColors, type PixelScreen } from './screen.js';
import { SCREEN_MODES } from './screen-content.js';
import {
  amountArg,
  asProp,
  colorField,
  DARK,
  DARKEST,
  gridPoint,
  METAL,
  pick,
  propShell,
  scaleParam,
  seedParam,
  setAnchors,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

/** Screen pixels per voxel. */
const DENSITY = 2;

const screenFields = {
  screen: z
    .enum(SCREEN_MODES)
    .default('code')
    .describe('Screen content: blank, text, doom, glitch, code (scrolling), chart (live bars)'),
  text: z
    .string()
    .max(80)
    .default('HELLO')
    .describe("Text of the text/glitch modes ('\\n' = new line)"),
  seed: seedParam,
  scale: scaleParam,
};

const screenMethods = {
  'screen.setMode(mode)': "'blank' | 'text' | 'doom' | 'glitch' | 'code' | 'chart'",
  'screen.setText(text)': 'screen text (centred, auto-sized)',
  'screen.glitch(amount)': 'glitch overlay 0..1; set every frame',
  'screen.power(on)': 'screen on/off (true/false or 0..1)',
  'update(t)': 'animates code/chart/doom/glitch; call every frame',
} as const;

interface ScreenPlacement {
  readonly name: string;
  /** Recess in voxels: width x height. */
  readonly size: readonly [number, number];
  readonly mode: (typeof SCREEN_MODES)[number];
  readonly text: string;
  readonly seed: number;
}

function screenOn(
  tools: KitTools,
  mesh: VoxelObject,
  placement: ScreenPlacement,
  centre: readonly [number, number, number],
) {
  const [width, height] = placement.size;
  const created = createPixelScreen(tools, {
    name: placement.name,
    width: width * DENSITY,
    height: height * DENSITY,
    pixelSize: SMALL_VOXEL / DENSITY,
    colors: displayColors(tools),
    mode: placement.mode,
    text: placement.text,
    align: 'center',
    seed: placement.seed,
  });
  created.mesh.position.set(...gridPoint(mesh, centre));
  return created;
}

export const laptopParams = z.object({
  ...screenFields,
  open: z
    .number()
    .min(0)
    .max(1)
    .default(1)
    .describe('Lid: 0 closed .. 1 open (animate with laptop.open)'),
  shell: colorField('the case'),
});

type LaptopSlot = 'shell' | 'deck' | 'key' | 'pad' | 'bezel' | 'logo';

const BASE = [40, 3, 28] as const;
const LID = [40, 27, 2] as const;
/** Lid angle (radians about x at the hinge): closed lies on the base, open leans back slightly. */
const LID_CLOSED = Math.PI / 2;
const LID_OPEN = -0.22;

export const laptop = defineProp({
  name: 'laptop',
  description:
    'Laptop (~1.25 units wide) with a hinged lid and a pixel screen (code, chart, text, doom, glitch). laptop.open(amount) swings the lid (0 closed, 1 open); laptop.screen controls the display.',
  params: laptopParams,
  anchors: {
    screen: 'centre of the screen (faces +z when open)',
    keyboard: 'centre of the keyboard',
  },
  methods: {
    'open(amount)': 'lid 0 (closed) .. 1 (open); set every frame when animating',
    ...screenMethods,
  },
  build(params, tools) {
    const colors = {
      shell: pick(tools, params.shell, METAL),
      deck: pick(tools, params.shell, METAL),
      key: pick(tools, undefined, DARKEST),
      pad: pick(tools, undefined, DARK),
      bezel: pick(tools, undefined, DARKEST),
      logo: 'hero',
    };
    const base = new Sketch<LaptopSlot>(BASE, colors);
    base.box('shell', [0, 0, 0], [40, 2, 28]).box('deck', [0, 2, 0], [40, 3, 28]);
    for (let z = 3; z < 18; z += 1) {
      for (let x = 3; x < 37; x += 1) {
        const gap = (x - 3) % 3 === 2 || (z - 3) % 3 === 2;
        base.set(gap ? null : 'key', x, 2, z);
      }
    }
    base.box('pad', [14, 2, 20], [26, 3, 26]);
    const lid = new Sketch<LaptopSlot>(LID, colors);
    lid.box('shell', [0, 0, 0], [40, 27, 1]).box('bezel', [0, 0, 1], [40, 27, 2]);
    lid.box(null, [2, 3, 1], [38, 25, 2]).paint('logo', [18, 12, 0], [22, 16, 1]);
    const shell = propShell(tools, 'laptop', SMALL_VOXEL, params.scale);
    const baseMesh = shell.mesh(base);
    const hinge = tools.voxel.group();
    hinge.position.set(...gridPoint(baseMesh, [20, 3, 0]));
    const lidMesh = tools.voxel.mesh(lid.model(tools.voxel), {
      voxelSize: SMALL_VOXEL,
      pivot: [20, 0, 2],
    });
    hinge.add(lidMesh);
    shell.object.add(hinge);
    const { screen, mesh } = screenOn(
      tools,
      lidMesh,
      {
        name: 'laptop.screen',
        size: [36, 22],
        mode: params.screen,
        text: params.text,
        seed: params.seed,
      },
      [20, 14, 1.15],
    );
    hinge.add(mesh);
    const open = (amount: number): void => {
      const k = amountArg('laptop.open(amount)', amount);
      hinge.rotation.x = LID_CLOSED + (LID_OPEN - LID_CLOSED) * k;
    };
    open(params.open);
    hinge.updateMatrix();
    const screenCentre = mesh.position.clone().applyMatrix4(hinge.matrix);
    setAnchors(shell.object, {
      screen: [screenCentre.x, screenCentre.y, screenCentre.z],
      keyboard: gridPoint(baseMesh, [20, 3, 10.5]),
    });
    const methods: { readonly screen: PixelScreen; open(amount: number): void } = { screen, open };
    return asProp(shell.object, methods, (t) => {
      screen.update(t);
    });
  },
});

export const monitorParams = z.object({
  ...screenFields,
  shell: colorField('the case and stand'),
});

type MonitorSlot = 'shell' | 'bezel' | 'stand' | 'led';

export const monitor = defineProp({
  name: 'monitor',
  description:
    'Desktop monitor on a stand (~1.5 units wide, 1.35 tall) with a pixel screen: code, chart, text, doom, glitch or blank. Control it through monitor.screen; call monitor.update(t) every frame.',
  params: monitorParams,
  anchors: { screen: 'centre of the screen (faces +z)' },
  methods: screenMethods,
  build(params, tools) {
    const sketch = new Sketch<MonitorSlot>([48, 43, 12], {
      shell: pick(tools, params.shell, DARK),
      bezel: pick(tools, undefined, DARKEST),
      stand: pick(tools, params.shell, DARK),
      led: { color: 'accent3', glow: true },
    });
    sketch.box('stand', [14, 0, 0], [34, 1, 12]).box('stand', [22, 1, 3], [26, 13, 5]);
    sketch.box('shell', [0, 12, 5], [48, 42, 7]).box('bezel', [0, 12, 7], [48, 42, 8]);
    sketch.box(null, [2, 15, 7], [46, 41, 8]).box('led', [43, 13, 7], [44, 14, 8]);
    const shell = propShell(tools, 'monitor', SMALL_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    const { screen, mesh } = screenOn(
      tools,
      body,
      {
        name: 'monitor.screen',
        size: [44, 26],
        mode: params.screen,
        text: params.text,
        seed: params.seed,
      },
      [24, 28, 7.15],
    );
    shell.object.add(mesh);
    setAnchors(shell.object, { screen: gridPoint(body, [24, 28, 7.15]) });
    const methods: { readonly screen: PixelScreen } = { screen };
    return asProp(shell.object, methods, (t) => {
      screen.update(t);
    });
  },
});
