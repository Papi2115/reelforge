import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import { createKit, kitCatalog } from '../kit.js';
import { kitOriginOf } from '../registry.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import { CAST, EXAMPLE_ROLES } from './cast-presets.js';
import type { CharacterObject } from './character.js';
import { MASCOTS } from './mascots.js';

function kit() {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(5) });
}

function rotations(root: THREE.Object3D): number[] {
  const values: number[] = [];
  root.traverse((node) =>
    values.push(node.rotation.x, node.rotation.y, node.rotation.z, node.position.y),
  );
  return values;
}

function anchorY(character: CharacterObject, name: string): number {
  return character.anchor(name).y;
}

const ANCHORS = ['head', 'face', 'hand', 'handL', 'handR', 'prop', 'feet', 'bottom'];

describe('kit.cast', () => {
  it('builds every mascot, cast member, the mannequin and the example roles at the page sizes', () => {
    const { api } = kit();
    const heights = (character: CharacterObject) => character.bounds().max.y;
    for (const id of MASCOTS) {
      const mascot = api.cast.mascot(id);
      expect(heights(mascot), id).toBeGreaterThan(1.5);
      expect(heights(mascot), id).toBeLessThan(2.1);
      expect(mascot.bounds().min.y, id).toBeCloseTo(0, 1);
      for (const name of ANCHORS) expect(mascot.anchorNames(), id).toContain(name);
    }
    for (const id of CAST) {
      const person = api.cast.person(id);
      expect(heights(person), id).toBeGreaterThan(1.3);
      expect(heights(person), id).toBeLessThan(2.3);
    }
    expect(heights(api.cast.mannequin())).toBeGreaterThan(1.9);
    for (const spec of EXAMPLE_ROLES)
      expect(heights(api.cast.role(spec)), spec.id).toBeGreaterThan(1.5);
  });

  it('poses are pure functions of t: any evaluation order gives the same rig', () => {
    const { api } = kit();
    const fox = api.cast
      .mascot('fox')
      .pose('wave', { at: 1 })
      .pose('eureka', { at: 3 })
      .expression('alarm', { at: 4 });
    const times = [0.2, 1.4, 3.9, 6.1];
    const forward = times.map((t) => {
      fox.update(t);
      return rotations(fox);
    });
    const backward = [...times].reverse().map((t) => {
      fox.update(t);
      return rotations(fox);
    });
    expect(backward.reverse()).toEqual(forward);
    expect(forward[0]).not.toEqual(forward[1]);
  });

  it('moves the anchors with the pose (hand up in a wave, prop in the hand)', () => {
    const { api } = kit();
    const engineer = api.cast.person('engineer').pose('wave', { at: 1 });
    engineer.update(0.5);
    const calmHand = anchorY(engineer, 'handR');
    engineer.update(2);
    expect(anchorY(engineer, 'handR')).toBeGreaterThan(calmHand + 0.3);
    expect(anchorY(engineer, 'head')).toBeGreaterThan(anchorY(engineer, 'face'));
    const wrench = engineer.anchor('prop');
    expect(wrench.distanceTo(engineer.anchor('handR'))).toBeLessThan(0.4);
    const doctor = api.cast.person('doctor');
    doctor.update(0);
    expect(doctor.anchor('hand').distanceTo(doctor.anchor('handL'))).toBe(0);
    const swapped = api.cast.person('doctor', { held: 'phone', hand: 'right' });
    swapped.update(0);
    expect(swapped.anchor('hand').distanceTo(swapped.anchor('handR'))).toBe(0);
  });

  it('walks to a point, turns into the walk and back, then plays the next pose', () => {
    const { api } = kit();
    const bulb = api.cast.mascot('bulb');
    bulb.position.set(-2, 0, 0);
    bulb.walkTo([2, 0, 0], { at: 1, speed: 2, then: 'wave' }).walkTo([2, 0, -1]);
    // 4 units at 2 u/s, then 1 unit at the default 0.8 u/s.
    expect(bulb.walkEnd()).toBeCloseTo(4.25);
    bulb.update(0);
    expect(bulb.position.x).toBe(-2);
    bulb.update(2);
    expect(bulb.position.x).toBeCloseTo(0);
    const body = bulb.children[0];
    expect(body?.rotation.y).toBeCloseTo(Math.PI / 2, 2);
    bulb.update(9);
    expect(bulb.position.toArray()).toEqual([2, 0, -1]);
    expect(body?.rotation.y).toBeCloseTo(0, 6);
    bulb.update(0);
    expect(bulb.position.x).toBe(-2);
  });

  it('turns the head towards a look-at target', () => {
    const { api } = kit();
    const fox = api.cast.mascot('fox', { energy: 0 });
    const target = api.cast.mascot('bean');
    target.position.set(3, 0, 0.5);
    const scene = new THREE.Scene();
    scene.add(fox, target);
    fox.lookAt(target, { at: 1, until: 4 });
    fox.update(0.5);
    const neck = fox.getObjectByName('neck');
    const before = neck?.rotation.y ?? 0;
    fox.update(2);
    expect((neck?.rotation.y ?? 0) - before).toBeGreaterThan(0.8);
    fox.update(6);
    expect(Math.abs(neck?.rotation.y ?? 1)).toBeLessThan(0.2);
  });

  it('validates names and params with readable kit errors', () => {
    const { api } = kit();
    expect(() => api.cast.mascot('dragon')).toThrow(/kit\.cast\.mascot\(\): invalid params \(id: /);
    expect(() => api.cast.person('pirate')).toThrow(KitError);
    expect(() => api.cast.mascot('bulb').pose('dance')).toThrow(
      /unknown pose "dance" \(calm, wave/,
    );
    expect(() => api.cast.mascot('bulb').expression('angry')).toThrow(/unknown expression "angry"/);
    expect(() => api.cast.mascot('bulb').walkTo([1, 0])).toThrow(
      /expected a kit object or a point/,
    );
    expect(() => api.cast.mascot('bulb', [] as never)).toThrow(/params must be an object/);
    expect(() => api.cast.role({ id: 'x', label: 'X', top: { color: 'nope' } })).toThrow(
      /spec\.top\.color/,
    );
    expect(
      api.cast
        .mascot('bulb')
        .pose('wave', { at: { t: 2.5 } })
        .walkEnd(),
    ).toBe(0);
    const playing = api.cast.person('kid');
    playing.update(1);
    expect(() => playing.walkTo([1, 0, 0])).toThrow(/walkTo\(\) was called after update\(\)/);
    expect(() => playing.pose('wave', { at: 2 })).toThrow(KitError);
  });

  it('stamps the kit.cast origin, respects the build phase and lists the pack in the catalog', () => {
    const handle = kit();
    const screen = handle.api.cast.mascot('screen');
    expect(kitOriginOf(screen)?.call).toBe('kit.cast.mascot()');
    const spec = handle.api.cast.spec('kid');
    spec.label = 'Changed';
    expect(handle.api.cast.spec('kid').label).toBe('Kid');
    handle.seal();
    expect(() => handle.api.cast.mannequin()).toThrow(
      /kit\.cast\.mannequin\(\) was called in update\(\)/,
    );
    const catalog = kitCatalog();
    expect(catalog.cast.map((entry) => entry.name)).toEqual([
      'mascot',
      'person',
      'mannequin',
      'role',
    ]);
    expect(catalog.cast.every((entry) => entry.look === 'voxel')).toBe(true);
    handle.dispose();
  });

  it("redraws Screen's face only from the expression and time", () => {
    const { api } = kit();
    const screen = api.cast.mascot('screen').expression('alarm', { at: 2 });
    const texture = (): Uint8Array => {
      let data: Uint8Array | undefined;
      screen.traverse((node) => {
        const material = (node as THREE.Mesh).material;
        if (
          material instanceof THREE.MeshBasicMaterial &&
          material.map instanceof THREE.DataTexture
        ) {
          data = new Uint8Array(material.map.image.data as Uint8Array);
        }
      });
      if (!data) throw new Error('no screen texture');
      return data;
    };
    screen.update(1);
    const calm = texture();
    screen.update(2.1);
    const alarm = texture();
    expect(alarm).not.toEqual(calm);
    screen.update(1);
    expect(texture()).toEqual(calm);
  });
});
