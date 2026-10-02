/**
 * Cube trails: polylines drawn as evenly spaced voxel cubes in one InstancedMesh (graph edges,
 * map routes, timeline axes). Each path reveals from its start by a share 0..1 and can be
 * re-tinted per frame (highlights, travelling pulses); everything is set absolutely per frame.
 */
import type * as THREE from 'three';
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';

export interface TrailOptions {
  /** Distance between cube centres in units. */
  readonly spacing: number;
  /** Cube edge in units. */
  readonly size: number;
  /** Unlit cubes (default true). */
  readonly glow?: boolean | undefined;
}

interface TrailPath {
  readonly first: number;
  /** Arc share (0..1) of every cube of the path. */
  readonly fractions: readonly number[];
}

export interface CubeTrail {
  readonly mesh: THREE.InstancedMesh;
  /** Number of cubes of path i. */
  cubes(path: number): number;
  /** Shows the first share k (0..1) of path i; the front cube grows in. */
  reveal(path: number, k: number): void;
  /** Colours the cubes of path i (pick gets the cube's arc share 0..1). */
  tint(path: number, pick: (fraction: number) => THREE.Color): void;
}

/** Points every `spacing` units along a polyline (first and last point included). */
export function samplePolyline(points: readonly Vec3[], spacing: number): Vec3[] {
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point;
    return Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const count = Math.max(1, Math.round(total / spacing));
  const samples: Vec3[] = [];
  for (let index = 0; index <= count; index += 1) {
    let distance = (index / count) * total;
    let segment = 0;
    while (segment < lengths.length - 1 && distance > (lengths[segment] ?? 0)) {
      distance -= lengths[segment] ?? 0;
      segment += 1;
    }
    const a = points[segment] ?? [0, 0, 0];
    const b = points[segment + 1] ?? a;
    const length = lengths[segment] ?? 0;
    const k = length > 0 ? Math.min(1, distance / length) : 0;
    samples.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
  }
  return samples;
}

export function createTrail(
  tools: KitTools,
  paths: readonly (readonly Vec3[])[],
  options: TrailOptions,
): CubeTrail {
  const { three } = tools;
  const sampled = paths.map((path) => samplePolyline(path, options.spacing));
  const total = sampled.reduce((sum, path) => sum + path.length, 0);
  const geometry = tools.track(new three.BoxGeometry(options.size, options.size, options.size));
  const materials = tools.materials();
  const material = options.glow === false ? materials.instancedLit : materials.instancedGlow;
  const mesh = new three.InstancedMesh(geometry, material, Math.max(1, total));
  mesh.count = total;
  mesh.frustumCulled = false;
  mesh.name = 'trail';
  const layout: TrailPath[] = [];
  const centres: Vec3[] = [];
  for (const path of sampled) {
    layout.push({
      first: centres.length,
      fractions: path.map((_, index) => (path.length > 1 ? index / (path.length - 1) : 1)),
    });
    centres.push(...path);
  }
  const white = new three.Color(1, 1, 1);
  for (let index = 0; index < total; index += 1) mesh.setColorAt(index, white);
  const matrix = new three.Matrix4();
  const pathAt = (index: number): TrailPath => {
    const path = layout[index];
    if (!path) throw new RangeError(`trail path ${String(index)} out of range`);
    return path;
  };
  return {
    mesh,
    cubes: (path) => pathAt(path).fractions.length,
    reveal(path, k) {
      const { first, fractions } = pathAt(path);
      const step = fractions.length > 1 ? 1 / (fractions.length - 1) : 1;
      fractions.forEach((fraction, offset) => {
        const grow = Math.min(1, Math.max(0, (k - fraction) / step + 1));
        const [x, y, z] = centres[first + offset] ?? [0, 0, 0];
        const scale = k <= 0 ? 0 : grow;
        matrix.makeScale(scale, scale, scale).setPosition(x, y, z);
        mesh.setMatrixAt(first + offset, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    tint(path, pick) {
      const { first, fractions } = pathAt(path);
      fractions.forEach((fraction, offset) => {
        mesh.setColorAt(first + offset, pick(fraction));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
