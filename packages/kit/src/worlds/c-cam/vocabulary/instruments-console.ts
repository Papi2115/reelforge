/**
 * Grim Ink instruments (PLAN.md#14.20): `console` — a desk, wall or pedestal console with N
 * elements laid out in slots (gauges, dials, switch banks, lights, keypads, screens, levers,
 * buttons, a joystick), each element taking the options of its own instrument (minus the place and
 * size, which the console works out). Generalised from `03-apollo-11/js/sets/sets-c.js` (console)
 * and `sets-b.js` (the centre panel); no film object by name.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import type { BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { rect, rough } from '../draw/scenery.js';
import {
  coord,
  seedSchema,
  toneOf,
  toneSchema,
  wearMarks,
  wearSchema,
  type Drawn,
  type LabelSpot,
} from './common.js';
import { drawScreen, screenSchema } from './instruments-boards.js';
import {
  buttonSchema,
  dialSchema,
  drawButton,
  drawDial,
  drawJoystick,
  drawLever,
  joystickSchema,
  leverSchema,
} from './instruments-controls.js';
import {
  drawGauge,
  drawKeypad,
  drawLights,
  drawSwitches,
  gaugeSchema,
  keypadSchema,
  lightsSchema,
  switchSchema,
} from './instruments-readouts.js';

const ELEMENT_TYPES = [
  'gauge',
  'dial',
  'switches',
  'lights',
  'keypad',
  'screen',
  'lever',
  'button',
  'joystick',
] as const;
type ElementType = (typeof ELEMENT_TYPES)[number];

const consoleSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(760),
  w: z.number().min(120).max(4000).default(800),
  h: z.number().min(80).max(2000).default(260),
  kind: z.enum(['desk', 'wall', 'pedestal']).default('desk'),
  elements: z
    .array(z.looseObject({ type: z.enum(ELEMENT_TYPES) }))
    .min(1)
    .max(12),
  tone: toneSchema.default('GREYBLUE'),
  wear: wearSchema,
  seed: seedSchema.default(950),
});

type ConsoleOptions = z.output<typeof consoleSchema>;

/** A slot: centre, width, height. */
interface Slot {
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
}

function placed(
  type: ElementType,
  slot: Slot,
  given: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const m = Math.min(slot.w, slot.h);
  const { cx, cy } = slot;
  const cols = typeof given['cols'] === 'number' ? given['cols'] : type === 'keypad' ? 3 : 3;
  const rows = typeof given['rows'] === 'number' ? given['rows'] : type === 'keypad' ? 4 : 2;
  const n = typeof given['n'] === 'number' ? given['n'] : 3;
  switch (type) {
    case 'gauge':
      return { x: cx, y: cy, r: m * 0.36 };
    case 'dial':
      return { x: cx, y: cy - m * 0.08, r: m * 0.22 };
    case 'button':
      return { x: cx, y: cy - m * 0.06, r: m * 0.18 };
    case 'lever':
      return { x: cx, y: cy + m * 0.32, size: m / 210 };
    case 'joystick':
      return { x: cx, y: cy + m * 0.45, size: m / 170 };
    case 'screen':
      return { x: cx - slot.w * 0.42, y: cy - slot.h * 0.36, w: slot.w * 0.84, h: slot.h * 0.66 };
    case 'switches': {
      const gap = Math.min(slot.w / (cols + 0.6), slot.h / (rows + 0.6));
      return { x: cx - ((cols - 1) * gap) / 2, y: cy - ((rows - 1) * gap) / 2, gap, cols, rows };
    }
    case 'keypad': {
      const key = Math.min(slot.w / (cols * 1.1 + 0.5), slot.h / (rows * 1.25 + 0.5));
      return {
        x: cx - (cols * key * 1.1) / 2 + key * 0.05,
        y: cy - (rows * key * 1.25) / 2 + key * 0.1,
        key,
      };
    }
    case 'lights': {
      const size = Math.min(slot.w / (n * 1.5), slot.h * 0.4);
      return { x: cx - ((n - 1) * size * 1.4) / 2, y: cy, size, n };
    }
  }
}

function element(
  g: Paint2D,
  e: BrushEnv,
  type: ElementType,
  options: Readonly<Record<string, unknown>>,
  index: number,
): Drawn {
  const parse = <S extends z.ZodType>(schema: S): z.output<S> => {
    const parsed = schema.safeParse(options);
    if (parsed.success) return parsed.data;
    const why = parsed.error.issues
      .map((i) => `${i.path.map(String).join('.')}: ${i.message}`)
      .join('; ');
    throw new KitError(
      'invalid-params',
      `env.ink.instruments.console: elements[${String(index)}] (${type}): ${why}; see reelforge kit-docs ink-instruments`,
    );
  };
  switch (type) {
    case 'gauge':
      return drawGauge(g, e, parse(gaugeSchema));
    case 'dial':
      return drawDial(g, e, parse(dialSchema));
    case 'switches':
      return drawSwitches(g, e, parse(switchSchema));
    case 'lights':
      return drawLights(g, e, parse(lightsSchema));
    case 'keypad':
      return drawKeypad(g, e, parse(keypadSchema));
    case 'screen':
      return drawScreen(g, e, parse(screenSchema));
    case 'lever':
      return drawLever(g, e, parse(leverSchema));
    case 'button':
      return drawButton(g, e, parse(buttonSchema));
    case 'joystick':
      return drawJoystick(g, e, parse(joystickSchema));
  }
}

/** The element's main point (where a hand goes or the eye lands). */
function focus(d: Drawn): Drawn['points'][string] | undefined {
  const p = d.points;
  return p['grip'] ?? p['target'] ?? p['top'] ?? p['needle'] ?? p['centre'] ?? p['first'];
}

function drawConsole(
  g: Paint2D,
  e: BrushEnv,
  o: ConsoleOptions,
): Drawn & { readonly elements: readonly Drawn[] } {
  const { x, y, w, h } = o;
  const [fill, shade] = toneOf(o.tone);
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const top = y - h;
  if (o.kind === 'desk') {
    rough(g, e, [x0 - 20, y, x1 + 20, y, x1 + 30, y + 190, x0 - 30, y + 190], shade, {
      seed: o.seed,
      lw: 6,
      hatch: { c: 'rgba(10,12,14,0.45)', n: 4, len: 60, gap: 8, k: 3, ang: 80 },
    });
  }
  const face =
    o.kind === 'desk'
      ? [x0 + 24, top, x1 - 24, top, x1, y, x0, y]
      : [x0, top, x1, top, x1, y, x0, y];
  rough(g, e, face, fill, {
    seed: o.seed + 1,
    lw: 7,
    shade: [shade, -16, 0],
    hatch: { c: 'rgba(10,12,14,0.35)', n: 4, len: 50, gap: 8, k: 3, ang: 80 },
  });
  if (o.kind !== 'desk') {
    g.fillStyle = 'rgba(25,24,20,0.6)';
    for (let i = 10; i < w - 10; i += 40) {
      g.fillRect(x0 + i, top + 8, 5, 5);
      g.fillRect(x0 + i, y - 13, 5, 5);
    }
  }
  if (o.kind === 'pedestal')
    rect(g, e, x - w * 0.3, y, w * 0.6, h * 0.9, shade, { seed: o.seed + 2, lw: 6 });
  const n = o.elements.length;
  const pad = 24;
  const slotW = (w - pad * 2) / n;
  const elements: Drawn[] = [];
  const points: Record<string, Drawn['points'][string]> = {};
  const labels: LabelSpot[] = [];
  o.elements.forEach((spec, i) => {
    const { type, ...rest } = spec;
    const slot: Slot = {
      cx: x0 + pad + (i + 0.5) * slotW,
      cy: top + h / 2,
      w: slotW,
      h: h - pad * 2,
    };
    const drawn = element(
      g,
      e,
      type,
      { seed: o.seed + 10 + i * 37, ...rest, ...placed(type, slot, rest) },
      i,
    );
    elements.push(drawn);
    const p = focus(drawn);
    if (p) points[`e${String(i)}`] = p;
    if (drawn.label) labels.push(drawn.label);
  });
  wearMarks(g, e, [x0, top, x1, y], o.wear, o.seed + 60);
  return {
    box: [
      x0 - 30,
      top,
      x1 + 30,
      y + (o.kind === 'desk' ? 190 : o.kind === 'pedestal' ? h * 0.9 : 0),
    ],
    points,
    labels,
    elements,
  };
}

export const CONSOLE_ITEM = {
  doc: 'a console (desk with a sloped face, wall panel, pedestal) with 1-12 instruments in slots: the room of controls, or the one control a climax lands on',
  params:
    "x, y = front edge centre (desk) / bottom centre; w = 800, h = 260; kind desk|wall|pedestal; elements: [{ type: gauge|dial|switches|lights|keypad|screen|lever|button|joystick, …that instrument's options without x, y, r, size (value, turn, pull, press, lit, blink, flip, t…) }]; tone = GREYBLUE; wear; seed",
  returns:
    "points e0, e1, … (each element's grip / target / needle); labels (each element's label spot); elements (every element's own result)",
  schema: consoleSchema,
  draw: drawConsole,
} as const;
