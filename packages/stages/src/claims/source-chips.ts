/**
 * The storyboard prompt's source-chip hint (PLAN.md#12.18): only when `claims.json` exists and
 * pins a nameable source to a claim, the storyboard learns which claims may get a corner chip.
 * Without it the prompt renders byte-identically to before.
 */
import { claimChipName, claimsFileSchema, CLAIMS_FILE, type ClaimsFile } from '@reelforge/shared';
import { requireProjectJson } from '../files.js';

/** Claims listed in the prompt at most (the strongest are spoken first). */
export const MAX_CHIP_HINTS = 30;

/** `- "claim" → source name` lines of the sourced claims, or [] when none has a nameable source. */
export function sourceChipLines(file: ClaimsFile): string[] {
  return file.claims
    .filter((claim) => claim.status === 'sourced' || claim.status === 'user-confirmed')
    .flatMap((claim) => {
      const name = claimChipName(file, claim);
      return name === null ? [] : [`- "${claim.text}" → ${name}`];
    })
    .slice(0, MAX_CHIP_HINTS);
}

/** `{ sourceChips }` for the storyboard prompt, or {} (no claims.json, unreadable, no sources). */
export async function storyboardSourceChipVars(
  projectDir: string,
): Promise<{ sourceChips?: string }> {
  const file = await requireProjectJson(projectDir, CLAIMS_FILE, claimsFileSchema);
  if (!file.ok) return {};
  const lines = sourceChipLines(file.value);
  return lines.length === 0 ? {} : { sourceChips: lines.join('\n') };
}
