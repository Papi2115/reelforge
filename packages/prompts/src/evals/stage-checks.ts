/** Validates what a stage turn produced (files in the project and/or the final reply). */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PromptId } from '../catalog.js';
import {
  projectCharacters,
  projectMascot,
  researchClaimSources,
  scriptOpening,
  scriptSentences,
} from '@reelforge/shared';
import { validateClaimsReply } from '../validators/claims.js';
import { validateCriticReply } from '../validators/critic.js';
import { validateHooksReply } from '../validators/hooks.js';
import { validateCues, type CuesLike, type CuesSchema } from '../validators/cues.js';
import { issue, type ValidationIssue } from '../validators/issues.js';
import { validatePlanReply, validateTriageReply } from '../validators/review.js';
import { targetWordsFor, validateScript } from '../validators/script.js';
import { validateStoryboard } from '../validators/storyboard.js';
import { validateTension } from '../validators/tension.js';
import { validateRoleFile } from '../validators/roles.js';
import { validateYoutubeMetaReply } from '../validators/youtube-meta.js';
import {
  parseMissing,
  replyLengthIssues,
  validatePropModule,
  validateResearch,
  validateSceneModule,
} from '../validators/text-outputs.js';
import type { EvalCase } from './cases.js';

export interface StageCheckInput<T extends CuesLike> {
  readonly stage: PromptId;
  readonly evalCase: EvalCase;
  readonly projectDir: string;
  /** Project-relative files the stage writes. */
  readonly files: readonly string[];
  readonly reply: string;
  /** `CuesFileSchema` of `@reelforge/pipeline` (injected). */
  readonly cuesSchema: CuesSchema<T>;
  /** Fake runs replay canned replies, so the `MISSING:` line must match the case exactly. */
  readonly strictReplies: boolean;
}

/** Reply line limits stated in the prompts. */
const MAX_REPLY_LINES: Partial<Record<PromptId, number>> = {
  research: 3,
  assets: 5,
  'scene-build': 5,
  'scene-fix': 4,
  'prop-build': 4,
  roles: 4,
  tension: 3,
};

function readOutputs(
  projectDir: string,
  files: readonly string[],
): {
  texts: Map<string, string>;
  issues: ValidationIssue[];
} {
  const texts = new Map<string, string>();
  const issues: ValidationIssue[] = [];
  for (const file of files) {
    const absolute = path.join(projectDir, file);
    if (!existsSync(absolute)) {
      issues.push(issue('error', 'missing-output', `${file} was not written`, file));
      continue;
    }
    const text = readFileSync(absolute, 'utf8');
    if (text.trim() === '') issues.push(issue('error', 'empty-output', `${file} is empty`, file));
    texts.set(file, text);
  }
  return { texts, issues };
}

function located(file: string, issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.map((entry) => ({
    ...entry,
    path: entry.path === undefined ? file : `${file}: ${entry.path}`,
  }));
}

function missingLineIssues(reply: string, expected: readonly string[]): ValidationIssue[] {
  const named = parseMissing(reply);
  const same = named.length === expected.length && named.every((name) => expected.includes(name));
  return same
    ? []
    : [
        issue(
          'error',
          'missing-line',
          `MISSING: ${JSON.stringify(named)}, expected ${JSON.stringify(expected)}`,
        ),
      ];
}

function fileIssues<T extends CuesLike>(
  input: StageCheckInput<T>,
  file: string,
  text: string,
): readonly ValidationIssue[] {
  const { evalCase, projectDir } = input;
  if (file === 'research.md') return validateResearch(text).issues;
  if (file === 'script.txt') {
    const minutes = evalCase.brief.targetMinutes ?? 1;
    return validateScript(text, { targetWords: targetWordsFor(minutes) }).issues;
  }
  if (file === 'storyboard.json') {
    const characters = {
      characters: projectCharacters(evalCase.project),
      mascot: projectMascot(evalCase.project),
    };
    return validateStoryboard(text, { words: evalCase.words, characters }).issues;
  }
  if (file === 'tension.json') {
    return validateTension(text, { durationS: evalCase.words.words.at(-1)?.tEnd ?? 0 }).issues;
  }
  if (file === 'cues.json') {
    return validateCues(text, {
      schema: input.cuesSchema,
      durationS: evalCase.words.words.at(-1)?.tEnd,
      musicFileExists: (music) => existsSync(path.join(projectDir, music)),
    }).issues;
  }
  if (file.startsWith('kit-ext/props/') && file.endsWith('.js')) {
    return validatePropModule(text, evalCase.file.propBuild.name).issues;
  }
  if (file.startsWith('characters/roles/') && file.endsWith('.json')) {
    return validateRoleFile(text, { roleId: evalCase.file.roleBuild.id }).issues;
  }
  if (file.endsWith('.js')) return validateSceneModule(text).issues;
  return [];
}

/** The hooks reply against the case's script opening and research.md (PLAN.md#12.16). */
function hooksIssues(evalCase: EvalCase, reply: string): readonly ValidationIssue[] {
  const read = (name: string): string => readFileSync(path.join(evalCase.projectDir, name), 'utf8');
  const currentOpening = scriptOpening(read('script.txt'))?.text ?? '';
  return validateHooksReply(reply, { currentOpening, research: read('research.md') }).issues;
}

/** The claims reply against the case's script and research.md (PLAN.md#12.18). */
function claimsIssues(evalCase: EvalCase, reply: string): readonly ValidationIssue[] {
  const read = (name: string): string => readFileSync(path.join(evalCase.projectDir, name), 'utf8');
  const sourceIds = new Set(researchClaimSources(read('research.md')).map((source) => source.id));
  return validateClaimsReply(reply, { sentences: scriptSentences(read('script.txt')), sourceIds })
    .issues;
}

export function checkStageOutput<T extends CuesLike>(input: StageCheckInput<T>): ValidationIssue[] {
  const { stage, reply, evalCase } = input;
  const outputs = readOutputs(input.projectDir, input.files);
  const issues = [...outputs.issues];
  for (const [file, text] of outputs.texts)
    issues.push(...located(file, fileIssues(input, file, text)));
  const maxLines = MAX_REPLY_LINES[stage];
  if (maxLines !== undefined) issues.push(...replyLengthIssues(reply, maxLines));
  if (stage === 'critic') {
    issues.push(
      ...validateCriticReply(reply, { expectedPaths: evalCase.file.critic.imagePaths }).issues,
    );
  }
  const shotIds = evalCase.storyboard.shots.map((shot) => shot.id);
  if (stage === 'review-triage') issues.push(...validateTriageReply(reply, { shotIds }).issues);
  if (stage === 'review-plan') issues.push(...validatePlanReply(reply, { shotIds }).issues);
  if (stage === 'claims') issues.push(...claimsIssues(evalCase, reply));
  if (stage === 'hooks') issues.push(...hooksIssues(evalCase, reply));
  if (stage === 'youtube-meta') {
    const chapters = evalCase.file.youtubeMeta?.chapters ?? null;
    issues.push(...validateYoutubeMetaReply(reply, { chapters }).issues);
  }
  if (stage === 'scene-build' && input.strictReplies) {
    issues.push(...missingLineIssues(reply, evalCase.file.sceneBuild.expectMissing));
  }
  return issues;
}
