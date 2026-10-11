/**
 * Variables of the c-cam-build prompt (PLAN.md#14.11): which module, what it must be (the tag's
 * description), where it appears, what the narration says there, the world's craft brief (the
 * style rules, ≤ 1.5 KB), the module contract (`reelforge kit-docs people|places`) and, on the
 * fix turn, the QA findings. The prompt itself carries the kit's example module of the kind.
 */
import { describeInkModulesTopic } from '@reelforge/cli/service';
import { worldPromptText } from '@reelforge/prompts';
import { C_CAM_ID } from '@reelforge/kit';
import type { WordsFile } from '@reelforge/shared';
import { designBrief, narrationExcerpt, type InkModuleDesign } from './design.js';

/** The style rules digest the prompt gets at most. */
export const STYLE_DIGEST_BUDGET = 1500;

const FALLBACK_STYLE =
  'Hand-inked caricature people in specific, grimy places: one uneven ink line over muddy flat full colour, grime as flat shapes, one warm light per place, no gradients, textures or fonts.';

/** The world's craft brief (its style rules), within the budget. */
export function styleDigest(): string {
  const text = worldPromptText(C_CAM_ID)?.craftBrief ?? FALLBACK_STYLE;
  return text.length <= STYLE_DIGEST_BUDGET ? text : `${text.slice(0, STYLE_DIGEST_BUDGET - 1)}…`;
}

export function cCamBuildVars(
  design: InkModuleDesign,
  words: WordsFile | undefined,
  fix: { readonly findings: readonly string[]; readonly attempt: number },
): Record<string, string | number | boolean> {
  const person = design.kind === 'people';
  return {
    folder: design.kind,
    id: design.id,
    noun: person ? 'person' : 'place',
    binding: person ? 'person' : 'place',
    ...(person ? { person: true } : { place: true }),
    brief: designBrief(design),
    shots: design.shots.map((shot) => `${shot.id}: ${shot.intent}`).join('\n'),
    narration: narrationExcerpt(design, words),
    style: styleDigest(),
    contract: describeInkModulesTopic(design.kind) ?? `reelforge kit-docs ${design.kind}`,
    ...(fix.findings.length === 0
      ? {}
      : { findings: fix.findings.map((line) => `- ${line}`).join('\n'), attempt: fix.attempt }),
  };
}
