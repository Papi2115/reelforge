import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../kit.js';
import { CRISP_PALETTE, TOKENS_ONLY_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import type { KitPalette } from '../../types.js';
import { getLook, LOOKS } from '../index.js';
import { lookDefinitions } from '../types.js';
import { dioramaLook } from './index.js';

const ENVS = ['dioramaOffice', 'dioramaServerRoom', 'dioramaCity', 'dioramaRoom'] as const;
type EnvName = (typeof ENVS)[number];

interface Diorama extends THREE.Group {
  update(t: number): void;
  anchor(name?: string): THREE.Vector3;
  anchorNames(): string[];
  camera(options?: unknown): { position: number[]; target: number[]; fov: number };
  part(name: string): THREE.Object3D;
  alarm?(amount: number): void;
}

function isDiorama(value: unknown): value is Diorama {
  return value instanceof THREE.Group && 'camera' in value && 'part' in value;
}

function build(name: EnvName, params: Record<string, unknown> = {}, palette = CRISP_PALETTE) {
  const kit = createKit({ three: THREE, palette, rng: testRng(7) });
  const env = kit.api.env as Readonly<Record<string, (params?: unknown) => unknown>>;
  const made = env[name]?.(params);
  if (!isDiorama(made)) throw new Error(`${name} did not build a diorama`);
  return made;
}

/** Colours of every vertex-coloured mesh (glow quads included) after update(t). */
function colorsAt(diorama: Diorama, t: number): number[] {
  diorama.update(t);
  const values: number[] = [];
  diorama.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name.endsWith('.glow')) {
      const mesh = child as THREE.Mesh;
      const attribute = mesh.geometry.getAttribute('color');
      values.push(...Array.from(attribute.array));
    }
  });
  return values;
}

function moverPositions(diorama: Diorama, t: number, parts: readonly string[]): number[] {
  diorama.update(t);
  return parts.flatMap((name) => diorama.part(name).position.toArray());
}

describe('look diorama', () => {
  it('is available with its four environments, rolls and taxonomy treatments', () => {
    expect(getLook('diorama')).toBe(dioramaLook);
    expect(LOOKS).toContain(dioramaLook);
    expect(lookDefinitions(dioramaLook).map((definition) => definition.name)).toEqual([...ENVS]);
    expect(dioramaLook.rolls).toEqual(['A', 'B']);
    expect(dioramaLook.soundPalette).toBe('diorama');
    expect(dioramaLook.variationBudget).toBe('diorama');
    for (const name of ENVS) expect(dioramaLook.docs).toContain(name);
  });

  it.each(ENVS)('%s builds in Crisp 640 and with tokens only', (name) => {
    for (const palette of [CRISP_PALETTE, TOKENS_ONLY_PALETTE] as KitPalette[]) {
      const diorama = build(name, { time: 'night', density: 1 }, palette);
      expect(diorama.getObjectByName(`${name}.platform`)).toBeDefined();
      expect(diorama.getObjectByName('dioramaLights')).toBeDefined();
      expect(diorama.getObjectByName('dioramaShadow')).toBeDefined();
    }
    const bare = build(name, { lights: false, shadow: false });
    expect(bare.getObjectByName('dioramaLights')).toBeUndefined();
    expect(bare.getObjectByName('dioramaShadow')).toBeUndefined();
  });

  it.each(ENVS)('%s animates as a pure function of t', (name) => {
    const one = build(name, { seed: 4 });
    const two = build(name, { seed: 4 });
    const later = colorsAt(one, 3.7);
    colorsAt(one, 0.4);
    expect(colorsAt(one, 3.7)).toEqual(later);
    expect(colorsAt(two, 3.7)).toEqual(later);
    expect(colorsAt(one, 1.1)).not.toEqual(colorsAt(one, 2.9));
    expect(() => {
      one.update(Number.NaN);
    }).toThrow(/finite time/);
  });

  it('gives the documented anchors', () => {
    const office = build('dioramaOffice');
    for (const anchor of ['desk0', 'desk3', 'monitor1', 'table', 'whiteboard', 'door', 'cooler']) {
      expect(office.anchorNames()).toContain(anchor);
    }
    const servers = build('dioramaServerRoom');
    for (const anchor of ['rack0', 'rack11', 'rowA', 'rowB', 'screen', 'cooler1', 'door']) {
      expect(servers.anchorNames()).toContain(anchor);
    }
    const city = build('dioramaCity');
    for (const anchor of ['building0', 'building11', 'landmark', 'park', 'road', 'crossing']) {
      expect(city.anchorNames()).toContain(anchor);
    }
    const room = build('dioramaRoom');
    for (const anchor of ['desk', 'monitor', 'mug', 'bed', 'window', 'rug', 'cat', 'lamp']) {
      expect(room.anchorNames()).toContain(anchor);
    }
    // Anchors sit on the platform: the floor is y = 0, desks are above it.
    expect(office.anchor('desk0').y).toBeGreaterThan(0.5);
    expect(Math.abs(office.anchor('floor').y)).toBe(0);
  });

  it('moves cars, walkers and smoke from t and names them for annotations', () => {
    const city = build('dioramaCity', { traffic: 3 });
    const parts = ['car0', 'car1', 'car2', 'walker0', 'walker1', 'smoke'];
    const at2 = moverPositions(city, 2, parts);
    expect(moverPositions(city, 5, parts)).not.toEqual(at2);
    expect(moverPositions(city, 2, parts)).toEqual(at2);
    expect(() => city.part('car3')).toThrow(/no such part.*car0, car1, car2/);
    expect(build('dioramaCity', { traffic: 0, density: 0 }).children.length).toBeGreaterThan(0);
    expect(build('dioramaRoom').part('steam')).toBeDefined();
    expect(build('dioramaServerRoom').part('tech')).toBeDefined();
  });

  it('turns the server room into a red alert and back', () => {
    const servers = build('dioramaServerRoom');
    const calm = colorsAt(servers, 1);
    servers.alarm?.(1);
    const alert = colorsAt(servers, 1);
    expect(alert).not.toEqual(calm);
    servers.alarm?.(0);
    expect(colorsAt(servers, 1)).toEqual(calm);
    expect(() => servers.alarm?.(Number.NaN)).toThrow(/finite number/);
  });

  it('frames itself with the iso camera, focus anchors and validated options', () => {
    const office = build('dioramaOffice');
    const wide = office.camera({ t: 0 });
    expect(wide.fov).toBe(12);
    expect(wide.position[1]).toBeGreaterThan(wide.target[1] ?? 0);
    const close = office.camera({ t: 0, zoom: 2, focus: 'desk1' });
    const distance = (pose: typeof wide) =>
      Math.hypot(...pose.position.map((value, axis) => value - (pose.target[axis] ?? 0)));
    expect(distance(close)).toBeLessThan(distance(wide) * 0.6);
    expect(office.camera({ t: 3 })).toEqual(office.camera({ t: 3 }));
    expect(office.camera({ t: 3 })).not.toEqual(wide);
    expect(() => office.camera({ zoom: 0 })).toThrow(/dioramaOffice\.camera\(options\): zoom/);
    expect(() => office.camera({ angle: 3 })).toThrow(/angle/);
    expect(() => office.camera({ focus: 'nope' })).toThrow(/no anchor "nope"/);
  });
});
