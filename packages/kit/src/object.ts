/**
 * Kit objects: Three.js groups with named anchor points, placement on surfaces and disposal.
 * Every voxel mesh, prop, environment and group the kit returns is a KitObject, so scenes can
 * `scene.add(desk)`, `kit.props.calculator().on(desk)` and animate `.position/.rotation`.
 */
import type * as THREE from 'three';
import { KitError } from './errors.js';
import type { Vec3 } from './types.js';

export type Three = typeof THREE;

/** Anchors every kit object has, derived from its local bounds. */
export const STANDARD_ANCHORS = [
  'center',
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
] as const;

const STANDARD_ANCHOR_SET: ReadonlySet<string> = new Set(STANDARD_ANCHORS);

export interface OnOptions {
  /** Anchor of the surface to stand on (default 'top'). */
  readonly at?: string | undefined;
  /** Own anchor that touches it (default 'bottom'). */
  readonly align?: string | undefined;
  /** Extra offset in the surface's local units. */
  readonly offset?: Vec3 | undefined;
}

export type MountOptions = Omit<OnOptions, 'at'>;

export interface KitObjectMethods {
  /** 'voxel', 'group' or the registered prop/env/fx name. */
  readonly kitType: string;
  /** Local position of an anchor (a new Vector3); default 'center'. */
  anchor(name?: string): THREE.Vector3;
  anchorNames(): string[];
  /** Adds or moves a named anchor (local units). */
  setAnchor<T extends KitObject>(this: T, name: string, point: Vec3): T;
  /** Local axis-aligned bounds of the visible content. */
  bounds(): THREE.Box3;
  /**
   * Parents this object to `surface` and places its `align` anchor (default 'bottom') on the
   * surface's `at` anchor (default 'top'). Uses the current scale and rotation.
   */
  on<T extends KitObject>(this: T, surface: KitObject, options?: OnOptions): T;
  /** `child.on(this, { at, ...options })`; returns this. */
  mount<T extends KitObject>(this: T, child: KitObject, at: string, options?: MountOptions): T;
  /** Frees GPU resources created for this object and its mounted kit objects, detaches it. */
  dispose(): void;
}

export type KitObject = THREE.Group & KitObjectMethods;

export interface Disposable {
  dispose(): void;
}

export interface KitObjectSpec {
  readonly kitType: string;
  /** Local bounds; default: union of the children's bounds. */
  readonly bounds?: (() => THREE.Box3) | undefined;
  /** Custom anchors in local units. */
  readonly anchors?: Readonly<Record<string, Vec3>> | undefined;
  /** Resources owned by this object (geometries), freed by dispose(). */
  readonly resources?: readonly Disposable[] | undefined;
}

export function isKitObject(value: unknown): value is KitObject {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<KitObjectMethods> & { isObject3D?: unknown };
  return (
    candidate.isObject3D === true &&
    typeof candidate.kitType === 'string' &&
    typeof candidate.anchor === 'function'
  );
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return typeof value;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' ? `a ${type}` : 'an object';
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as Partial<THREE.Mesh>).isMesh === true;
}

/** Union of the children's local bounds, in the group's local space. */
function childrenBounds(three: Three, group: THREE.Group): THREE.Box3 {
  const box = new three.Box3();
  for (const child of group.children) {
    child.updateMatrix();
    let local: THREE.Box3 | undefined;
    if (isKitObject(child)) {
      local = child.bounds();
    } else if (isMesh(child)) {
      const geometry = child.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      local = geometry.boundingBox?.clone();
    }
    if (local && !local.isEmpty()) box.union(local.applyMatrix4(child.matrix));
  }
  return box;
}

function standardAnchor(three: Three, box: THREE.Box3, name: string): THREE.Vector3 | undefined {
  if (!STANDARD_ANCHOR_SET.has(name)) return undefined;
  if (box.isEmpty()) return new three.Vector3();
  const point = box.getCenter(new three.Vector3());
  if (name === 'top') point.y = box.max.y;
  if (name === 'bottom') point.y = box.min.y;
  if (name === 'front') point.z = box.max.z;
  if (name === 'back') point.z = box.min.z;
  if (name === 'left') point.x = box.min.x;
  if (name === 'right') point.x = box.max.x;
  return point;
}

function placeOn(three: Three, self: KitObject, surface: unknown, options: OnOptions): void {
  if (!isKitObject(surface)) {
    throw new KitError(
      'invalid-surface',
      `on(surface): surface must be a kit object (kit.voxel.mesh/group, kit.props.*, kit.env.*), got ${describe(surface)}`,
    );
  }
  if (surface === self)
    throw new KitError('invalid-surface', 'on(surface): an object cannot stand on itself');
  const target = surface.anchor(options.at ?? 'top');
  const own = self
    .anchor(options.align ?? 'bottom')
    .multiply(self.scale)
    .applyQuaternion(self.quaternion);
  const [ox, oy, oz] = options.offset ?? [0, 0, 0];
  self.position
    .copy(target)
    .sub(own)
    .add(new three.Vector3(ox, oy, oz));
  surface.add(self);
}

/** Turns a fresh group into a KitObject. */
export function createKitObject(three: Three, spec: KitObjectSpec): KitObject {
  const group = new three.Group();
  group.name = spec.kitType;
  const custom = new Map<string, THREE.Vector3>();
  for (const [name, [x, y, z]] of Object.entries(spec.anchors ?? {})) {
    custom.set(name, new three.Vector3(x, y, z));
  }
  const bounds = spec.bounds ?? (() => childrenBounds(three, group));
  const resources = [...(spec.resources ?? [])];
  const methods: KitObjectMethods = {
    kitType: spec.kitType,
    anchor(name = 'center') {
      const point = custom.get(name)?.clone() ?? standardAnchor(three, bounds(), name);
      if (point) return point;
      throw new KitError(
        'invalid-anchor',
        `${spec.kitType}: no anchor "${name}" (available: ${this.anchorNames().join(', ')})`,
      );
    },
    anchorNames() {
      return [
        ...STANDARD_ANCHORS,
        ...[...custom.keys()].filter((name) => !STANDARD_ANCHOR_SET.has(name)),
      ];
    },
    setAnchor(name, [x, y, z]) {
      custom.set(name, new three.Vector3(x, y, z));
      return this;
    },
    bounds: () => bounds().clone(),
    on(surface, options = {}) {
      placeOn(three, this, surface, options);
      return this;
    },
    mount(child, at, options = {}) {
      if (!isKitObject(child)) {
        throw new KitError(
          'invalid-surface',
          `mount(child, "${at}"): child must be a kit object, got ${describe(child)}`,
        );
      }
      child.on(this, { ...options, at });
      return this;
    },
    dispose() {
      for (const child of [...group.children]) if (isKitObject(child)) child.dispose();
      for (const resource of resources.splice(0)) resource.dispose();
      group.removeFromParent();
    },
  };
  return Object.assign(group, methods);
}
