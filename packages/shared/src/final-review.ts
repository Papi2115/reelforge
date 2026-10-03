/**
 * `.reelforge/final-review.json` (PLAN.md#11.5): the quiet review pass after "Scenes built" —
 * sync check, phone legibility, programmatic QA and one batched Haiku critic, with at most one
 * Opus fix per shot. One entry per storyboard shot: ✓ clean · ⚠ findings left · ✗ cannot render;
 * locked shots are only reported (never changed).
 */
import { z } from 'zod';
import { qaFindingSchema, shotBuildStatusSchema } from './scene-reports.js';

export const FINAL_REVIEW_VERSION = 1;

export const finalReviewShotSchema = z.object({
  shotId: z.string().min(1),
  status: shotBuildStatusSchema,
  /** What is left after the review (empty = ✓). */
  findings: z.array(qaFindingSchema),
  /** A fix turn ran for this shot in this review. */
  autoFixed: z.boolean(),
  /** Locked by the user: checked and reported, never changed. */
  locked: z.boolean(),
  /** A locked shot whose events are off their words by more than the sync tolerance. */
  outOfSync: z.boolean(),
});
export type FinalReviewShot = z.infer<typeof finalReviewShotSchema>;

const countSchema = z.int().nonnegative();

export const finalReviewSchema = z.object({
  version: z.literal(FINAL_REVIEW_VERSION),
  /** `auto`: after a Scenes build (Settings toggle); `manual`: the "Run final review" button. */
  trigger: z.enum(['auto', 'manual']),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  shots: z.array(finalReviewShotSchema),
  counts: z.object({
    ok: countSchema,
    warning: countSchema,
    failed: countSchema,
    locked: countSchema,
    fixed: countSchema,
  }),
  /** Informational lines (critic reply invalid, no words file, …). */
  notes: z.array(z.string()),
});
export type FinalReview = z.infer<typeof finalReviewSchema>;
