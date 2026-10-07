/**
 * Per-shot cache keys. A shot's segment is re-rendered only when something that can change its
 * pixels or its encoding changes: scene source, engine/kit version, style preset, palette
 * overrides, project seed, the anchor times the scene uses, the project props (kit-ext) it may
 * call, the project roles (characters/) it may show, the shot's own manifest params, ambient variation (switch + storyboard position), fps,
 * render size, the asset pictures it names (hash, still time, decoded size, decoder version) and
 * the output settings (preset, encoder, quality). Shots that transition in also depend on the
 * previous shot's content.
 */
import { createHash } from 'node:crypto';
import type { ManifestShot, RenderManifest, TimedWord } from '@reelforge/shared';
import { ASSET_DECODE_VERSION } from '../assets/decode.js';
import { refLiterals } from '../assets/refs.js';
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

/**
 * Project props (`kitExtensions`) a scene may call: those whose name it mentions, or all of them
 * when it indexes `props[...]` dynamically. Undefined without project props (keys unchanged).
 */
export function kitExtensionInputs(
  source: string,
  extensions: RenderManifest['kitExtensions'],
): { name: string; source: string }[] | undefined {
  if (extensions === undefined || extensions.length === 0) return undefined;
  return calledExtensions(source, extensions).map((extension) => ({
    name: extension.name,
    source: sha256Hex(extension.source),
  }));
}

type KitExtensions = NonNullable<RenderManifest['kitExtensions']>;

function calledExtensions(source: string, extensions: KitExtensions): KitExtensions {
  const dynamic = /\bprops\s*\[/.test(source);
  return extensions.filter(
    (extension) => dynamic || new RegExp(`\\b${extension.name}\\b`).test(source),
  );
}

type CastFiles = NonNullable<RenderManifest['castRoles']>['roles'];

/** True when `text` names `id` (camelCase, or kebab case: `policeOfficer` / `police-officer`). */
function namesCastId(text: string, id: string): boolean {
  const kebab = id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return [id, kebab].some((form) => new RegExp(String.raw`(?<![\w-])${form}(?![\w-])`).test(text));
}

/** A `kit.cast` call whose id/spec is not a literal: any project role may be shown. */
const DYNAMIC_CAST = /\bcast\s*(?:\[|\.\s*(?:person|role|spec)\s*\(\s*(?![\s'"`{]))/;

function castHashes(files: CastFiles): { id: string; source: string }[] {
  return files.map((file) => ({ id: file.id, source: sha256Hex(file.source) }));
}

/**
 * Project roles (`castRoles`, ADR-026) a scene may show: the roles whose id it names (all of them
 * when a `kit.cast` call takes a computed id) and the accessory extensions the scene or those
 * roles name. Undefined without project roles (keys unchanged).
 */
export function castRoleInputs(
  source: string,
  castRoles: RenderManifest['castRoles'],
):
  | { roles: { id: string; source: string }[]; accessories: { id: string; source: string }[] }
  | undefined {
  if (castRoles === undefined) return undefined;
  if (castRoles.roles.length === 0 && castRoles.accessories.length === 0) return undefined;
  const dynamic = DYNAMIC_CAST.test(source);
  const roles = castRoles.roles.filter((role) => dynamic || namesCastId(source, role.id));
  const texts = [source, ...roles.map((role) => role.source)];
  const accessories = castRoles.accessories.filter((accessory) =>
    texts.some((text) => namesCastId(text, accessory.id)),
  );
  return { roles: castHashes(roles), accessories: castHashes(accessories) };
}

/**
 * Asset pictures a shot can show (PLAN.md#12.11): the manifest refs its scene or the project props
 * it calls name as string literals. Stylisation options are part of the scene source, the
 * stylising code is covered by the engine/kit versions. Undefined without manifest assets (keys
 * unchanged).
 */
export function assetInputs(
  source: string,
  manifest: Pick<RenderManifest, 'assets' | 'kitExtensions'>,
): unknown[] | undefined {
  const assets = manifest.assets;
  if (assets === undefined || assets.length === 0) return undefined;
  const props = calledExtensions(source, manifest.kitExtensions ?? []);
  const named = new Set([source, ...props.map((prop) => prop.source)].flatMap(refLiterals));
  return assets
    .filter((asset) => named.has(asset.ref))
    .map((asset) => ({
      ref: asset.ref,
      sha256: asset.sha256,
      at: asset.at ?? null,
      size: [asset.width, asset.height],
      decoder: ASSET_DECODE_VERSION,
    }));
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
    kitExtensions: kitExtensionInputs(shot.scene.source, manifest.kitExtensions),
    // Project roles (ADR-026): undefined (left out) without any, so old keys stay valid.
    castRoles: castRoleInputs(shot.scene.source, manifest.castRoles),
    assets: assetInputs(shot.scene.source, manifest),
    // Undefined (left out of the key) unless ambient variation is on: old keys stay valid.
    ambient: manifest.ambientVariation === undefined ? undefined : (shot.ambient ?? null),
    // Reveal moments (PLAN.md#12.27): undefined (left out) without any, so old keys stay valid.
    timeRemap: shot.timeRemap,
    paletteShift: shot.paletteShift,
    // Live co-direction (PLAN.md#12.14): undefined (left out) without one.
    direction: shot.direction,
    // World assets (PLAN.md#13.15): every shot of a world may draw any of them; undefined
    // (left out) without any, so old keys stay valid.
    worldAssets: worldAssetInputs(manifest.worldAssets),
  };
}

/** The world asset files' hashes (sorted by file), or undefined without a `worldAssets` field. */
export function worldAssetInputs(
  worldAssets: RenderManifest['worldAssets'],
): { world: string; files: { file: string; source: string }[] } | undefined {
  if (worldAssets === undefined) return undefined;
  const files = [...worldAssets.files]
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map((entry) => ({ file: entry.file, source: sha256Hex(entry.source) }));
  return { world: worldAssets.world, files };
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
    ambientVariation: manifest.ambientVariation,
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
