/**
 * `kit.props.server`: a server rack (taller than the hero) of 1U servers and disk shelves with
 * blinking status LEDs. LEDs are pixel quads in small sockets; `server.blink(t)` (or update(t))
 * switches them as a pure function of t, `server.alarm(amount)` turns them into a red alert.
 */
import { z } from 'zod';
import { hashCell } from '../env/shared.js';
import { defineProp } from '../registry.js';
import { createPixelPanel } from './pixel-panel.js';
import {
  amountArg,
  asProp,
  colorField,
  DARK,
  DARKEST,
  finiteArg,
  gridPoint,
  MEDIUM_VOXEL,
  METAL,
  pick,
  propShell,
  RED,
  scaleParam,
  seedParam,
  setAnchors,
} from './shared.js';
import { Sketch } from './sketch.js';

const WIDTH = 22;
const DEPTH = 16;
const UNIT = 4;
const LEDS_PER_UNIT = 3;

export const serverParams = z.object({
  units: z
    .number()
    .int()
    .min(2)
    .max(12)
    .default(8)
    .describe('Number of rack units (each 0.25 units tall)'),
  blinkRate: z.number().min(0).max(20).default(2).describe('Average LED blinks per second'),
  frame: colorField('the rack frame'),
  seed: seedParam,
  scale: scaleParam,
});

type Slot = 'frame' | 'panel' | 'vent' | 'drive' | 'slit' | 'inside';

/** LED colour numbers in the panel: 0 off, 1 status, 2 activity, 3 warning, 4 alarm. */
const LED_OFF = 0;
const LED_ALARM = 4;

export const server = defineProp({
  name: 'server',
  description:
    'Server rack (~1.4 units wide, 2.25 tall with 8 units: taller than the hero) of 1U servers and disk shelves with blinking LEDs. Call server.update(t) (= blink(t)) every frame; server.alarm(amount) makes every LED flash the alert colour.',
  params: serverParams,
  anchors: { face: 'centre of the front panel' },
  methods: {
    'blink(t)': 'poses the LEDs for time t (seeded rhythm); update(t) calls it',
    'alarm(amount)': 'amount >= 0.5: every LED flashes the alert colour in sync; set every frame',
  },
  build(params, tools) {
    const height = 3 + params.units * UNIT;
    const sketch = new Sketch<Slot>([WIDTH, height, DEPTH], {
      frame: pick(tools, params.frame, DARK),
      panel: pick(tools, undefined, METAL),
      vent: pick(tools, undefined, DARKEST),
      drive: pick(tools, undefined, DARK),
      slit: pick(tools, undefined, METAL),
      inside: pick(tools, undefined, DARKEST),
    });
    sketch.box('frame', [0, 0, 0], [WIDTH, height, DEPTH]);
    sketch.box('inside', [2, 2, 1], [WIDTH - 2, height - 1, DEPTH - 1]);
    const cells: (readonly [number, number])[] = [];
    for (let unit = 0; unit < params.units; unit += 1) {
      const y0 = 2 + unit * UNIT;
      sketch.box('panel', [2, y0, DEPTH - 2], [WIDTH - 2, y0 + UNIT - 1, DEPTH]);
      sketch.box(null, [2, y0 + UNIT - 1, DEPTH - 1], [WIDTH - 2, y0 + UNIT, DEPTH]);
      const middle = y0 + 1;
      if (unit % 3 === 1) {
        for (let bay = 0; bay < 4; bay += 1) {
          const x0 = 8 + bay * 3;
          sketch.paint('drive', [x0, y0, DEPTH - 1], [x0 + 2, y0 + UNIT - 1, DEPTH]);
          sketch.paint('slit', [x0, middle + 1, DEPTH - 1], [x0 + 2, middle + 2, DEPTH]);
        }
      } else {
        for (let x = 9; x < WIDTH - 3; x += 2)
          sketch.paint('vent', [x, middle, DEPTH - 1], [x + 1, middle + 2, DEPTH]);
      }
      for (let led = 0; led < LEDS_PER_UNIT; led += 1) {
        const x = 3 + led * 2;
        sketch.box(null, [x, middle, DEPTH - 1], [x + 1, middle + 1, DEPTH]);
        cells.push([x, middle]);
      }
    }
    const shell = propShell(tools, 'server', MEDIUM_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    const panel = createPixelPanel(tools, {
      name: 'server.leds',
      cells,
      pixelSize: MEDIUM_VOXEL,
      colors: [
        pick(tools, undefined, DARKEST),
        { color: 'accent3', glow: true },
        { color: 'accent1', glow: true },
        { color: 'hero', glow: true },
        { color: pick(tools, undefined, RED), glow: true },
      ],
    });
    panel.mesh.position.set(...gridPoint(body, [0, 0, DEPTH - 1 + 0.15]));
    shell.object.add(panel.mesh);
    setAnchors(shell.object, { face: gridPoint(body, [WIDTH / 2, height / 2, DEPTH]) });
    const leds = new Uint8Array(cells.length);
    let alarmOn = false;
    let time = 0;
    const pose = (): void => {
      for (let index = 0; index < leds.length; index += 1) {
        if (alarmOn) {
          leds[index] = Math.floor(time * 4) % 2 === 0 ? LED_ALARM : LED_OFF;
          continue;
        }
        const kind = 1 + Math.floor(hashCell(index, 0, 1, params.seed) * 3);
        const rate = params.blinkRate * (0.4 + hashCell(index, 0, 2, params.seed) * 1.2);
        const phase = hashCell(index, 0, 3, params.seed);
        const steady = kind === 1 && hashCell(index, 0, 4, params.seed) < 0.5;
        const lit = steady || (time * rate + phase) % 1 < 0.55;
        leds[index] = lit ? kind : LED_OFF;
      }
      panel.paint(leds);
    };
    const blink = (t: number): void => {
      time = finiteArg('server.blink(t)', t);
      pose();
    };
    const alarm = (amount: number): void => {
      const next = amountArg('server.alarm(amount)', amount) >= 0.5;
      if (next === alarmOn) return;
      alarmOn = next;
      pose();
    };
    pose();
    const methods: { blink(t: number): void; alarm(amount: number): void } = { blink, alarm };
    return asProp(shell.object, methods, blink);
  },
});
