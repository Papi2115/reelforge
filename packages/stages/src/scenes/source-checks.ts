/**
 * Static checks of a scene's source: kit calls of props/environments/effects the installed kit
 * does not have (PLAN.md#7.4, "missing prop"), and text too small to read on a phone (PLAN.md#7.6:
 * glyph scale ≥ 2 and ≥ N px high at 640 wide). Text sizes are read from the `ctx.text` calls'
 * literal options; computed scales are not judged.
 */
import { parse, type AnyNode, type CallExpression, type ObjectExpression } from 'acorn';
import { DISPLAY_FONT, MONO_FONT } from '@reelforge/engine';
import type { QaFinding } from '@reelforge/shared';
import { finding } from './checks.js';
import type { KitNames } from './tools.js';

const KIT_CALL = /\bkit\s*\.\s*(env|props|fx)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;

/** `kit.<kind>.<name>(` names the kit does not provide, in order of first use. */
export function unknownKitNames(source: string, kit: KitNames): string[] {
  const unknown = new Set<string>();
  for (const match of source.matchAll(KIT_CALL)) {
    const [, kind = '', name = ''] = match;
    const known = kind === 'env' ? kit.env : kind === 'props' ? kit.props : kit.fx;
    if (!known.has(name)) unknown.add(name);
  }
  return [...unknown];
}

const TEXT_CALLS = new Set(['title', 'kinetic', 'lowerThird']);

export interface TextCall {
  readonly kind: string;
  readonly line: number;
  /** Literal `scale`, undefined when omitted or computed. */
  readonly scale: number | undefined;
  readonly computedScale: boolean;
  readonly font: string | undefined;
  /** lowerThird(primary, secondary): the secondary line is mono at scale 1. */
  readonly secondary: boolean;
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

function textCallKind(call: CallExpression): string | undefined {
  const callee = call.callee;
  if (callee.type !== 'MemberExpression' || callee.computed) return undefined;
  if (callee.property.type !== 'Identifier' || !TEXT_CALLS.has(callee.property.name)) {
    return undefined;
  }
  const owner = callee.object;
  const isText =
    (owner.type === 'Identifier' && owner.name === 'text') ||
    (owner.type === 'MemberExpression' &&
      !owner.computed &&
      owner.property.type === 'Identifier' &&
      owner.property.name === 'text');
  return isText ? callee.property.name : undefined;
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
  const second = call.arguments[1];
  return {
    kind,
    line: call.loc?.start.line ?? 1,
    scale: scale?.type === 'Literal' && typeof scale.value === 'number' ? scale.value : undefined,
    computedScale: scale !== undefined && scale.type !== 'Literal',
    font: font?.type === 'Literal' && typeof font.value === 'string' ? font.value : undefined,
    secondary: kind === 'lowerThird' && second !== undefined && second.type !== 'ObjectExpression',
  };
}

/** `ctx.text.title/kinetic/lowerThird` calls; [] when the source does not parse (lint reports it). */
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

/** Effective scale: literal, else mono = 1, else the engine default (≥ 2 for display text). */
function effectiveScale(call: TextCall): number | undefined {
  if (call.scale !== undefined) return call.scale;
  if (call.computedScale) return undefined;
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
    const where = `${file}:${String(call.line)} ctx.text.${call.kind}`;
    const scale = effectiveScale(call);
    const capHeight = call.font === 'mono' ? MONO_FONT.capHeight : DISPLAY_FONT.capHeight;
    if (scale !== undefined && (scale < rules.minScale || scale * capHeight < minPx)) {
      findings.push(
        finding(
          'legibility',
          'error',
          `${where}: text at scale ${String(scale)} is ${String(scale * capHeight)} px high, too small on a phone (needs scale ≥ ${String(rules.minScale)} and ≥ ${String(minPx)} px). Raise its scale (shorten or wrap the text with maxWidth so it still fits the safe area).`,
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
