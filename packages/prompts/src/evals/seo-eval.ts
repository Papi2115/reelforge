/**
 * The `publish-seo` eval (PLAN.md#13.17): the case's film as the prompt sees it (texts, the
 * storyboard's cuts with their narration as chapter candidates) and the reply checked against the
 * same candidates and length. Mirrors the stage's candidate list (`seoChapterCandidates` of the
 * pipeline) without depending on the pipeline.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { findGenrePreset, SEO_MIN_CHAPTER_SECONDS } from '@reelforge/shared';
import type { TemplateVars } from '../template.js';
import type { ValidationIssue } from '../validators/issues.js';
import {
  publishSeoPromptVars,
  validatePublishSeoReply,
  type SeoPromptCandidate,
} from '../validators/publish-seo.js';
import type { EvalCase } from './cases.js';

/** Words spoken this long before a cut belong to the shot after it. */
const LEAD_S = 0.3;

function durationOf(evalCase: EvalCase): number {
  return evalCase.storyboard.shots.at(-1)?.t1 ?? 0;
}

/** Shot starts 10 s clear of both ends (the first is 0), with the narration spoken there. */
export function seoEvalCandidates(evalCase: EvalCase): SeoPromptCandidate[] {
  const { shots } = evalCase.storyboard;
  const end = Math.floor(durationOf(evalCase));
  return shots
    .map((shot, index) => ({ index, t: index === 0 ? 0 : shot.t0 }))
    .filter(
      ({ index, t }) =>
        index === 0 ||
        (Math.floor(t) >= SEO_MIN_CHAPTER_SECONDS &&
          end - Math.floor(t) >= SEO_MIN_CHAPTER_SECONDS),
    )
    .map(({ index, t }) => {
      const until = shots[index + 1]?.t0 ?? Infinity;
      const narration = evalCase.words.words
        .filter((word) => word.t >= t - LEAD_S && word.t < until - LEAD_S)
        .map((word) => word.text)
        .join(' ');
      return { t, narration };
    });
}

export function seoEvalVars(evalCase: EvalCase): TemplateVars {
  const read = (name: string): string => readFileSync(path.join(evalCase.projectDir, name), 'utf8');
  const genre = findGenrePreset(evalCase.project.genrePreset);
  return publishSeoPromptVars({
    title: evalCase.project.title,
    script: read('script.txt'),
    beats: read('beats.md'),
    research: read('research.md'),
    durationS: durationOf(evalCase),
    channel: {
      name: 'Eval channel',
      genreName: genre?.name,
      genreDescription: genre?.description,
      style: evalCase.project.style,
    },
    candidates: seoEvalCandidates(evalCase),
  });
}

export function seoEvalIssues(evalCase: EvalCase, reply: string): readonly ValidationIssue[] {
  return validatePublishSeoReply(reply, {
    durationS: durationOf(evalCase),
    candidates: seoEvalCandidates(evalCase).map((candidate) => candidate.t),
  }).issues;
}
