/**
 * Mascot faces (ADR-024), as on the concept page: voxel eyes (dark, or sclera + pupil), happy
 * eye arcs, brows, six mouths and a pink "!" above the head for the alarm; and Screen's 12x8
 * pixel display (a DataTexture redrawn only when the picture changes). `update(expression, t,
 * blink)` sets everything absolutely, so any time can be evaluated in any order.
 */
import type * as THREE from 'three';
import type { KitTools } from '../registry.js';
import type { Expression } from './clips.js';
import {
  FACE_EXPRESSIONS,
  MOUTH_SHAPES,
  screenPixels,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
  type MouthShape,
} from './expressions.js';
import { TAU } from './math.js';
import { castHex } from './palette.js';
import { meshShape, Shape } from './shape.js';

/** Face colour of the dark features (the page's INK). */
export const INK = 'navy';

export interface Face {
  update(expression: Expression, t: number, blink: number): void;
}

export interface VoxelFaceSpec {
  readonly unit: number;
  readonly eyeX: number;
  readonly eyeY: number;
  /** Depth of the face plane (voxels). */
  readonly z: number;
  /** Eye width, height. */
  readonly eye: readonly [number, number];
  /** Pupil width, height (big sclera eyes); without: solid dark eyes with a glint. */
  readonly pupil?: readonly [number, number] | undefined;
  /** Sclera / glint colour. */
  readonly white: string;
  readonly mouthY: number;
  readonly mouthZ?: number | undefined;
  readonly mouthW?: number | undefined;
  readonly browW?: number | undefined;
  readonly browGap?: number | undefined;
  /** Height of the "!" (voxels). */
  readonly alertY: number;
}

interface Eye {
  readonly group: THREE.Group;
  readonly open: THREE.Group;
  readonly pupil: THREE.Object3D | undefined;
  readonly happy: THREE.Object3D;
  readonly x: number;
  readonly y: number;
}

function mouthShapes(unit: number, mw: number): Readonly<Record<MouthShape, Shape>> {
  const dot = (shape: Shape, x: number, y: number, h = 0.5): Shape =>
    shape.cb(INK, [x, y, 0], [0.5, h, 0.45]);
  return {
    smile: dot(
      dot(new Shape(unit).cb(INK, [0, 0, 0], [mw * 0.6, 0.5, 0.45]), -mw * 0.38, 0.4),
      mw * 0.38,
      0.4,
    ),
    grin: dot(
      dot(new Shape(unit).cb(INK, [0, -0.5, 0], [mw, 0.9, 0.45]), -(mw / 2 + 0.2), 0.2, 0.6),
      mw / 2 + 0.2,
      0.2,
      0.6,
    ),
    o: new Shape(unit).cb(INK, [0, -0.7, 0], [1.2, 1.4, 0.45]),
    flat: new Shape(unit).cb(INK, [0, 0, 0], [mw * 0.6, 0.45, 0.45]),
    small: new Shape(unit).cb(INK, [0, 0, 0], [0.8, 0.45, 0.45]),
    side: new Shape(unit)
      .cb(INK, [mw * 0.12, 0, 0], [mw * 0.45, 0.45, 0.45])
      .cb(INK, [mw * 0.42, 0.35, 0], [0.45, 0.45, 0.45]),
  };
}

function mesh(tools: KitTools, shape: Shape): THREE.Object3D {
  return meshShape(tools, shape) ?? new tools.three.Group();
}

export function voxelFace(tools: KitTools, parent: THREE.Object3D, spec: VoxelFaceSpec): Face {
  const { three } = tools;
  const u = spec.unit;
  const [ew, eh] = spec.eye;
  const eyes: Eye[] = [-1, 1].map((side) => {
    const group = new three.Group();
    group.position.set(side * spec.eyeX * u, spec.eyeY * u, spec.z * u);
    parent.add(group);
    const open = new three.Group();
    group.add(open);
    let pupil: THREE.Object3D | undefined;
    if (spec.pupil) {
      const [pw, ph] = spec.pupil;
      open.add(mesh(tools, new Shape(u).cb(spec.white, [0, -eh / 2, 0], [ew, eh, 0.4])));
      pupil = mesh(
        tools,
        new Shape(u)
          .cb(INK, [0, -ph / 2, 0.15], [pw, ph, 0.5])
          .cb(spec.white, [pw * 0.25, ph * 0.15, 0.4], [0.5, 0.5, 0.2]),
      );
      open.add(pupil);
    } else {
      open.add(
        mesh(
          tools,
          new Shape(u)
            .cb(INK, [0, -eh / 2, 0], [ew, eh, 0.45])
            .cb(spec.white, [ew * 0.22, eh * 0.12, 0.2], [0.5, 0.5, 0.15]),
        ),
      );
    }
    const happy = mesh(
      tools,
      new Shape(u)
        .cb(INK, [0, 0.15, 0], [ew * 0.7, 0.55, 0.45])
        .cb(INK, [-ew * 0.45, -0.45, 0], [0.55, 0.75, 0.45])
        .cb(INK, [ew * 0.45, -0.45, 0], [0.55, 0.75, 0.45]),
    );
    group.add(happy);
    return { group, open, pupil, happy, x: group.position.x, y: group.position.y };
  });
  const browY = spec.eyeY + eh / 2 + (spec.browGap ?? 0.9);
  const brows = [-1, 1].map((side) => {
    const group = new three.Group();
    group.position.set(side * spec.eyeX * u, browY * u, spec.z * u);
    group.add(
      mesh(tools, new Shape(u).cb(INK, [0, -0.3, 0.1], [spec.browW ?? ew + 0.4, 0.6, 0.45])),
    );
    parent.add(group);
    return group;
  });
  const shapes = mouthShapes(u, spec.mouthW ?? 2);
  const mouths = MOUTH_SHAPES.map((name) => {
    const object = mesh(tools, shapes[name]);
    object.position.set(0, spec.mouthY * u, (spec.mouthZ ?? spec.z) * u);
    parent.add(object);
    return [name, object] as const;
  });
  const alert = mesh(
    tools,
    new Shape(u)
      .cb('pink', [0, 1.6, 0], [1.2, 3.2, 1.2], 'glow')
      .cb('pink', [0, 0, 0], [1.2, 1.1, 1.2], 'glow'),
  );
  parent.add(alert);
  return {
    update(expression, t, blink) {
      const face = FACE_EXPRESSIONS[expression];
      const happy = face.eye === 'happy';
      eyes.forEach((eye, index) => {
        eye.open.visible = !happy;
        eye.happy.visible = happy;
        const size = (face.size[index] ?? 1) * (face.eye === 'wide' ? 1.2 : 1);
        const lid = face.eye === 'half' ? 0.5 : 1;
        eye.group.scale.set(size, happy ? 1 : size * lid * blink, 1);
        const [lookX, lookY] = face.look;
        if (eye.pupil) {
          eye.pupil.position.set(lookX * 0.8 * u, lookY * 0.8 * u, 0);
        } else {
          eye.group.position.set(
            eye.x + lookX * 0.3 * u,
            eye.y + lookY * 0.3 * u,
            eye.group.position.z,
          );
        }
      });
      brows.forEach((brow, index) => {
        brow.position.y = (browY + (face.brow[index] ?? 0) * 0.7) * u;
        brow.rotation.z = (index === 0 ? 1 : -1) * (face.tilt[index] ?? 0);
      });
      for (const [name, object] of mouths) object.visible = name === face.mouth;
      alert.visible = expression === 'alarm';
      alert.position.set(1.5 * u, (spec.alertY + 0.8 * Math.abs(Math.sin(TAU * 1.6 * t))) * u, 0);
    },
  };
}

function bytes(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Screen's display: an 8 x 5.4-voxel plane at (0, y + 2.7, z) of `parent`. */
export function screenFace(
  tools: KitTools,
  parent: THREE.Object3D,
  unit: number,
  y: number,
  z: number,
): Face {
  const { three } = tools;
  // Background, lit pixel, alarm pixel, alarm flash.
  const colors = ['navy', 'brightTeal', 'pink', 'wine'].map((name) =>
    bytes(castHex(tools.palette, name)),
  );
  const rgba = new Uint8Array(SCREEN_COLUMNS * SCREEN_ROWS * 4);
  const texture = tools.track(
    new three.DataTexture(rgba, SCREEN_COLUMNS, SCREEN_ROWS, three.RGBAFormat),
  );
  texture.magFilter = three.NearestFilter;
  texture.minFilter = three.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  const material = tools.track(new three.MeshBasicMaterial({ map: texture }));
  const geometry = tools.track(new three.PlaneGeometry(8 * unit, 5.4 * unit));
  const plane = new three.Mesh(geometry, material);
  plane.position.set(0, (y + 2.7) * unit, z * unit);
  parent.add(plane);
  let shown = '';
  return {
    update(expression, t, blink) {
      const pixels = screenPixels(expression, t, blink);
      const key = pixels.join('');
      if (key === shown) return;
      shown = key;
      pixels.forEach((pixel, index) => {
        const x = index % SCREEN_COLUMNS;
        // Texture rows are bottom-up (flipY = false), display rows top-down.
        const row = SCREEN_ROWS - 1 - Math.floor(index / SCREEN_COLUMNS);
        const [r, g, b] = colors[pixel] ?? [0, 0, 0];
        rgba.set([r, g, b, 255], (row * SCREEN_COLUMNS + x) * 4);
      });
      texture.needsUpdate = true;
    },
  };
}
