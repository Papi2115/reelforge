/**
 * Template variables per stage for an eval case, and the project files each stage produces
 * (removed before the turn, written back by fake-claude, then validated).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { StoryboardShot } from '@reelforge/shared';
import { renderOutputPaths, type PromptId } from '../catalog.js';
import type { TemplateVars } from '../template.js';
import { targetWordsFor } from '../validators/script.js';
import type { EvalCase } from './cases.js';

function findShot(evalCase: EvalCase, shotId: string): Result<StoryboardShot, string> {
  const shot = evalCase.storyboard.shots.find((candidate) => candidate.id === shotId);
  return shot === undefined ? err(`${evalCase.file.id}: no shot ${shotId}`) : ok(shot);
}

function shotWords(
  evalCase: EvalCase,
  shot: StoryboardShot,
): { text: string; t: number; tEnd: number }[] {
  return evalCase.words.words
    .filter((word) => word.t >= shot.t0 && word.t < shot.t1)
    .map((word) => ({ text: word.text, t: word.t, tEnd: word.tEnd }));
}

function neighbours(
  evalCase: EvalCase,
  shot: StoryboardShot,
): { id: string; treatment: string; intent: string }[] {
  const { shots } = evalCase.storyboard;
  const index = shots.indexOf(shot);
  return [shots[index - 1], shots[index + 1]]
    .filter((candidate): candidate is StoryboardShot => candidate !== undefined)
    .map((candidate) => ({
      id: candidate.id,
      treatment: candidate.treatment,
      intent: candidate.intent,
    }));
}

export function stageVars(stage: PromptId, evalCase: EvalCase): Result<TemplateVars, string> {
  const { brief, project, file } = evalCase;
  const styleId = project.style;
  switch (stage) {
    case 'research':
      return ok({ brief });
    case 'script': {
      if (brief.targetMinutes === undefined)
        return err(`${file.id}: brief.json needs targetMinutes`);
      return ok({
        brief,
        language: brief.language,
        targetMinutes: brief.targetMinutes,
        targetWords: targetWordsFor(brief.targetMinutes),
        tone: brief.tone,
        audience: brief.audience,
      });
    }
    case 'storyboard':
    case 'sound-cues':
      return ok({ styleId });
    case 'scene-build': {
      const shot = findShot(evalCase, file.sceneBuild.shotId);
      if (!shot.ok) return shot;
      return ok({
        shotId: shot.value.id,
        shotScene: shot.value.scene,
        shotJson: shot.value,
        shotWords: shotWords(evalCase, shot.value),
        neighbours: neighbours(evalCase, shot.value),
        styleId,
      });
    }
    case 'scene-fix':
      return ok({
        scope: file.sceneFix.scope,
        shotIds: file.sceneFix.shotIds.join(', '),
        selection: file.sceneFix.selection,
        request: file.sceneFix.request,
        critic: file.sceneFix.critic,
      });
    case 'critic': {
      const shot = findShot(evalCase, file.critic.shotId);
      if (!shot.ok) return shot;
      return ok({
        imagePaths: file.critic.imagePaths.join(', '),
        intent: shot.value.intent,
        styleId,
      });
    }
    case 'review-triage':
      return ok({
        imagePaths: file.critic.imagePaths.join(', '),
        shots: evalCase.storyboard.shots.map((shot) => ({ id: shot.id, intent: shot.intent })),
        styleId,
      });
    case 'review-plan': {
      const shot = findShot(evalCase, file.critic.shotId);
      if (!shot.ok) return shot;
      return ok({
        request: 'Review the whole video and fix what looks wrong.',
        suspects: [{ shot: shot.value.id, reason: 'the last frame looks almost blank' }],
      });
    }
  }
}

export interface StageFiles {
  /** Project-relative files the stage writes (validated after the turn). */
  readonly paths: readonly string[];
  /** Delete them from the seeded project first (false: the stage edits existing files). */
  readonly removeBeforeTurn: boolean;
}

export function stageFiles(
  stage: PromptId,
  evalCase: EvalCase,
  vars: TemplateVars,
): Result<StageFiles, string> {
  if (stage === 'scene-fix') {
    const paths: string[] = [];
    for (const shotId of evalCase.file.sceneFix.shotIds) {
      const shot = findShot(evalCase, shotId);
      if (!shot.ok) return shot;
      paths.push(shot.value.scene);
    }
    return ok({ paths, removeBeforeTurn: false });
  }
  const rendered = renderOutputPaths(stage, vars);
  if (!rendered.ok) return err(`${stage}: output path needs ${JSON.stringify(rendered.error)}`);
  return ok({ paths: rendered.value, removeBeforeTurn: true });
}
