/**
 * Static checks of a scene's source: kit calls of props/environments/effects the installed kit
 * does not have (PLAN.md#7.4, "missing prop"), and text too small to read on a phone (PLAN.md#7.6:
 * glyph scale ≥ 2 and ≥ N px high at 640 wide). Text sizes are read from the literal options of
 * the `ctx.text` calls and of the `ctx.annotate` calls with labels (PLAN.md#11.8); computed scales
 * are not judged.
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
    secondary: kind === 'lowerThird' && second !== undefined && second.type !== 'ObjectExpression',
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
