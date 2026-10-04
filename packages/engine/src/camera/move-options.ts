/**
 * Validation of the camera move options (`ctx.camera.rackFocus/dollyZoom/orbit/parallax`).
 * Scenes are plain JavaScript written by an LLM, so every option is checked at the call and a
 * wrong one throws an `invalid-camera-move` EngineError that says what to pass instead.
 */
import type * as THREE from 'three';
import type { AnchorHit, Vec3 } from '../contract.js';
import { EngineError } from '../errors.js';
import { MAX_BOKEH_RADIUS } from './bokeh.js';
import { resolveEase } from './easing.js';
import type {
  DollyZoomOptions,
  MoveSubject,
  MoveTime,
  MoveTiming,
  OrbitMoveOptions,
  ParallaxLayer,
  ParallaxOptions,
  RackFocusOptions,
} from './moves.js';

export type MoveName = 'rackFocus' | 'dollyZoom' | 'orbit' | 'parallax';

/** Throws an `invalid-camera-move` error for `ctx.camera.<move>`. */
export type MoveFail = (move: MoveName, message: string) => never;

export function moveFailer(shotId: string): MoveFail {
  return (move, message) => {
    throw new EngineError('invalid-camera-move', `ctx.camera.${move}: ${message}`, { shotId });
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

export function isObject3D(value: unknown): value is THREE.Object3D {
  return isRecord(value) && value['isObject3D'] === true;
}

function isAnchorHit(value: unknown): value is AnchorHit {
  return isRecord(value) && isFiniteNumber(value['t']) && isFiniteNumber(value['tEnd']);
}

function checkTime(move: MoveName, name: string, value: unknown, fail: MoveFail): MoveTime {
  if (isFiniteNumber(value) || isAnchorHit(value)) return value;
  return fail(move, `${name} must be local seconds or an anchor (ctx.anchor('phrase'))`);
}

function checkTiming(move: MoveName, options: unknown, fail: MoveFail): Record<string, unknown> {
  if (!isRecord(options)) return fail(move, 'pass an options object, e.g. { t0: 0, t1: 2, ... }');
  checkTime(move, 't0', options['t0'], fail);
  checkTime(move, 't1', options['t1'], fail);
  const ease = options['ease'];
  if (ease !== undefined) {
    if (typeof ease !== 'string' && typeof ease !== 'function')
      fail(move, 'ease must be an easing name or a function');
    try {
      resolveEase(ease as MoveTiming['ease']);
    } catch (error) {
      fail(move, error instanceof Error ? error.message : String(error));
    }
  }
  return options;
}

function checkNumber(
  move: MoveName,
  name: string,
  value: unknown,
  fail: MoveFail,
  range: { min?: number; above?: number; max?: number } = {},
): number {
  if (!isFiniteNumber(value)) return fail(move, `${name} must be a finite number`);
  if (range.above !== undefined && !(value > range.above))
    fail(move, `${name} must be greater than ${String(range.above)}`);
  if (range.min !== undefined && value < range.min)
    fail(move, `${name} must be at least ${String(range.min)}`);
  if (range.max !== undefined && value > range.max)
    fail(move, `${name} must be at most ${String(range.max)}`);
  return value;
}

function checkSubject(move: MoveName, name: string, value: unknown, fail: MoveFail): MoveSubject {
  if (isVec3(value) || isObject3D(value)) return value;
  return fail(move, `${name} must be a world point [x, y, z] or an object (e.g. a kit prop)`);
}

export function checkRackFocus(options: unknown, fail: MoveFail): RackFocusOptions {
  const record = checkTiming('rackFocus', options, fail);
  for (const name of ['from', 'to']) {
    const value = record[name];
    if (typeof value === 'number') checkNumber('rackFocus', name, value, fail, { above: 0 });
    else checkSubject('rackFocus', name, value, fail);
  }
  if (record['bokeh'] !== undefined)
    checkNumber('rackFocus', 'bokeh', record['bokeh'], fail, { min: 0, max: MAX_BOKEH_RADIUS });
  return record as unknown as RackFocusOptions;
}

export function checkDollyZoom(options: unknown, fail: MoveFail): DollyZoomOptions {
  const record = checkTiming('dollyZoom', options, fail);
  checkNumber('dollyZoom', 'from', record['from'], fail, { above: 0 });
  checkNumber('dollyZoom', 'to', record['to'], fail, { above: 0 });
  if (record['subject'] !== undefined)
    checkSubject('dollyZoom', 'subject', record['subject'], fail);
  return record as unknown as DollyZoomOptions;
}

export function checkOrbitMove(options: unknown, fail: MoveFail): OrbitMoveOptions {
  const record = checkTiming('orbit', options, fail);
  checkNumber('orbit', 'degrees', record['degrees'], fail);
  const axis = record['axis'];
  if (axis !== undefined && axis !== 'x' && axis !== 'y') {
    if (!isVec3(axis) || Math.hypot(...axis) === 0)
      fail('orbit', "axis must be 'y', 'x' or a non-zero world axis [x, y, z]");
  }
  if (record['radius'] !== undefined)
    checkNumber('orbit', 'radius', record['radius'], fail, { above: 0 });
  if (record['target'] !== undefined) checkSubject('orbit', 'target', record['target'], fail);
  return record as unknown as OrbitMoveOptions;
}

function checkLayer(layer: unknown, index: number, fail: MoveFail): ParallaxLayer {
  const name = `layers[${String(index)}]`;
  if (!isRecord(layer)) return fail('parallax', `${name} must be an object with a ratio`);
  checkNumber('parallax', `${name}.ratio`, layer['ratio'], fail);
  const kit = layer['kit'];
  const objects = layer['objects'];
  if (kit !== undefined) {
    const tags = Array.isArray(kit) ? kit : [kit];
    if (tags.length === 0 || !tags.every((tag) => typeof tag === 'string' && tag.length > 0))
      fail('parallax', `${name}.kit must be a kit kind ('env', 'prop', 'fx') or name, or a list`);
  } else if (objects !== undefined) {
    if (!Array.isArray(objects) || !objects.every(isObject3D))
      fail('parallax', `${name}.objects must be a list of scene objects`);
  } else {
    const near = layer['near'] ?? 0;
    const far = layer['far'] ?? Number.POSITIVE_INFINITY;
    if (typeof near !== 'number' || typeof far !== 'number' || !(near >= 0) || !(far > near))
      fail('parallax', `${name} needs 0 <= near < far (distances from the camera), kit or objects`);
  }
  return layer as unknown as ParallaxLayer;
}

export function checkParallax(options: unknown, fail: MoveFail): ParallaxOptions {
  const record = checkTiming('parallax', options, fail);
  checkNumber('parallax', 'amount', record['amount'], fail);
  const layers = record['layers'];
  if (layers !== undefined) {
    if (!Array.isArray(layers)) fail('parallax', 'layers must be a list');
    else layers.forEach((layer, index) => checkLayer(layer, index, fail));
  }
  return record as unknown as ParallaxOptions;
}
