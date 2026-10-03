/**
 * What an annotation can point at: a 3D object (optionally one of its anchors), a world point, a
 * point/region of the frame, or a text card drawn this frame. Validated by hand so a wrong target
 * gets one readable message listing the accepted forms instead of a zod union dump.
 */
import type * as THREE from 'three';
import { z } from 'zod';

export type Vec3Tuple = readonly [number, number, number];

/** A target as scenes write it (see TARGET_FORMS). */
export type AnnotationTarget =
  | THREE.Object3D
  | {
      readonly object: THREE.Object3D;
      readonly anchor?: string;
      readonly offset?: Vec3Tuple;
    }
  | { readonly world: Vec3Tuple }
  | { readonly screen: readonly [number, number]; readonly size?: readonly [number, number] }
  | { readonly card: string; readonly words?: readonly [number, number] };

/** A validated target. */
export type TargetSpec =
  | {
      readonly kind: 'object';
      readonly object: THREE.Object3D;
      readonly anchor: string | undefined;
      readonly offset: Vec3Tuple | undefined;
    }
  | { readonly kind: 'world'; readonly world: Vec3Tuple }
  | {
      readonly kind: 'screen';
      readonly screen: readonly [number, number];
      readonly size: readonly [number, number] | undefined;
    }
  | {
      readonly kind: 'card';
      readonly card: string;
      readonly words: readonly [number, number] | undefined;
    };

export const TARGET_FORMS =
  'a kit object (e.g. state.calc), { object, anchor?: "top", offset?: [x, y, z] }, { world: [x, y, z] }, { screen: [x, y], size?: [w, h] } (0..1 of the frame) or { card: "<ctx.text card id>", words?: [first, last] }';

function isObject3D(value: unknown): value is THREE.Object3D {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isObject3D?: unknown }).isObject3D === true
  );
}

function isFiniteNumbers(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function describe(value: unknown): string {
  if (value === undefined || value === null) return String(value);
  if (Array.isArray(value)) return `an array of ${String(value.length)}`;
  if (typeof value === 'object') return `{ ${Object.keys(value).join(', ')} }`;
  return typeof value;
}

type Parsed = { ok: true; value: TargetSpec } | { ok: false; problem: string };

function parseObjectForm(record: Record<string, unknown>): Parsed {
  const { object, anchor, offset } = record;
  const extra = Object.keys(record).filter((key) => !['object', 'anchor', 'offset'].includes(key));
  if (extra.length > 0) return { ok: false, problem: `unknown key(s) ${extra.join(', ')}` };
  if (!isObject3D(object))
    return { ok: false, problem: `object must be a Three.js/kit object, got ${describe(object)}` };
  if (anchor !== undefined && (typeof anchor !== 'string' || anchor === '')) {
    return { ok: false, problem: 'anchor must be an anchor name such as "top" or "center"' };
  }
  if (offset !== undefined && !isFiniteNumbers(offset, 3)) {
    return { ok: false, problem: 'offset must be [x, y, z] in world units' };
  }
  return {
    ok: true,
    value: {
      kind: 'object',
      object,
      anchor: typeof anchor === 'string' ? anchor : undefined,
      offset: isFiniteNumbers(offset, 3)
        ? [offset[0] ?? 0, offset[1] ?? 0, offset[2] ?? 0]
        : undefined,
    },
  };
}

function only(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  const extra = Object.keys(record).filter((key) => !keys.includes(key));
  return extra.length > 0 ? `unknown key(s) ${extra.join(', ')}` : undefined;
}

function parseRecord(record: Record<string, unknown>): Parsed {
  if ('object' in record) return parseObjectForm(record);
  if ('world' in record) {
    const problem = only(record, ['world']);
    if (problem !== undefined) return { ok: false, problem };
    const { world } = record;
    if (!isFiniteNumbers(world, 3)) return { ok: false, problem: 'world must be [x, y, z]' };
    return {
      ok: true,
      value: { kind: 'world', world: [world[0] ?? 0, world[1] ?? 0, world[2] ?? 0] },
    };
  }
  if ('screen' in record) {
    const problem = only(record, ['screen', 'size']);
    if (problem !== undefined) return { ok: false, problem };
    const { screen, size } = record;
    if (!isFiniteNumbers(screen, 2)) return { ok: false, problem: 'screen must be [x, y] (0..1)' };
    if (size !== undefined && !isFiniteNumbers(size, 2)) {
      return { ok: false, problem: 'size must be [w, h] (shares of the frame)' };
    }
    const region = isFiniteNumbers(size, 2) ? ([size[0] ?? 0, size[1] ?? 0] as const) : undefined;
    return {
      ok: true,
      value: { kind: 'screen', screen: [screen[0] ?? 0, screen[1] ?? 0], size: region },
    };
  }
  if ('card' in record) {
    const problem = only(record, ['card', 'words']);
    if (problem !== undefined) return { ok: false, problem };
    const { card, words } = record;
    if (typeof card !== 'string' || card === '') {
      return { ok: false, problem: 'card must be the id of a ctx.text card (its `id` option)' };
    }
    if (
      words !== undefined &&
      !(isFiniteNumbers(words, 2) && words.every((word) => Number.isInteger(word) && word >= 0))
    ) {
      return { ok: false, problem: 'words must be [first, last] word indices (0-based)' };
    }
    const range = isFiniteNumbers(words, 2) ? ([words[0] ?? 0, words[1] ?? 0] as const) : undefined;
    return { ok: true, value: { kind: 'card', card, words: range } };
  }
  return { ok: false, problem: `got ${describe(record)}` };
}

export function parseTarget(value: unknown): Parsed {
  if (isObject3D(value))
    return {
      ok: true,
      value: { kind: 'object', object: value, anchor: undefined, offset: undefined },
    };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, problem: `got ${describe(value)}` };
  }
  return parseRecord(value as Record<string, unknown>);
}

/** Zod schema of a target option: parsed into a TargetSpec, with one readable message on error. */
export const targetSchema = z
  .custom<AnnotationTarget>((value) => parseTarget(value).ok, {
    error: (issue) => {
      const parsed = parseTarget(issue.input);
      const problem = parsed.ok ? '' : `${parsed.problem}; `;
      return `${problem}a target is ${TARGET_FORMS}`;
    },
  })
  .transform((value): TargetSpec => {
    const parsed = parseTarget(value);
    // The refinement above already rejected invalid input.
    if (!parsed.ok) throw new Error(parsed.problem);
    return parsed.value;
  });
