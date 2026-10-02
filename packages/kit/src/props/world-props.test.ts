import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../kit.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import type { VoxelObject } from '../voxel/mesh.js';

function kit() {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(5) }).api;
}

function instanced(root: THREE.Object3D): THREE.InstancedMesh[] {
  return root.children.filter(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
  );
}

function matrices(root: THREE.Object3D): number[] {
  return instanced(root).flatMap((mesh) => Array.from(mesh.instanceMatrix.array));
}

/** Hip positions (x, z) of every person: translation of the torso batches (every 10th mesh). */
function hips(root: THREE.Object3D): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  instanced(root).forEach((mesh, index) => {
    if (index % 10 !== 0) return;
    for (let slot = 0; slot < mesh.count; slot += 1) {
      mesh.getMatrixAt(slot, matrix);
      position.setFromMatrixPosition(matrix);
      points.push(new THREE.Vector2(position.x, position.z));
    }
  });
  return points;
}

/** Wheels are kit groups (one voxel mesh each) directly under the vehicle. */
function isWheel(child: THREE.Object3D): boolean {
  return (child as { kitType?: string }).kitType === 'group';
}

function glowVoxels(root: THREE.Object3D): number {
  let total = 0;
  root.traverse((child) => {
    if (!('model' in child)) return;
    const { model } = child as VoxelObject;
    for (const value of model.data) {
      const color = value === 0 ? undefined : model.palette[value - 1];
      if (typeof color === 'object') total += 1;
    }
  });
  return total;
}

describe('kit.props.crowd', () => {
  it('instances every person once per body part, in a few draw batches', () => {
    const crowd = kit().props.crowd({ count: 200, area: [24, 10], looks: 6 });
    const meshes = instanced(crowd);
    expect(meshes.length).toBeLessThanOrEqual(60);
    expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(200 * 10);
    expect(hips(crowd)).toHaveLength(200);
  });

  it('is a pure function of t and of the seed', () => {
    const api = kit();
    const crowd = api.props.crowd({ seed: 4, walking: 0.5 });
    crowd.update(2);
    const at = matrices(crowd);
    crowd.update(7);
    expect(matrices(crowd)).not.toEqual(at);
    crowd.update(2);
    expect(matrices(crowd)).toEqual(at);
    const twin = api.props.crowd({ seed: 4, walking: 0.5 });
    twin.update(2);
    expect(matrices(twin)).toEqual(at);
    const other = api.props.crowd({ seed: 5, walking: 0.5 });
    other.update(2);
    expect(matrices(other)).not.toEqual(at);
  });

  it('keeps standing people apart and moves walkers along their lanes inside the area', () => {
    const api = kit();
    const standing = api.props.crowd({ count: 60, area: [10, 6], walking: 0, spread: 1 });
    const points = hips(standing);
    let closest = Infinity;
    points.forEach((a, i) => {
      for (const b of points.slice(i + 1)) closest = Math.min(closest, a.distanceTo(b));
    });
    expect(closest).toBeGreaterThan(0.25);
    standing.update(5);
    expect(hips(standing).map((point) => point.toArray())).toEqual(points.map((p) => p.toArray()));

    const walkers = api.props.crowd({ count: 20, area: [10, 4], walking: 1, speed: 1 });
    const start = hips(walkers);
    walkers.update(1);
    const moved = hips(walkers);
    moved.forEach((point, index) => {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(5);
      expect(point.y).toBeCloseTo(start[index]?.y ?? Number.NaN);
    });
    expect(moved.some((point, index) => Math.abs(point.x - (start[index]?.x ?? 0)) > 0.5)).toBe(
      true,
    );
  });
});

describe('vehicles', () => {
  it('drive(t, speed) rolls the wheels by distance / radius and returns the distance', () => {
    const api = kit();
    const car = api.props.car();
    expect(car.drive(2, 3)).toBeCloseTo(6);
    const wheels = car.children.filter(isWheel);
    expect(wheels).toHaveLength(4);
    expect(wheels[0]?.rotation.x).toBeCloseTo(6 / (4 / 12));
    car.roll(0);
    expect(wheels[0]?.rotation.x).toBe(0);
    const truck = api.props.truck({ speed: 2 });
    truck.update(1.5);
    const truckWheels = truck.children.filter(isWheel);
    expect(truckWheels).toHaveLength(6);
    expect(truckWheels[0]?.rotation.x).toBeCloseTo(3 / (5 / 12));
  });

  it('a container fits the flatbed cargo anchor', () => {
    const api = kit();
    const truck = api.props.truck({ body: 'flatbed' });
    const box = api.props.container().on(truck, { at: 'cargo' });
    const truckBox = truck.bounds();
    const cargo = box.bounds().applyMatrix4(box.matrix);
    expect(cargo.min.y).toBeCloseTo(truck.anchor('cargo').y);
    expect(cargo.max.x - cargo.min.x).toBeLessThanOrEqual(truckBox.max.x - truckBox.min.x + 1e-6);
    expect(cargo.min.z).toBeGreaterThan(truckBox.min.z);
    expect(cargo.max.z).toBeLessThan(truck.anchor('top').z);
  });

  it('the police light bar flashes as a function of t', () => {
    const police = kit().props.car({ style: 'police' });
    const bar = () => police.children.filter((child) => child.visible).length;
    police.update(0);
    const first = bar();
    police.update(1 / 6 + 0.01);
    expect(bar()).toBe(first);
    const lights = police.children.slice(-2);
    police.update(0.01);
    const shown = lights.map((light) => light.visible);
    police.update(0.18);
    expect(lights.map((light) => light.visible)).toEqual(shown.map((visible) => !visible));
  });
});

describe('buildings', () => {
  it('building height follows the storeys; windows light by share and seed', () => {
    const api = kit();
    const low = api.props.building({ floors: 2 });
    const high = api.props.building({ floors: 8 });
    expect(high.anchor('roof').y - low.anchor('roof').y).toBeCloseTo(18);
    const dark = glowVoxels(api.props.building({ windows: 0, seed: 1 }));
    const lit = glowVoxels(api.props.building({ windows: 1, seed: 1 }));
    expect(lit).toBeGreaterThan(dark * 2);
    const data = (seed: number) => {
      const mesh = api.props.building({ seed, wall: 'darkSlate' }).children[0] as VoxelObject;
      return Array.from(mesh.model.data).join('');
    };
    expect(data(1)).toEqual(data(1));
    expect(data(1)).not.toEqual(data(2));
  });

  it('tower: setbacks narrow the top, the spire rises above the roof', () => {
    const api = kit();
    const tower = api.props.tower({ floors: 20, setbacks: 2 });
    expect(tower.anchor('roof').y).toBeGreaterThan(60);
    expect(tower.anchor('spire').y).toBeGreaterThan(tower.anchor('roof').y + 7);
    expect(api.props.tower({ spire: false }).bounds().max.y).toBeLessThan(
      api.props.tower().bounds().max.y,
    );
  });

  it('drone rotors spin and the hover bob is a pure function of t', () => {
    const drone = kit().props.drone();
    const pose = () => {
      const values: number[] = [];
      drone.traverse((child) => values.push(child.rotation.y, child.position.y));
      return values;
    };
    drone.update(1.3);
    const at = pose();
    drone.update(0.2);
    expect(pose()).not.toEqual(at);
    drone.update(1.3);
    expect(pose()).toEqual(at);
  });
});
