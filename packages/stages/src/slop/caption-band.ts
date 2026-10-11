/**
 * The caption band (PLAN.md#14.18, real run Grim Ink 1: the captions sat over the poster's own
 * lettering, "TIBERIUS" hidden by "RETIRED"). With captions on, a world that reserves a band for
 * them (Grim Ink: the bottom 18 % of the frame) wants its scene lettering above it: a text call of
 * the world (`env.ink.drawText`, `env.ink.text`) whose literal `y` lies in the band is flagged.
 * Static and literal-only: a computed `y` is left to the critic.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { calleeName, propertyKey } from './source-text.js';

export interface CaptionBand {
  /** Share of the frame height reserved from the bottom. */
  readonly share: number;
  /** Frame height in px the scene's coordinates use. */
  readonly height: number;
}

function literalY(options: AnyNode | undefined): number | undefined {
  if (options?.type !== 'ObjectExpression') return undefined;
  for (const property of options.properties) {
    if (property.type !== 'Property' || propertyKey(property) !== 'y') continue;
    const value = property.value;
    if (value.type === 'Literal' && typeof value.value === 'number') return value.value;
  }
  return undefined;
}

/** ⚠ for every text call drawn inside the caption band. */
export function captionBandFindings(
  program: AnyNode,
  file: string,
  band: CaptionBand,
  textMethods: readonly string[],
): QaFinding[] {
  const top = Math.round(band.height * (1 - band.share));
  const findings: QaFinding[] = [];
  visit(program, (node) => {
    if (node.type !== 'CallExpression') return;
    const name = calleeName(node);
    if (name === undefined || !textMethods.includes(name)) return;
    const y = literalY(node.arguments[1]);
    if (y === undefined || y < top) return;
    const line = node.loc?.start.line ?? 0;
    findings.push(
      finding(
        'slop',
        'warning',
        `caption band: ${name}(…) at y ${String(y)} sits in the bottom ${String(Math.round(band.share * 100))} % the captions use (${file}:${String(line)}); letter above y ${String(top)}.`,
      ),
    );
  });
  return findings;
}
