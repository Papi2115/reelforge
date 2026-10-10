/**
 * The Apollo 11 places (PLAN.md#14.9): the eight sets of the C-CAM concept film 3 ported to Grim
 * Ink place modules (`examples/c-cam/apollo/places/<id>.js`). Each must pass the kit-ext lint of a
 * project place (0 diagnostics), load through the kit's own loader, keep its light and anchors
 * consistent with its bounds, carry the anchors where the film's shots stand people, and paint
 * the same strokes for the same t.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintInkModule } from '../../engine/src/index.js';
import { RecordingPaint } from '../src/worlds/c-cam/draw/recording-paint.js';
import { placeFromModule } from '../src/worlds/c-cam/modules/place.js';

const DIR = path.resolve(import.meta.dirname, '..', 'examples', 'c-cam', 'apollo', 'places');

/**
 * Anchor names per place: first a set feature in frame (the sheet's close framing centres on it),
 * then where the film's shots stand people (close shots: feet far below the frame).
 */
const EXPECTED_ANCHORS: Readonly<Record<string, readonly string[]>> = {
  title: ['moon', 'centre', 'left', 'right'],
  pad: ['window', 'centre', 'hatch', 'door'],
  lm: ['computer', 'leftStation', 'rightStation'],
  windowPov: ['crater', 'overShoulder'],
  panelWall: ['switches', 'foregroundLeft', 'foregroundRight'],
  control: ['chart', 'leftDesk', 'rightDesk', 'rowFarLeft', 'rowLeft', 'rowRight', 'rowFarRight'],
  cm: ['float', 'porthole'],
  surface: ['footpad', 'firstStep', 'print'],
};
const IDS = Object.keys(EXPECTED_ANCHORS);
/** Sets drawn without the stepped pool as `light` (title: it sits behind the moon in draw()). */
const NO_LIGHT = new Set(['title', 'windowPov']);
/** The sets overdraw the 1920x1080 frame by up to 400 px for camera moves and tilts. */
const MARGIN = 400;

async function load(id: string) {
  const file = path.join(DIR, `${id}.js`);
  const namespace: unknown = await import(pathToFileURL(file).href);
  return placeFromModule(namespace, `kit-ext/places/${id}.js`);
}

function paintOps(paint: RecordingPaint): number {
  return paint.calls.filter((call) => call.op === 'fill' || call.op === 'stroke').length;
}

describe('Apollo 11 places (C-CAM film 3 sets as place modules)', () => {
  it.each(IDS)('%s passes the kit-ext place lint with no diagnostics', (id) => {
    const source = readFileSync(path.join(DIR, `${id}.js`), 'utf8');
    expect(lintInkModule(source, { filename: `kit-ext/places/${id}.js` }, 'places')).toEqual([]);
    expect(source.split('\n').length).toBeLessThanOrEqual(250);
  });

  it.each(IDS)('%s loads with consistent bounds, light and anchors', async (id) => {
    const place = await load(id);
    expect(place.id).toBe(id);
    expect(place.bounds).toEqual([1920, 1080]);
    const [w, h] = place.bounds;
    if (NO_LIGHT.has(id)) expect(place.light).toBeUndefined();
    else {
      expect(place.light).toBeDefined();
      const light = place.light ?? { x: -1, y: -1 };
      expect(light.x).toBeGreaterThanOrEqual(0);
      expect(light.x).toBeLessThanOrEqual(w);
      expect(light.y).toBeGreaterThanOrEqual(0);
      expect(light.y).toBeLessThanOrEqual(h);
    }
    expect(Object.keys(place.anchors)).toEqual(EXPECTED_ANCHORS[id]);
    for (const [name, [x, y]] of Object.entries(place.anchors)) {
      expect(x, name).toBeGreaterThanOrEqual(-MARGIN);
      expect(x, name).toBeLessThanOrEqual(w + MARGIN);
      expect(y, name).toBeGreaterThanOrEqual(0);
      // Foreground figures in close shots stand with their feet far below the frame.
      expect(y, name).toBeLessThanOrEqual(2 * h);
    }
    for (const [x, y, bw, bh] of place.collide) {
      expect(x + bw).toBeGreaterThan(-MARGIN);
      expect(x).toBeLessThan(w + MARGIN);
      expect(y + bh).toBeGreaterThan(0);
      expect(y).toBeLessThan(h);
    }
  });

  it.each(IDS)('%s paints the same strokes for the same t', async (id) => {
    const place = await load(id);
    const first = new RecordingPaint();
    place.draw(first, undefined, 1.5);
    const again = new RecordingPaint();
    place.draw(again, undefined, 1.5);
    expect(paintOps(first)).toBeGreaterThan(40);
    expect(again.calls).toEqual(first.calls);
  });

  it('takes the shot options of the film sets (defaults = the 3-argument call)', async () => {
    const lines = async (id: string, opts?: Record<string, unknown>, front = false) => {
      const place = await load(id);
      const g = new RecordingPaint();
      const options = opts as Parameters<typeof place.draw>[3];
      if (front) place.foreground(g, undefined, 1.5, options);
      else place.draw(g, undefined, 1.5, options);
      return g.toLines();
    };
    const lm = await lines('lm');
    expect(await lines('lm', { scroll: 0, k: 1, boulders: 0, alarm: false })).toEqual(lm);
    for (const opts of [{ alarm: true }, { k: 0.6 }, { boulders: 30 }, { scroll: 140 }]) {
      expect(await lines('lm', opts), JSON.stringify(opts)).not.toEqual(lm);
    }
    expect(await lines('panelWall', { seed: 340 })).toEqual(await lines('panelWall'));
    expect(await lines('panelWall', { seed: 420 })).not.toEqual(await lines('panelWall'));
    const surface = await lines('surface');
    expect(await lines('surface', { lander: [1200, 780, 0.95] })).toEqual(surface);
    expect((await lines('surface', { lander: false })).length).toBeLessThan(surface.length);
    expect((await lines('surface', { flame: 0.8 })).length).toBeGreaterThan(surface.length);
    const front = await lines('control', {}, true);
    expect(front.length).toBeGreaterThan(40);
    expect((await lines('control', { smoke: false }, true)).length).toBeLessThan(front.length);
    for (const id of IDS) expect((await load(id)).hasForeground, id).toBe(id === 'control');
  });
});
