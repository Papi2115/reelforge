/**
 * Per-shot cache keys. A shot's segment is re-rendered only when something that can change its
 * pixels or its encoding changes: scene source, engine/kit version, style preset, palette
 * overrides, project seed, the anchor times the scene uses, the shot's own manifest params, fps,
 * render size, and the output settings (preset, encoder, quality). Shots that transition in also
 * depend on the previous shot's content.
 */
import { createHash } from 'node:crypto';
import type { ManifestShot, RenderManifest, TimedWord } from '@reelforge/shared';
import type { PlannedShot } from './shot-plan.js';

/** Bump when the segment format or the key recipe changes (invalidates every cached segment). */
export const SEGMENT_CACHE_VERSION = 1;

/** What produced the frames, beyond the manifest: supplied by the app (from the engine/kit). */
export interface RenderIdentity {
  /** Engine version or build hash; any engine change must change this. */
  readonly engineVersion: string;
  /** Kit version or build hash. */
  readonly kitVersion: string;
  readonly style: {
    readonly id: string;
    /** Render size of the style (must match the frames the source returns). */
    readonly width: number;
    readonly height: number;
    /** The full style preset JSON as the engine uses it. */
    readonly preset: unknown;
  };
}

export interface AnchorSpan {
  readonly t: number;
  readonly tEnd: number;
}

/** Same contract as the engine's resolver: nth (1-based) occurrence of a phrase. */
export type AnchorResolver = (phrase: string, nth: number) => AnchorSpan | undefined;

export interface AnchorUse {
  readonly phrase: string;
  readonly nth: number;
}

/**
 * Anchors a scene asks for, found statically: `anchor('phrase')` / `anchor("phrase", 2)`.
 * Returns null when the source uses `anchor` in any way this cannot see through (variables,
 * template literals with expressions, aliases) - callers must then assume every word matters.
 */
export function extractAnchorUses(source: string): AnchorUse[] | null {
  const literalCall =
    /\banchor\s*\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)\s*(?:,\s*(\d+)\s*)?\)/g;
  const uses: AnchorUse[] = [];
  for (const match of source.matchAll(literalCall)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    uses.push({ phrase: raw.replace(/\\(.)/g, '$1'), nth: Number(match[4] ?? '1') });
  }
  const rest = source.replace(literalCall, '');
  // Any other mention except destructuring shorthand (`{ anchor, rng }`) is opaque to us.
  const opaque = [...rest.matchAll(/\banchor\b/g)].some((match) => {
    const after = rest.slice(match.index + 'anchor'.length);
    return !/^\s*[,}]/.test(after);
  });
  return opaque ? null : uses;
}

/** JSON with object keys sorted, so equal values always hash equally. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function wordsDigest(words: readonly TimedWord[] | undefined): string {
  return sha256Hex(stableStringify(words ?? []));
}

/** The anchor data a shot's frames depend on. */
function anchorInputs(
  shot: ManifestShot,
  manifest: RenderManifest,
  resolveAnchor: AnchorResolver | undefined,
): unknown {
  const uses = extractAnchorUses(shot.scene.source);
  if (uses === null || (uses.length > 0 && resolveAnchor === undefined)) {
    return { allWords: wordsDigest(manifest.words?.words) };
  }
  return uses.map((use) => {
    const span = resolveAnchor?.(use.phrase, use.nth);
    return { ...use, span: span === undefined ? null : { t: span.t, tEnd: span.tEnd } };
  });
}

function shotContent(
  shot: ManifestShot,
  manifest: RenderManifest,
  resolveAnchor: AnchorResolver | undefined,
): unknown {
  return {
    id: shot.id,
    t0: shot.t0,
    t1: shot.t1,
    transitionIn: shot.transitionIn ?? null,
    scene: sha256Hex(shot.scene.source),
    anchors: anchorInputs(shot, manifest, resolveAnchor),
  };
}

export interface SegmentKeyInput {
  readonly manifest: RenderManifest;
  readonly planned: PlannedShot;
  readonly identity: RenderIdentity;
  /** Encoder/preset/quality fingerprint of the media backend (see `ExportMedia.outputKey`). */
  readonly outputKey: string;
  readonly resolveAnchor?: AnchorResolver | undefined;
}

export function segmentCacheKey(input: SegmentKeyInput): string {
  const { manifest, planned, identity } = input;
  const recipe = {
    v: SEGMENT_CACHE_VERSION,
    engine: identity.engineVersion,
    kit: identity.kitVersion,
    style: identity.style,
    palette: manifest.palette ?? null,
    seed: manifest.seed,
    fps: manifest.fps,
    frames: [planned.startFrame, planned.endFrame],
    shot: shotContent(planned.shot, manifest, input.resolveAnchor),
    incoming:
      planned.incoming === null
        ? null
        : shotContent(planned.incoming, manifest, input.resolveAnchor),
    output: input.outputKey,
  };
  return sha256Hex(stableStringify(recipe));
}
