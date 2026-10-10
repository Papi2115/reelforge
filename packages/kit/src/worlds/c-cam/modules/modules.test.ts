import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { createKit } from '../../../kit.js';
import { CRISP_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { characterSchema } from '../draw/character.js';
import { RecordingPaint } from '../draw/recording-paint.js';
import { C_CAM_ID } from '../style.js';
import { personDataSchema, placeDataSchema } from './contract.js';
import { definePerson, personFromModule } from './person.js';
import { definePlace, placeFromModule } from './place.js';
import { createInkModulesApi, NO_INK_MODULES } from './registry.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'examples', 'c-cam');

async function exampleNamespace(kind: 'people' | 'places', id: string): Promise<unknown> {
  const namespace: unknown = await import(
    pathToFileURL(path.join(EXAMPLES, kind, `${id}.js`)).href
  );
  return namespace;
}

async function samples() {
  const person = personFromModule(
    await exampleNamespace('people', 'nightBaker'),
    'kit-ext/people/nightBaker.js',
  );
  const place = placeFromModule(
    await exampleNamespace('places', 'bakeryBackRoom'),
    'kit-ext/places/bakeryBackRoom.js',
  );
  return { person, place };
}

function recordedOps(paint: RecordingPaint): number {
  return paint.calls.filter((call) => call.op === 'fill' || call.op === 'stroke').length;
}

describe('Grim Ink project modules (PLAN.md#14.8)', () => {
  it('loads the sample person as a rig character and draws it', async () => {
    const { person } = await samples();
    expect(person).toMatchObject({ kind: 'person', id: 'nightBaker', name: 'The Night Baker' });
    expect(characterSchema.safeParse(person.character).success).toBe(true);
    expect(person.D.hsz).toBe(34);
    const g = new RecordingPaint();
    const joints = person.draw(g, { t: 0.4 }, { x: 900, y: 1000, s: 0.5, view: 'three-quarter' });
    expect(joints.aL).toBeDefined();
    expect(recordedOps(g)).toBeGreaterThan(40);
    const again = new RecordingPaint();
    person.draw(again, { t: 0.4 }, { x: 900, y: 1000, s: 0.5, view: 'three-quarter' });
    expect(again.calls).toEqual(g.calls);
    expect(person.pose('walk', 0.5).fL).toHaveLength(3);
  });

  it('explains bad views, poses and times', async () => {
    const { person } = await samples();
    const g = new RecordingPaint();
    expect(() => person.draw(g, undefined, { view: 'side' as never })).toThrow(
      /view must be one of front, three-quarter, profile, back/,
    );
    expect(() => person.draw(g, undefined, { pose: 'dance' as never })).toThrow(
      /pose must be a pose name \(stand, akimbo/,
    );
    expect(() => person.draw(g, undefined, { t: Number.NaN })).toThrow(/finite time/);
  });

  it('loads the sample place with its light, anchors and boxes', async () => {
    const { place } = await samples();
    expect(place.bounds).toEqual([2200, 1080]);
    expect(place.anchor('oven')).toEqual([1500, 910]);
    expect(() => place.anchor('door')).toThrow(/defined: table, oven, sacks/);
    const lit = new RecordingPaint();
    place.draw(lit, undefined, 1);
    const dark = new RecordingPaint();
    place.draw(dark, undefined, 1, { light: false });
    expect(lit.calls.length).toBeGreaterThan(dark.calls.length);
    expect(recordedOps(dark)).toBeGreaterThan(30);
  });

  it('paints every sheet page deterministically', async () => {
    const { person, place } = await samples();
    for (const page of [0, 1]) {
      const first = new RecordingPaint();
      person.sheet(first, page);
      const second = new RecordingPaint();
      person.sheet(second, page);
      expect(second.calls).toEqual(first.calls);
      expect(recordedOps(first)).toBeGreaterThan(200);
    }
    for (const page of [0, 1, 2]) {
      const paint = new RecordingPaint();
      place.sheet(paint, page);
      expect(recordedOps(paint)).toBeGreaterThan(30);
    }
  });

  it('rejects modules that break the contract', async () => {
    const namespace = (await exampleNamespace('people', 'nightBaker')) as {
      person: Record<string, unknown>;
    };
    const headless = { ...namespace.person, head: undefined };
    expect(() => definePerson(headless, 'kit-ext/people/x.js')).toThrow(
      /kit-ext\/people\/x\.js: `export const person` is invalid \(head: head must be a function/,
    );
    expect(() => definePerson({ ...namespace.person, id: 'night-baker' })).toThrow(/camelCase/);
    expect(() => personFromModule({}, 'kit-ext/people/x.js')).toThrow(
      /missing `export const person/,
    );
    expect(() =>
      definePlace({ id: 'room', name: 'Room', bounds: [100, 1080], draw: () => undefined }),
    ).toThrow(/bounds/);
    expect(() => placeFromModule({ place: 1 }, 'kit-ext/places/x.js')).toThrow(KitError);
  });

  it('validates the data parts on their own (lint reads them statically)', () => {
    expect(
      placeDataSchema.safeParse({ id: 'room', name: 'Room', bounds: [1920, 1080] }).success,
    ).toBe(true);
    expect(
      placeDataSchema.safeParse({ id: 'room', name: 'Room', bounds: [1920, 1080], extra: 1 })
        .success,
    ).toBe(false);
    expect(personDataSchema.safeParse({ id: 'x', name: 'X' }).success).toBe(false);
  });

  it('binds kit.people / kit.places in c-cam shots only, with helpful unknown ids', async () => {
    const { person, place } = await samples();
    const options = { three: THREE, palette: CRISP_PALETTE, rng: testRng(3) };
    const voxel = createKit(options);
    expect(voxel.api.people).toBeUndefined();
    const ink = createKit({
      ...options,
      style: C_CAM_ID,
      inkModules: { people: [person], places: [place] },
    });
    const people = ink.api.people ?? {};
    expect(Object.keys(people)).toEqual(['nightBaker']);
    expect(people['nightBaker']).toBe(person);
    expect(people['night-baker']).toBe(person);
    expect(() => people['nightBakr']).toThrow(
      /kit\.people\.nightBakr is not defined: defined ids: nightBaker; write kit-ext\/people\/nightBakr\.js/,
    );
    expect(ink.api.places?.['bakeryBackRoom']).toBe(place);
    const empty = createInkModulesApi(NO_INK_MODULES);
    expect(() => empty.places['x']).toThrow(/the project has no places yet/);
    expect(() => createInkModulesApi({ people: [person, person], places: [] })).toThrow(
      /defined twice/,
    );
  });
});
