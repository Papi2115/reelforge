/**
 * World-assets critic reply (PLAN.md#13.15, per-asset legibility):
 * `{"assets":[{"tile","sees","legible","style","note"}]}`, one entry per tile code (A1 …).
 */
import { z } from 'zod';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

export const worldAssetCriticReplySchema = z.strictObject({
  assets: z
    .array(
      z.strictObject({
        tile: z.string().regex(/^[A-Z]{1,2}[1-9]$/),
        sees: z.string().min(1).max(200),
        legible: z.boolean(),
        style: z.enum(['ok', 'off-style']),
        note: z.string().max(400),
      }),
    )
    .min(1),
});
export type WorldAssetCriticReply = z.infer<typeof worldAssetCriticReplySchema>;

/** Tiles without an entry (error) and entries for unknown tiles (warning). */
function tileIssues(reply: WorldAssetCriticReply, expected: readonly string[]): ValidationIssue[] {
  const judged = new Set(reply.assets.map((entry) => entry.tile));
  const wanted = new Set(expected);
  const issues = expected
    .filter((tile) => !judged.has(tile))
    .map((tile) => issue('error', 'missing-tile', `no entry for tile ${tile}`));
  reply.assets.forEach((entry, index) => {
    if (!wanted.has(entry.tile)) {
      issues.push(
        issue(
          'warning',
          'unexpected-tile',
          `entry for an unknown tile ${entry.tile}`,
          `assets[${String(index)}].tile`,
        ),
      );
    }
  });
  return issues;
}

export function validateWorldAssetCriticReply(
  text: string,
  options: { readonly expectedTiles?: readonly string[] } = {},
): ValidationReport<WorldAssetCriticReply> {
  const json = parseJsonText(text);
  if (!json.parsed) return report<WorldAssetCriticReply>(undefined, json.issues);
  const parsed = worldAssetCriticReplySchema.safeParse(json.value);
  if (!parsed.success) {
    return report<WorldAssetCriticReply>(undefined, [
      ...json.issues,
      ...schemaIssues(parsed.error),
    ]);
  }
  const issues = [...json.issues];
  if (options.expectedTiles !== undefined)
    issues.push(...tileIssues(parsed.data, options.expectedTiles));
  return report(parsed.data, issues);
}
