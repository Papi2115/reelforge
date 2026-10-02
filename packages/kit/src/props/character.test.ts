import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import { createKit } from '../kit.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import type { VoxelObject } from '../voxel/mesh.js';
import { voxelCount } from '../voxel/model.js';
import { CLIP_NAMES, walkPose } from './character-poses.js';

function kit() {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(3) }).api;
}

function rotations(root: THREE.Object3D): number[] {
  const values: number[] = [];
  root.traverse((child) => values.push(child.rotation.x, child.rotation.y, child.rotation.z));
  return values;
}

function world(object: THREE.Object3D, anchor: string): THREE.Vector3 {
  object.updateWorldMatrix(true, true);
  const kitObject = object as THREE.Object3D & { anchor(name: string): THREE.Vector3 };
  return object.localToWorld(kitObject.anchor(anchor));
}

function voxels(root: THREE.Object3D): number {
  let total = 0;
  root.traverse((child) => {
    if ('model' in child) total += voxelCount((child as VoxelObject).model);
  });
  return total;
}

describe('kit.props.character', () => {
  it('is about 2 units tall, stands on its feet and offers every clip', () => {
    const hero = kit().props.character();
    const box = hero.bounds();
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeGreaterThan(1.95);
    expect(box.max.y).toBeLessThan(2.25);
    for (const clip of CLIP_NAMES)
      expect(() => {
        hero.pose(clip, 1.2);
      }).not.toThrow();
    expect(() => {
      hero.pose('dance');
    }).toThrow(/unknown pose "dance" \(available: stand, walk/);
    expect(() => {
      hero.pose('wave', Number.NaN);
    }).toThrow(KitError);
  });

  it('poses are pure functions of t (same t, same joints; any call order)', () => {
    const hero = kit().props.character({ pose: 'walk' });
    hero.update(0.7);
    const at = rotations(hero);
    hero.update(2.3);
    expect(rotations(hero)).not.toEqual(at);
    hero.pose('shrug', 1);
    hero.update(0.7);
    expect(rotations(hero)).toEqual(at);
  });

  it('walks without sliding: legs swing in opposition, the cycle repeats every stride', () => {
    const hero = kit().props.character();
    expect(hero.walk(2, 1.5)).toBeCloseTo(3);
    const pose = walkPose(0.4, 1.2, 0);
    expect(pose.legLX).toBeCloseTo(-pose.legRX);
    expect(pose.armLX * pose.legLX).toBeLessThan(0);
    const swing = Math.min(0.75, 0.32 + 0.12 * 1.2);
    const stride = 4 * (11 / 12) * Math.sin(swing);
    const later = walkPose(0.4 + stride, 1.2, 0);
    expect(later.legLX).toBeCloseTo(pose.legLX);
    expect(later.kneeR).toBeCloseTo(pose.kneeR);
    expect(walkPose(1, 0, 0).legLX).toBe(0);
  });

  it('sits on a kit chair: hips on the seat, feet just above the floor', () => {
    const api = kit();
    const desk = api.props.bench();
    const student = api.props.character({ pose: 'sit' }).on(desk, { at: 'seat', align: 'seat' });
    expect(student.position.y).toBeCloseTo(0, 5);
    const box = student.bounds();
    expect(box.min.y).toBeGreaterThan(-0.01);
    expect(box.min.y).toBeLessThan(0.15);
    expect(student.anchor('head').y).toBeLessThan(1.8);
    expect(student.anchor('bottom').y).toBe(0);
  });

  it('think puts the right hand at the chin, typing puts both hands forward at desk height', () => {
    const hero = kit().props.character();
    hero.pose('think', 1);
    expect(hero.anchor('handR').distanceTo(hero.anchor('face'))).toBeLessThan(0.4);
    hero.pose('typing', 1);
    for (const hand of ['handL', 'handR']) {
      const point = hero.anchor(hand);
      expect(point.z).toBeGreaterThan(0.3);
      expect(point.y).toBeGreaterThan(0.85);
      expect(point.y).toBeLessThan(1.15);
    }
    hero.pose('wave', 1);
    expect(hero.anchor('handR').y).toBeGreaterThan(hero.anchor('face').y + 0.1);
  });

  it('point(target) aims the right arm at a world point or a kit object', () => {
    const api = kit();
    const scene = new THREE.Scene();
    const hero = api.props.character();
    hero.position.set(1, 0, 2);
    hero.rotation.y = 0.4;
    scene.add(hero);
    const target = api.props.globe();
    target.position.set(-3, 1.5, 6);
    scene.add(target);
    for (const goal of [target, [4, 3, -1] as const]) {
      hero.point(goal, 1);
      const shoulder = hero.localToWorld(new THREE.Vector3(-4 / 12, (11 + 6) / 12, 0));
      const hand = world(hero, 'handR');
      const aim = Array.isArray(goal) ? new THREE.Vector3(...goal) : world(target, 'center');
      const along = hand.sub(shoulder).normalize().dot(aim.sub(shoulder).normalize());
      expect(along).toBeGreaterThan(0.97);
    }
    expect(() => {
      hero.point('the moon');
    }).toThrow(/target must be a kit object or a world point/);
  });

  it('animate() starts at `from`, fades in and runs at `speed`; blend and mix combine clips', () => {
    const hero = kit().props.character();
    const play = hero.animate({ clip: 'wave', from: 2, speed: 2 });
    play(1);
    const before = rotations(hero);
    hero.pose('stand', 1);
    expect(rotations(hero)).toEqual(before);
    play(3);
    const waving = rotations(hero);
    hero.pose('wave', 2);
    expect(rotations(hero)).toEqual(waving);
    const faded = hero.animate({ clip: 'wave', from: 2, fadeIn: 1 });
    faded(2.5);
    const halfway = hero.anchor('handR').y;
    expect(halfway).toBeGreaterThan(1);
    expect(halfway).toBeLessThan(hero.anchor('head').y);
    // Scenes are untyped JS: unknown clip names must fail with a readable error.
    const untyped = { clip: 'moonwalk' } as unknown as Parameters<typeof hero.animate>[0];
    expect(() => hero.animate(untyped)).toThrow(/character\.animate\(\): clip/);

    hero.blend('stand', 'sit', 0, 1);
    const stand = rotations(hero);
    hero.blend('stand', hero.poseAt('sit', 1), 1, 1);
    const sit = rotations(hero);
    hero.pose('sit', 1);
    expect(rotations(hero)).toEqual(sit);
    hero.pose('stand', 1);
    expect(rotations(hero)).toEqual(stand);
    hero.mix('sit', 'wave', 1);
    expect(hero.bounds().min.y).toBeGreaterThan(0);
    expect(hero.anchor('handR').y).toBeGreaterThan(hero.anchor('face').y + 0.1);
  });

  it('hold() puts a prop in a hand that follows the pose', () => {
    const api = kit();
    const hero = api.props.character();
    const phone = hero.hold(api.props.phone(), 'left', 'center');
    expect(phone.parent?.name).toBe('elbowL');
    hero.pose('wave', 1);
    const low = world(phone, 'center').y;
    hero.pose('shrug', 1);
    expect(world(phone, 'center').y).not.toBeCloseTo(low);
    expect(world(phone, 'center').distanceTo(world(hero, 'handL'))).toBeLessThan(0.05);
    expect(() => hero.hold(api.props.key(), 'middle')).toThrow(/'left' or 'right'/);
  });

  it('variants, hats and accessories change the model', () => {
    const api = kit();
    const base = voxels(api.props.character({ variant: 'hoodie' }));
    expect(
      voxels(api.props.character({ variant: 'hoodie', accessories: ['backpack'] })),
    ).toBeGreaterThan(base);
    expect(voxels(api.props.character({ variant: 'hacker' }))).toBeGreaterThan(base);
    expect(voxels(api.props.character({ variant: 'officer' }))).toBeGreaterThan(base);
    const pirate = { variant: 'pirate' } as unknown as Parameters<typeof api.props.character>[0];
    expect(() => api.props.character(pirate)).toThrow(/variant/);
  });
});
