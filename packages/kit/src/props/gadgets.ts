/** `kit.props.phone` (smartphone with a pixel screen) and `kit.props.usbStick`. */
import { z } from 'zod';
import { defineProp } from '../registry.js';
import { createPixelScreen, displayColors, type PixelScreen } from './screen.js';
import { SCREEN_MODES } from './screen-content.js';
import {
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

const PHONE = [15, 30, 3] as const;
const DENSITY = 2;

export const phoneParams = z.object({
  pose: z
    .enum(['standing', 'flat'])
    .default('standing')
    .describe('standing (screen faces +z) or flat on a surface (screen up)'),
  screen: z
    .enum(SCREEN_MODES)
    .default('text')
    .describe('Screen content: text (lock-screen clock), blank, doom, glitch, code, chart'),
  text: z.string().max(40).default('12:45').describe('Text of the text/glitch modes'),
  on: z.boolean().default(true).describe('Screen initially on'),
  shell: colorField('the case'),
  seed: seedParam,
  scale: scaleParam,
});

type PhoneSlot = 'shell' | 'bezel' | 'camera' | 'lens' | 'slit';

export const phone = defineProp({
  name: 'phone',
  description:
    'Smartphone (~0.45 x 0.95 units), standing or lying flat, with a pixel screen (lock-screen clock text by default). phone.screenOn(on) wakes/darkens it; phone.screen controls the content.',
  params: phoneParams,
  anchors: { screen: 'centre of the screen surface' },
  methods: {
    'screenOn(on)': 'screen on/off (true/false or 0..1); set every frame when animating',
    'screen.setMode(mode)': "'blank' | 'text' | 'doom' | 'glitch' | 'code' | 'chart'",
    'screen.setText(text)': 'screen text (centred)',
    'screen.glitch(amount)': 'glitch overlay 0..1',
    'update(t)': 'animates the screen; call every frame',
  },
  build(params, tools) {
    const sketch = new Sketch<PhoneSlot>(PHONE, {
      shell: pick(tools, params.shell, DARK),
      bezel: pick(tools, undefined, DARKEST),
      camera: pick(tools, undefined, DARKEST),
      lens: pick(tools, undefined, METAL),
      slit: pick(tools, undefined, DARK),
    });
    sketch.box('shell', [0, 0, 1], [15, 30, 2]).box('bezel', [0, 0, 2], [15, 30, 3]);
    for (const [x, y] of [
      [0, 0],
      [14, 0],
      [0, 29],
      [14, 29],
    ] as const)
      sketch.box(null, [x, y, 1], [x + 1, y + 1, 3]);
    sketch.box(null, [1, 2, 2], [14, 28, 3]).paint('slit', [6, 28, 2], [9, 29, 3]);
    sketch.box('camera', [2, 24, 0], [6, 28, 1]).paint('lens', [3, 26, 0], [4, 27, 1]);
    const shell = propShell(tools, 'phone', SMALL_VOXEL, params.scale);
    const inner = tools.voxel.group();
    const body = tools.voxel.mesh(sketch.model(tools.voxel), {
      voxelSize: SMALL_VOXEL,
      pivot: 'center',
    });
    inner.add(body);
    const { screen, mesh } = createPixelScreen(tools, {
      name: 'phone.screen',
      width: 13 * DENSITY,
      height: 26 * DENSITY,
      pixelSize: SMALL_VOXEL / DENSITY,
      colors: displayColors(tools),
      mode: params.screen,
      text: params.text,
      align: 'center',
      seed: params.seed,
    });
    mesh.position.set(...gridPoint(body, [7.5, 15, 2.15]));
    inner.add(mesh);
    if (params.pose === 'flat') {
      inner.rotation.x = -Math.PI / 2;
      inner.position.y = 1.5 * SMALL_VOXEL;
    } else {
      inner.position.y = 15 * SMALL_VOXEL;
    }
    shell.object.add(inner);
    inner.updateMatrix();
    const centre = mesh.position.clone().applyMatrix4(inner.matrix);
    setAnchors(shell.object, { screen: [centre.x, centre.y, centre.z] });
    screen.power(params.on);
    const methods: { readonly screen: PixelScreen; screenOn(on: boolean | number): void } = {
      screen,
      screenOn: (on) => {
        screen.power(on);
      },
    };
    return asProp(shell.object, methods, (t) => {
      screen.update(t);
    });
  },
});

export const usbStickParams = z.object({
  body: z.string().default('hero').describe('Palette name of the plastic body'),
  scale: scaleParam,
});

type UsbSlot = 'body' | 'metal' | 'slit' | 'label' | 'led';

export const usbStick = defineProp({
  name: 'usbStick',
  description:
    'USB flash drive (~0.25 x 0.75 units, lies flat, connector towards +z) with a key loop, a label and a status LED. For data theft/leak and "the files" beats. Static.',
  params: usbStickParams,
  anchors: { connector: 'tip of the connector', label: 'centre of the label' },
  build(params, tools) {
    const sketch = new Sketch<UsbSlot>([8, 3, 24], {
      body: params.body,
      metal: pick(tools, undefined, METAL),
      slit: pick(tools, undefined, DARKEST),
      label: 'heroTrim',
      led: { color: 'accent1', glow: true },
    });
    sketch.box('body', [2, 0, 0], [6, 1, 4]).box(null, [3, 0, 1], [5, 1, 3]);
    sketch.box('body', [0, 0, 3], [8, 3, 18]);
    for (const x of [0, 7]) sketch.box(null, [x, 0, 3], [x + 1, 3, 4]);
    sketch.paint('label', [1, 2, 8], [7, 3, 15]).paint('led', [3, 2, 4], [5, 3, 6]);
    sketch.box('metal', [1, 0, 18], [7, 2, 24]);
    sketch.paint('slit', [2, 1, 20], [3, 2, 22]).paint('slit', [5, 1, 20], [6, 2, 22]);
    const shell = propShell(tools, 'usbStick', SMALL_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    setAnchors(shell.object, {
      connector: gridPoint(body, [4, 1, 24]),
      label: gridPoint(body, [4, 3, 11.5]),
    });
    return asProp(shell.object, {});
  },
});
