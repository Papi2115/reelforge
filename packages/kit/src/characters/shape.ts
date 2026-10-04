/**
 * Box geometry of the character pack (ADR-024): the concept page builds every body part from
 * boxes with fractional voxel extents (a 0.15-voxel thin collar, a 2.6-wide sleeve) plus carved
 * unit-voxel volumes (the bulb's glass, the bean, the mannequin). `Shape` records them in voxel
 * units with pack colour names and material channels; `meshShape` resolves the colours in the
 * active style and builds one mesh (lit + glow + custom material groups), like the kit's voxel
 * meshes but without the integer-grid restriction.
 */
import type * as THREE from 'three';
import { KitError } from '../errors.js';
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import { castHex } from './palette.js';

/** 'lit' (Lambert), 'glow' (unlit) or a custom material key given to meshShape. */
export type Channel = string;

interface Face {
  readonly normal: Vec3;
  readonly corners: readonly Vec3[];
}

/** Cube faces with counter-clockwise corners seen from outside. */
const FACES: readonly Face[] = (
  [
    [
      [1, 0, 0],
      [
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    ],
    [
      [0, 1, 0],
      [
        [0, 1, 0],
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
      ],
    ],
    [
      [0, -1, 0],
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ],
    ],
    [
      [0, 0, 1],
      [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
    ],
    [
      [0, 0, -1],
      [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
      ],
    ],
  ] as const
).map(([normal, quad]): Face => {
  const [a, b, c] = quad;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [
    (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0),
    (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0),
    (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0),
  ];
  const outward =
    (cross[0] ?? 0) * normal[0] + (cross[1] ?? 0) * normal[1] + (cross[2] ?? 0) * normal[2] >= 0;
  return { normal, corners: outward ? quad : [...quad].reverse() };
});

const QUAD_TRIANGLES = [0, 1, 2, 0, 2, 3] as const;

interface ChannelBuffer {
  readonly positions: number[];
  readonly normals: number[];
  /** Colour name per vertex. */
  readonly colors: string[];
}

/** A colour name, or a function of the voxel centre (null carves the voxel). */
export type VoxelPaint = string | ((x: number, y: number, z: number) => string | null);
export type Inside = (x: number, y: number, z: number) => boolean;

/** Boxes in voxel units (`unit` = world size of one voxel) per material channel. */
export class Shape {
  readonly unit: number;
  private readonly channels = new Map<Channel, ChannelBuffer>();

  constructor(unit: number) {
    this.unit = unit;
  }

  private buffer(channel: Channel): ChannelBuffer {
    let buffer = this.channels.get(channel);
    if (!buffer) {
      buffer = { positions: [], normals: [], colors: [] };
      this.channels.set(channel, buffer);
    }
    return buffer;
  }

  private face(channel: Channel, color: string, face: Face, a: Vec3, b: Vec3): void {
    const buffer = this.buffer(channel);
    const corner = (k: Vec3): Vec3 => [
      (a[0] + (b[0] - a[0]) * k[0]) * this.unit,
      (a[1] + (b[1] - a[1]) * k[1]) * this.unit,
      (a[2] + (b[2] - a[2]) * k[2]) * this.unit,
    ];
    for (const index of QUAD_TRIANGLES) {
      const point = corner(face.corners[index] ?? [0, 0, 0]);
      buffer.positions.push(point[0], point[1], point[2]);
      buffer.normals.push(face.normal[0], face.normal[1], face.normal[2]);
      buffer.colors.push(color);
    }
  }

  /** Box from corner a to corner b (voxels). */
  box(color: string, a: Vec3, b: Vec3, channel: Channel = 'lit'): this {
    for (const face of FACES) this.face(channel, color, face, a, b);
    return this;
  }

  /** Box centred on x/z standing on y: c = [cx, bottomY, cz], s = size. */
  cb(color: string, c: Vec3, s: Vec3, channel: Channel = 'lit'): this {
    return this.box(
      color,
      [c[0] - s[0] / 2, c[1], c[2] - s[2] / 2],
      [c[0] + s[0] / 2, c[1] + s[1], c[2] + s[2] / 2],
      channel,
    );
  }

  /** Unit voxels in [lo, hi) whose centre is inside; only faces between filled and empty cells. */
  vox(paint: VoxelPaint, lo: Vec3, hi: Vec3, inside: Inside, channel: Channel = 'lit'): this {
    const cells = new Map<string, readonly [number, number, number, string]>();
    const key = (x: number, y: number, z: number): string => [x, y, z].join(',');
    for (let x = lo[0]; x < hi[0]; x += 1) {
      for (let y = lo[1]; y < hi[1]; y += 1) {
        for (let z = lo[2]; z < hi[2]; z += 1) {
          if (!inside(x + 0.5, y + 0.5, z + 0.5)) continue;
          const color = typeof paint === 'function' ? paint(x + 0.5, y + 0.5, z + 0.5) : paint;
          if (color !== null) cells.set(key(x, y, z), [x, y, z, color]);
        }
      }
    }
    for (const [x, y, z, color] of cells.values()) {
      for (const face of FACES) {
        const [nx, ny, nz] = face.normal;
        if (cells.has(key(x + nx, y + ny, z + nz))) continue;
        this.face(channel, color, face, [x, y, z], [x + 1, y + 1, z + 1]);
      }
    }
    return this;
  }

  /** Bounds of everything recorded, in voxels (undefined when empty). */
  bounds(): { readonly min: Vec3; readonly max: Vec3 } | undefined {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const buffer of this.channels.values()) {
      buffer.positions.forEach((value, index) => {
        const axis = index % 3;
        const voxels = value / this.unit;
        min[axis] = Math.min(min[axis] ?? Infinity, voxels);
        max[axis] = Math.max(max[axis] ?? -Infinity, voxels);
      });
    }
    if (!((min[0] ?? Infinity) <= (max[0] ?? -Infinity))) return undefined;
    return {
      min: [min[0] ?? 0, min[1] ?? 0, min[2] ?? 0],
      max: [max[0] ?? 0, max[1] ?? 0, max[2] ?? 0],
    };
  }

  /** Number of triangles recorded. */
  triangles(): number {
    let count = 0;
    for (const buffer of this.channels.values()) count += buffer.positions.length / 9;
    return count;
  }

  /** Channels in insertion order with their buffers (read by meshShape). */
  entries(): readonly (readonly [Channel, ChannelBuffer])[] {
    return [...this.channels.entries()].filter(([, buffer]) => buffer.positions.length > 0);
  }
}

/** Builds the mesh of `shape` (undefined when empty); `materials` adds custom channels. */
export function meshShape(
  tools: KitTools,
  shape: Shape,
  materials: Readonly<Record<string, THREE.Material>> = {},
): THREE.Mesh | undefined {
  const { three } = tools;
  const entries = shape.entries();
  if (entries.length === 0) return undefined;
  const shared = tools.materials();
  const rgb = new Map<string, readonly [number, number, number]>();
  const colorOf = (name: string): readonly [number, number, number] => {
    let value = rgb.get(name);
    if (!value) {
      const color = new three.Color(castHex(tools.palette, name));
      value = [color.r, color.g, color.b];
      rgb.set(name, value);
    }
    return value;
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const geometry = tools.track(new three.BufferGeometry());
  const list: THREE.Material[] = [];
  for (const [channel, buffer] of entries) {
    const start = positions.length / 3;
    for (const value of buffer.positions) positions.push(value);
    for (const value of buffer.normals) normals.push(value);
    for (const name of buffer.colors) {
      const [r, g, b] = colorOf(name);
      colors.push(r, g, b);
    }
    const material =
      materials[channel] ??
      (channel === 'glow' ? shared.glow : channel === 'lit' ? shared.lit : undefined);
    if (material === undefined) {
      throw new KitError('invalid-model', `character mesh: no material for channel "${channel}"`);
    }
    geometry.addGroup(start, buffer.positions.length / 3, list.length);
    list.push(material);
  }
  geometry.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new three.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new three.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return new three.Mesh(geometry, list);
}

/** Per-joint shapes of one character: shapes('torso').cb(...). */
export interface ShapeSet {
  (joint: string): Shape;
  readonly map: ReadonlyMap<string, Shape>;
}

export function shapeSet(unit: number): ShapeSet {
  const map = new Map<string, Shape>();
  const get = (joint: string): Shape => {
    let shape = map.get(joint);
    if (!shape) {
      shape = new Shape(unit);
      map.set(joint, shape);
    }
    return shape;
  };
  return Object.assign(get, { map });
}
