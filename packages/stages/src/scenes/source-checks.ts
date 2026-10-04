/**
 * Static checks of a scene's source: kit calls of props/environments/effects the installed kit
 * does not have (PLAN.md#7.4, "missing prop"), and text too small to read on a phone (PLAN.md#7.6:
 * glyph scale ≥ 2 and ≥ N px high at 640 wide). Text sizes are read from the literal options of
 * the `ctx.text` calls and of the `ctx.annotate` calls with labels (PLAN.md#11.8); computed scales
 * are not judged. Also photos embedded as thumbnails (polaroid/photoFrame below 96x72 px).
 */
import { parse, type AnyNode, type CallExpression, type ObjectExpression } from 'acorn';
import { DISPLAY_FONT, MONO_FONT } from '@reelforge/engine';
import type { QaFinding } from '@reelforge/shared';
import { finding } from './checks.js';
import type { KitNames } from './tools.js';

const KIT_CALL = /\bkit\s*\.\s*(env|props|fx)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;

export interface KitCall {
  readonly kind: 'env' | 'props' | 'fx';
  readonly name: string;
}

/** `kit.<kind>.<name>(` calls the kit does not provide, in order of first use. */
export function unknownKitCalls(source: string, kit: KitNames): KitCall[] {
  const unknown = new Map<string, KitCall>();
  for (const match of source.matchAll(KIT_CALL)) {
    const [, group = '', name = ''] = match;
    const kind = group === 'env' ? 'env' : group === 'props' ? 'props' : 'fx';
    const known = kind === 'env' ? kit.env : kind === 'props' ? kit.props : kit.fx;
    if (!known.has(name)) unknown.set(`${kind}.${name}`, { kind, name });
  }
  return [...unknown.values()];
}

/** `kit.<kind>.<name>(` names the kit does not provide, in order of first use. */
export function unknownKitNames(source: string, kit: KitNames): string[] {
  return [...new Set(unknownKitCalls(source, kit).map((call) => call.name))];
}

const TEXT_CALLS = new Set(['title', 'kinetic', 'lowerThird']);
/** `ctx.annotate` calls that draw text (badge: its number, sized by `size`). */
const ANNOTATE_TEXT_CALLS = new Set([
  'callout',
  'pin',
  'arrow',
  'bracket',
  'dimension',
  'stamp',
  'badge',
]);
/** Badge number glyph height as a share of its diameter (engine annotations/draw-marks.ts). */
const BADGE_GLYPH_SHARE = 0.62;

export interface TextCall {
  /** `title`, `kinetic`, `lowerThird`, or `annotate.<type>` for annotation labels. */
  readonly kind: string;
  readonly line: number;
  /** Literal `scale`, undefined when omitted or computed. */
  readonly scale: number | undefined;
  readonly computedScale: boolean;
  readonly font: string | undefined;
  /** lowerThird(primary, secondary): the secondary line is mono at scale 1. */
  readonly secondary: boolean;
  /** Literal `size` (badges: diameter as a share of the frame height). */
  readonly size?: number | undefined;
}

function isNode(value: unknown): value is AnyNode {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { type?: unknown; start?: unknown };
  return typeof candidate.type === 'string' && typeof candidate.start === 'number';
}

function visit(node: AnyNode, callback: (node: AnyNode) => void): void {
  callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) visit(item, callback);
    } else if (isNode(value)) visit(value, callback);
  }
}

function ownerIs(owner: AnyNode, name: string): boolean {
  return (
    (owner.type === 'Identifier' && owner.name === name) ||
    (owner.type === 'MemberExpression' &&
      !owner.computed &&
      owner.property.type === 'Identifier' &&
      owner.property.name === name)
  );
}

function textCallKind(call: CallExpression): string | undefined {
  const callee = call.callee;
  if (callee.type !== 'MemberExpression' || callee.computed) return undefined;
  if (callee.property.type !== 'Identifier') return undefined;
  const method = callee.property.name;
  if (TEXT_CALLS.has(method) && ownerIs(callee.object, 'text')) return method;
  if (ANNOTATE_TEXT_CALLS.has(method) && ownerIs(callee.object, 'annotate')) {
    return `annotate.${method}`;
  }
  return undefined;
}

function optionValue(options: ObjectExpression | undefined, key: string): AnyNode | undefined {
  for (const property of options?.properties ?? []) {
    if (property.type !== 'Property' || property.computed) continue;
    const name = property.key.type === 'Identifier' ? property.key.name : undefined;
    if (name === key) return property.value;
  }
  return undefined;
}

/**
 * A lower third's second argument draws a secondary line unless it is the options object or an
 * explicit "no line": `null`, `undefined` or `''` (real run 2.3: dropping the line as the finding
 * asks, `lowerThird("NAME", null, {...})`, was still flagged and cost two fix turns per shot).
 */
function hasSecondaryLine(second: AnyNode | undefined): boolean {
  if (second === undefined || second.type === 'ObjectExpression') return false;
  if (second.type === 'Literal') return second.value !== null && second.value !== '';
  return !(second.type === 'Identifier' && second.name === 'undefined');
}

function toTextCall(call: CallExpression, kind: string): TextCall {
  const options = call.arguments.find(
    (argument): argument is ObjectExpression => argument.type === 'ObjectExpression',
  );
  const scale = optionValue(options, 'scale');
  const font = optionValue(options, 'font');
  const size = optionValue(options, 'size');
  const second = call.arguments[1];
  return {
    kind,
    line: call.loc?.start.line ?? 1,
    scale: scale?.type === 'Literal' && typeof scale.value === 'number' ? scale.value : undefined,
    computedScale: scale !== undefined && scale.type !== 'Literal',
    font: font?.type === 'Literal' && typeof font.value === 'string' ? font.value : undefined,
    secondary: kind === 'lowerThird' && hasSecondaryLine(second),
    size: size?.type === 'Literal' && typeof size.value === 'number' ? size.value : undefined,
  };
}

/**
 * `ctx.text.title/kinetic/lowerThird` and labelled `ctx.annotate.*` calls; [] when the source does
 * not parse (lint reports it).
 */
export function findTextCalls(source: string): TextCall[] {
  let program: AnyNode;
  try {
    program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
  const calls: TextCall[] = [];
  visit(program, (node) => {
    if (node.type !== 'CallExpression') return;
    const kind = textCallKind(node);
    if (kind !== undefined) calls.push(toTextCall(node, kind));
  });
  return calls;
}

export interface LegibilityRules {
  readonly minScale: number;
  /** Minimum glyph (cap) height at 640 px frame width; scaled with the actual width. */
  readonly minGlyphPx: number;
  readonly frameWidth: number;
}

/**
 * Effective scale: literal, else mono = 1 (ctx.text), else the engine default (≥ 2 for display
 * text and every annotation label); a badge with a literal size gets the number scale it fits.
 */
function effectiveScale(call: TextCall, frameWidth: number): number | undefined {
  if (call.scale !== undefined) return call.scale;
  if (call.computedScale) return undefined;
  if (call.kind === 'annotate.badge' && call.size !== undefined) {
    const diameter = call.size * ((frameWidth * 9) / 16);
    return Math.max(1, Math.floor((diameter * BADGE_GLYPH_SHARE) / DISPLAY_FONT.capHeight));
  }
  if (call.kind.startsWith('annotate.')) return undefined;
  return call.font === 'mono' ? 1 : undefined;
}

export function legibilityFindings(
  source: string,
  file: string,
  rules: LegibilityRules,
): QaFinding[] {
  const minPx = Math.ceil((rules.minGlyphPx * rules.frameWidth) / 640);
  const findings: QaFinding[] = [];
  for (const call of findTextCalls(source)) {
    const annotation = call.kind.startsWith('annotate.');
    const where = `${file}:${String(call.line)} ctx.${annotation ? '' : 'text.'}${call.kind}`;
    const scale = effectiveScale(call, rules.frameWidth);
    const advice =
      call.kind === 'annotate.badge'
        ? 'Make the badge bigger (size) or drop size for the default.'
        : 'Raise its scale (shorten or wrap the text with maxWidth so it still fits the safe area).';
    const capHeight = call.font === 'mono' ? MONO_FONT.capHeight : DISPLAY_FONT.capHeight;
    if (scale !== undefined && (scale < rules.minScale || scale * capHeight < minPx)) {
      findings.push(
        finding(
          'legibility',
          'error',
          `${where}: text at scale ${String(scale)} is ${String(scale * capHeight)} px high, too small on a phone (needs scale ≥ ${String(rules.minScale)} and ≥ ${String(minPx)} px). ${advice}`,
        ),
      );
    }
    if (call.secondary) {
      findings.push(
        finding(
          'legibility',
          'error',
          `${where}: the secondary line of a lower third is mono at scale 1 (${String(MONO_FONT.capHeight)} px), too small on a phone. Drop it or show that text as its own card with scale ≥ ${String(rules.minScale)}.`,
        ),
      );
    }
  }
  return findings;
}

/** Smallest readable embedded photo at 640x360 (real run 2.3: a 48-px polaroid in a wide shot). */
export const MIN_ASSET_PX: readonly [number, number] = [96, 72];
/** Picture size of the photo props when `pixels` is omitted (kit assets/frames.ts). */
const PHOTO_PROPS: Readonly<Record<string, { readonly pixels: number; readonly square: boolean }>> =
  {
    polaroid: { pixels: 48, square: true },
    photoFrame: { pixels: 64, square: false },
  };
/** Height of a framed photo whose aspect the source cannot tell (4:3 landscape). */
const UNKNOWN_ASPECT = 3 / 4;

function photoPropName(call: CallExpression): string | undefined {
  const callee = call.callee;
  if (callee.type === 'Identifier') return callee.name in PHOTO_PROPS ? callee.name : undefined;
  if (callee.type !== 'MemberExpression' || callee.computed) return undefined;
  if (callee.property.type !== 'Identifier' || !(callee.property.name in PHOTO_PROPS)) {
    return undefined;
  }
  return ownerIs(callee.object, 'props') ? callee.property.name : undefined;
}

/** A literal number option, its default when omitted, undefined when computed. */
function literalNumber(options: ObjectExpression, key: string, fallback: number) {
  const value = optionValue(options, key);
  if (value === undefined) return fallback;
  return value.type === 'Literal' && typeof value.value === 'number' ? value.value : undefined;
}

/**
 * Photos embedded through `kit.props.polaroid` / `photoFrame` (an `asset` option) whose picture is
 * smaller than MIN_ASSET_PX (pixels × scale; computed values are not judged): a warning, since
 * only a camera very close to the prop would make such a picture readable.
 */
export function assetSizeFindings(source: string, file: string): QaFinding[] {
  let program: AnyNode;
  try {
    program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
  const [minWidth, minHeight] = MIN_ASSET_PX;
  const findings: QaFinding[] = [];
  visit(program, (node) => {
    if (node.type !== 'CallExpression') return;
    const name = photoPropName(node);
    const options = node.arguments[0];
    const prop = name === undefined ? undefined : PHOTO_PROPS[name];
    if (prop === undefined || options?.type !== 'ObjectExpression') return;
    if (optionValue(options, 'asset') === undefined) return;
    const pixels = literalNumber(options, 'pixels', prop.pixels);
    const scale = literalNumber(options, 'scale', 1);
    if (pixels === undefined || scale === undefined) return;
    const width = Math.round(pixels * scale);
    const height = prop.square ? width : Math.round(width * UNKNOWN_ASPECT);
    if (width >= minWidth && height >= minHeight) return;
    const where = `${file}:${String(node.loc?.start.line ?? 1)} kit.props.${name ?? ''}`;
    findings.push(
      finding(
        'legibility',
        'warning',
        `${where}: the photo is a ${String(width)}x${String(height)} px picture, below ${String(minWidth)}x${String(minHeight)} px at 640x360 it is an unreadable thumbnail on a phone. Enlarge it (pixels 96-128 or scale, camera close, at least a third of the frame height while the narration names it) or drop it.`,
      ),
    );
  });
  return findings;
}
