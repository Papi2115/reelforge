/**
 * Grim Ink instruments (PLAN.md#14.20): the registry of `env.ink.instruments.*` (and
 * `ink.instruments.*` in modules): controls a climax extreme close-up lands on, readouts, banks and
 * displays, plus the composite `console` (instruments-console.ts). State values (pull, turn, press,
 * value, flip, tick) are numbers the scene computes from t; words are the scene's `drawText` at the
 * returned label spots (the vocabulary never letters, so the text-provenance guard sees every word).
 */
import { checkedDraws } from './common.js';
import {
  drawCounter,
  drawFlipBoard,
  drawScreen,
  counterSchema,
  flipSchema,
  screenSchema,
} from './instruments-boards.js';
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
import { CONSOLE_ITEM } from './instruments-console.js';
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

/** Every instrument with its docs, options schema and drawing. */
export const INSTRUMENT_ITEMS = {
  lever: {
    doc: 'a pull lever in its slot (throttle, signal, brake): the climax pull',
    params: 'x, y = pivot; pull 0-1; size; tone (knob) = RED; seed',
    returns: 'points grip (the knob: reachPalm onto it), pivot; label',
    schema: leverSchema,
    draw: drawLever,
  },
  joystick: {
    doc: 'a control stick on its base, deflected by small calm moves; a trigger button on top',
    params: 'x, y = base centre; dx, dy -1..1; press 0-1; size; seed',
    returns: 'points grip (the palm closes over it), base, button',
    schema: joystickSchema,
    draw: drawJoystick,
  },
  dial: {
    doc: 'a knob with ticks or a valve wheel with spokes, turned',
    params: 'x, y = centre; r = 40; turn 0-1; kind knob|wheel; ticks; tone; seed',
    returns: 'points centre, grip (on the rim at the pointer); label',
    schema: dialSchema,
    draw: drawDial,
  },
  button: {
    doc: 'a push button (round, square, mushroom) in its plate, pressed, lit, under a lifting guard',
    params:
      'x, y = centre; r = 28; kind round|square|mushroom; press 0-1; lit; guard 0-1 (cover lifted; omit = no cover); tone = RED; seed',
    returns: 'points top (the fingertip target); label',
    schema: buttonSchema,
    draw: drawButton,
  },
  gauge: {
    doc: 'a round gauge: dial face, ticks, a red zone, the needle (trembles on twos)',
    params: 'x, y = centre; r = 80; value 0-1; zone low|high|none; tremble 0-1; t; seed',
    returns: 'points centre, needle; label (under the hub)',
    schema: gaugeSchema,
    draw: drawGauge,
  },
  switchPanel: {
    doc: 'a bank of toggle switches, a few under guards; one is flipped by a finger',
    params:
      'x, y = first switch; cols = 6, rows = 2, gap = 46; pattern "0110…" (else hashed); flip = index (-1 none); press 0-1 (the flip); guards 0-1; seed',
    returns: 'points target (the flipped switch), first; label',
    schema: switchSchema,
    draw: drawSwitches,
  },
  keypad: {
    doc: 'a grid of keys; one pressed, one lit',
    params:
      'x, y = top-left key; cols = 3, rows = 4; key = 60 px; press = index (-1); lit = index (-1); tone; seed',
    returns: 'points target (the pressed key); labels = one spot per key (drawText the digits)',
    schema: keypadSchema,
    draw: drawKeypad,
  },
  lights: {
    doc: 'status lights (round lamps or labelled blocks), blinking on twos',
    params:
      'x, y = first; n = 4; cols; size = 40; kind round|block; lit "1011…" (repeats); blink; rate (Hz); t; tone = RED; seed',
    returns: 'labels = one spot per light; light (a coloured pool) while any is on',
    schema: lightsSchema,
    draw: drawLights,
  },
  screen: {
    doc: 'a small dim screen: bars, a plot, a scope wave, a radar sweep',
    params:
      'x, y = top-left; w = 240, h = 160; kind bars|plot|radar|scope|blank; value 0-1; t; seed',
    returns: 'points centre; label (a readout spot)',
    schema: screenSchema,
    draw: drawScreen,
  },
  flipBoard: {
    doc: 'a framed board with one flipping panel showing up / down arrows (prices, scores, a verdict)',
    params:
      'x, y = panel centre; w = 260, h = 180; side up|down|blank; flip 0-1 (mid-turn at 0.5); tone; seed',
    returns: 'points panel; label = the header (drawText the word)',
    schema: flipSchema,
    draw: drawFlipBoard,
  },
  counter: {
    doc: 'a bead counter: frame, bar, rods with beads that hop when tick changes',
    params: 'x, y = centre; w = 220; rods = 7; tick (integer, e.g. floor(twos(t) * 3)); rot; seed',
    schema: counterSchema,
    draw: drawCounter,
  },
  console: CONSOLE_ITEM,
} as const;

/** `env.ink.instruments`: `(g, e, opts)` per instrument, options checked. */
export const INSTRUMENTS = checkedDraws('instruments', INSTRUMENT_ITEMS);
