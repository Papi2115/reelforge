/**
 * `kit.props.calculator`: the desk calculator of the reference video - a dark body with a raised
 * display housing, a 4x5 keypad (operator column in the hero colour) and a palette-limited LCD
 * that shows text, a tiny corridor shooter ("doom"), static or a glitch.
 */
import { z } from 'zod';
import { defineProp } from '../registry.js';
import { createPixelScreen, type PixelScreen, type ScreenColors } from './screen.js';
import type { ScreenMode } from './screen-content.js';
import {
  asProp,
  colorField,
  DARK,
  DARKEST,
  GREEN,
  gridPoint,
  METAL,
  pick,
  propShell,
  scaleParam,
  seedParam,
  setAnchors,
  SEA,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

const CALCULATOR_MODES = [
  'blank',
  'text',
  'doom',
  'glitch',
] as const satisfies readonly ScreenMode[];
const WIDTH = 26;
const HEIGHT = 5;
const DEPTH = 44;
/** First keypad row (grid z). */
const KEYS_Z = 19;
/** Screen recess (grid): x 2..24, z 3..15, floor at y = 4. */
const SCREEN = { x0: 2, x1: 24, z0: 3, z1: 15, floor: 4 } as const;
/** LCD pixels per voxel. */
const LCD_DENSITY = 2;

export const calculatorParams = z.object({
  screen: z
    .enum(CALCULATOR_MODES)
    .default('text')
    .describe('LCD content: blank, text (right-aligned), doom (tiny animated shooter), glitch'),
  text: z
    .string()
    .max(40)
    .default('0')
    .describe('LCD text in text/glitch modes, e.g. "61 KB" (A-Z 0-9 . , : - + = % $ / ! ?)'),
  body: colorField('the body'),
  keys: colorField('the number keys'),
  operators: z.string().default('hero').describe('Palette name of the operator keys column'),
  seed: seedParam,
  scale: scaleParam,
});

type Slot = 'body' | 'trim' | 'glass' | 'key' | 'keyFn' | 'keyOp' | 'legend';

function keypad(sketch: Sketch<Slot>): void {
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const x0 = 2 + column * 6;
      const z0 = KEYS_Z + row * 5;
      const equals = column === 3 && row >= 3;
      if (equals && row === 4) continue;
      const z1 = equals ? z0 + 8 : z0 + 3;
      const slot: Slot = column === 3 ? 'keyOp' : row === 0 ? 'keyFn' : 'key';
      sketch.box(slot, [x0, 3, z0], [x0 + 4, 4, z1]);
      if (equals) {
        sketch.paint('legend', [x0 + 1, 3, z0 + 3], [x0 + 3, 4, z0 + 4]);
        sketch.paint('legend', [x0 + 1, 3, z0 + 5], [x0 + 3, 4, z0 + 6]);
      } else {
        sketch.paint('legend', [x0 + 1, 3, z0 + 1], [x0 + 3, 4, z0 + 2]);
      }
    }
  }
}

export const calculator = defineProp({
  name: 'calculator',
  description:
    'Desk calculator (~0.8 x 1.4 units, lies flat) with a raised LCD and a 4x5 keypad. The LCD shows text, a tiny animated shooter (doom), static or a glitch: calc.screen.setMode/setText/glitch(amount)/power(on); call calc.update(t) every frame for animated modes.',
  params: calculatorParams,
  anchors: {
    screen: 'centre of the LCD surface (faces up)',
    keypad: 'centre of the keypad, on the keys',
  },
  methods: {
    'screen.setMode(mode)': "LCD mode: 'blank' | 'text' | 'doom' | 'glitch'",
    'screen.setText(text)': 'LCD text (right-aligned, auto-sized)',
    'screen.glitch(amount)': 'glitch overlay 0..1 on any mode; set every frame',
    'screen.power(on)': 'LCD on/off (true/false or 0..1)',
    'update(t)': 'animates doom/glitch; call every frame',
  },
  build(params, tools) {
    const sketch = new Sketch<Slot>([WIDTH, HEIGHT, DEPTH], {
      body: pick(tools, params.body, DARK),
      trim: pick(tools, undefined, DARKEST),
      glass: pick(tools, undefined, DARKEST),
      key: pick(tools, params.keys, METAL),
      keyFn: pick(tools, undefined, DARKEST),
      keyOp: params.operators,
      legend: pick(tools, undefined, DARKEST),
    });
    sketch.box('body', [0, 0, 0], [WIDTH, 3, DEPTH]).box('trim', [0, 0, 0], [WIDTH, 1, DEPTH]);
    for (const [x, z] of [
      [0, 0],
      [WIDTH - 1, 0],
      [0, DEPTH - 1],
      [WIDTH - 1, DEPTH - 1],
    ] as const) {
      sketch.box(null, [x, 0, z], [x + 1, 3, z + 1]);
    }
    sketch.box('body', [1, 3, 1], [WIDTH - 1, HEIGHT, SCREEN.z1 + 2]);
    sketch.box(null, [SCREEN.x0, SCREEN.floor, SCREEN.z0], [SCREEN.x1, HEIGHT, SCREEN.z1]);
    sketch.paint(
      'glass',
      [SCREEN.x0, SCREEN.floor - 1, SCREEN.z0],
      [SCREEN.x1, SCREEN.floor, SCREEN.z1],
    );
    keypad(sketch);
    const shell = propShell(tools, 'calculator', SMALL_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    const lcd: ScreenColors = {
      off: pick(tools, undefined, SEA),
      back: pick(tools, undefined, GREEN),
      ink: pick(tools, undefined, ['slateBlue', 'tealDark', 'night', 'shadow']),
      hot: pick(tools, undefined, ['slateBlue', 'tealDark', 'night', 'shadow']),
      cool: pick(tools, undefined, SEA),
      dim: pick(tools, undefined, ['brightTeal', 'teal', 'sage', 'accent1']),
    };
    const { screen, mesh } = createPixelScreen(tools, {
      name: 'calculator.screen',
      width: (SCREEN.x1 - SCREEN.x0) * LCD_DENSITY,
      height: (SCREEN.z1 - SCREEN.z0) * LCD_DENSITY,
      pixelSize: SMALL_VOXEL / LCD_DENSITY,
      colors: lcd,
      mode: params.screen,
      text: params.text,
      align: 'right',
      seed: params.seed,
      modes: CALCULATOR_MODES,
    });
    const centre = gridPoint(body, [WIDTH / 2, SCREEN.floor + 0.15, (SCREEN.z0 + SCREEN.z1) / 2]);
    mesh.position.set(...centre);
    mesh.rotation.x = -Math.PI / 2;
    shell.object.add(mesh);
    setAnchors(shell.object, {
      screen: centre,
      keypad: gridPoint(body, [WIDTH / 2, 4, KEYS_Z + 12]),
    });
    const methods: { readonly screen: PixelScreen } = { screen };
    return asProp(shell.object, methods, (t) => {
      screen.update(t);
    });
  },
});
