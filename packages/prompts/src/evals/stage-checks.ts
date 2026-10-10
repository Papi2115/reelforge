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
  WORLD_CAST_FILE,
  worldCastFileSchema,
} from '@reelforge/shared';
import { validateInkModuleSource } from '../validators/c-cam-build.js';
import { validateClaimsReply } from '../validators/claims.js';
import { validateCriticReply } from '../validators/critic.js';
import { validateWorldAssetCriticReply } from '../validators/world-asset-critic.js';
import { validateHooksReply } from '../validators/hooks.js';
import { validateCues, type CuesLike, type CuesSchema } from '../validators/cues.js';
import { issue, type ValidationIssue } from '../validators/issues.js';
import { validatePlanReply, validateTriageReply } from '../validators/review.js';
import { targetWordsFor, validateScript } from '../validators/script.js';
import { validateShortHooks, validateShortScript } from '../validators/short.js';
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
import { seoEvalIssues } from './seo-eval.js';

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
  'world-assets': 4,
  'c-cam-build': 4,
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
  // A short's teaser (PLAN.md#13.18): the eval asks for a 30 s short.
  if (input.stage === 'short-script' && file === 'script.txt') {
    return validateShortScript(text, { lengthS: 30 }).issues;
  }
  if (input.stage === 'short-script' && file === 'hooks.md') {
    const script = path.join(projectDir, 'script.txt');
    return validateShortHooks(
      text,
      existsSync(script) ? { script: readFileSync(script, 'utf8') } : {},
    ).issues;
  }
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
  if (file === WORLD_CAST_FILE) return worldCastIssues(text);
  // A Grim Ink person or place (PLAN.md#14.11): kit-ext/people|places/<id>.js.
  const inkModule = /^kit-ext\/(people|places)\/([A-Za-z0-9]+)\.js$/.exec(file);
  if (inkModule?.[2] !== undefined) {
    const folder = inkModule[1] === 'people' ? 'people' : 'places';
    return validateInkModuleSource(text, folder, inkModule[2]).issues;
  }
  if (file.endsWith('.js')) return validateSceneModule(text).issues;
  return [];
}

/** assets/cast.json of the world-assets turn (PLAN.md#13.15): valid JSON in the cast format. */
function worldCastIssues(text: string): readonly ValidationIssue[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return [issue('error', 'cast-json', `not valid JSON: ${why}`, WORLD_CAST_FILE)];
  }
  const parsed = worldCastFileSchema.safeParse(value);
  return parsed.success
    ? []
    : parsed.error.issues.map((entry) =>
        issue(
          'error',
          'cast-schema',
          `${entry.path.join('.') || '(file)'}: ${entry.message}`,
          WORLD_CAST_FILE,
        ),
      );
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
  if (stage === 'world-asset-critic') {
    issues.push(...validateWorldAssetCriticReply(reply, { expectedTiles: ['A1', 'A2'] }).issues);
  }
  const shotIds = evalCase.storyboard.shots.map((shot) => shot.id);
  if (stage === 'review-triage') issues.push(...validateTriageReply(reply, { shotIds }).issues);
  if (stage === 'review-plan') issues.push(...validatePlanReply(reply, { shotIds }).issues);
  if (stage === 'claims') issues.push(...claimsIssues(evalCase, reply));
  if (stage === 'hooks') issues.push(...hooksIssues(evalCase, reply));
  if (stage === 'publish-seo') issues.push(...seoEvalIssues(evalCase, reply));
  if (stage === 'youtube-meta') {
    const chapters = evalCase.file.youtubeMeta?.chapters ?? null;
    issues.push(...validateYoutubeMetaReply(reply, { chapters }).issues);
  }
  if (stage === 'scene-build' && input.strictReplies) {
    issues.push(...missingLineIssues(reply, evalCase.file.sceneBuild.expectMissing));
  }
  return issues;
}
