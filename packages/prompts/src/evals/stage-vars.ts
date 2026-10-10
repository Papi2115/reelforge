/**
 * Template variables per stage for an eval case, and the project files each stage produces
 * (removed before the turn, written back by fake-claude, then validated).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  projectCharacters,
  projectMascot,
  researchClaimSources,
  researchSourceExcerpts,
  scriptSentences,
  type StoryboardShot,
} from '@reelforge/shared';
import { renderOutputPaths, type PromptId } from '../catalog.js';
import { criticCharacterVars, sceneCharacterVars, storyboardCharacterVars } from '../characters.js';
import type { TemplateVars } from '../template.js';
import { claimsPromptVars } from '../validators/claims.js';
import { hooksPromptVars } from '../validators/hooks.js';
import { shortScriptPromptVars } from '../short-vars.js';
import { targetWordsFor } from '../validators/script.js';
import type { EvalCase } from './cases.js';
import { seoEvalVars } from './seo-eval.js';
import { cCamDirectionPromptVars } from '../worlds/c-cam-direction.js';

/** Gag kinds the direction eval offers (the kit's list is not a dependency of this package). */
export const EVAL_GAG_KINDS: readonly string[] = ['gum', 'sweat', 'yawn', 'fidget', 'penClick'];

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
  // The case's characters and mascot (PLAN.md#12.20); no roles are built in an eval case.
  const characters = {
    characters: projectCharacters(project),
    mascot: projectMascot(project),
  } as const;
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
      return ok({ styleId, ...storyboardCharacterVars(characters) });
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
        ...sceneCharacterVars(characters, shot.value),
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
        ...criticCharacterVars(characters, shot.value),
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
    case 'prop-build': {
      const shots: string[] = [];
      for (const shotId of file.propBuild.shotIds) {
        const shot = findShot(evalCase, shotId);
        if (!shot.ok) return shot;
        shots.push(`${shot.value.id}: ${shot.value.intent}`);
      }
      return ok({
        propName: file.propBuild.name,
        description: file.propBuild.description,
        shots: shots.join('; '),
        styleId,
      });
    }
    case 'roles': {
      const shots: string[] = [];
      for (const shotId of file.roleBuild.shotIds) {
        const shot = findShot(evalCase, shotId);
        if (!shot.ok) return shot;
        shots.push(`${shot.value.id}: ${shot.value.intent}`);
      }
      return ok({
        roleId: file.roleBuild.id,
        label: file.roleBuild.label,
        description: file.roleBuild.description,
        shots: shots.join('; '),
        styleId,
      });
    }
    case 'assets':
      return ok({
        mode: 'ask',
        ask: true,
        needs: evalCase.storyboard.shots
          .slice(0, 1)
          .map((shot) => `- ${shot.id} · ${shot.id}-photo (image): ${shot.intent}`)
          .join('\n'),
        maxItems: 8,
      });
    case 'tension':
      return ok({
        durationS: (evalCase.words.words.at(-1)?.tEnd ?? 0).toFixed(1),
        minPoints: 4,
        maxPoints: 8,
      });
    case 'claims': {
      const read = (name: string): string =>
        readFileSync(path.join(evalCase.projectDir, name), 'utf8');
      return ok(
        claimsPromptVars(
          scriptSentences(read('script.txt')),
          researchClaimSources(read('research.md')),
          researchSourceExcerpts(read('research.md')),
        ),
      );
    }
    case 'hooks': {
      const read = (name: string): string =>
        readFileSync(path.join(evalCase.projectDir, name), 'utf8');
      const vars = hooksPromptVars({
        script: read('script.txt'),
        research: read('research.md'),
        language: brief.language,
      });
      return vars === undefined ? err(`${file.id}: script.txt is empty`) : ok(vars);
    }
    case 'world-assets':
      // World films only (PLAN.md#13.15); an eval case is a built-in style: the Sketchbook wording.
      return ok({
        world: 'sketchbook',
        worldLabel: 'Sketchbook',
        grammar:
          'A hand-drawn spiral notebook: crude stick people, hand lettering, felt-tip and pencil.',
        vocabulary: 'figures: page.person looks, props: doodle, spot or draw kind.',
        naming: 'one file per thing, <id>.json',
        budget: '24 things',
      });
    case 'c-cam-build': {
      // Grim Ink films only (PLAN.md#14.11); an eval case is a built-in style: the place of its
      // first shot (golden module: kit-ext/places/workRoom.js).
      const shot = evalCase.storyboard.shots[0];
      if (shot === undefined) return err(`${file.id}: the storyboard has no shot`);
      return ok({
        folder: 'places',
        id: 'workRoom',
        noun: 'place',
        binding: 'place',
        place: true,
        brief: `the setting of ${shot.id}`,
        shots: `${shot.id}: ${shot.intent}`,
        narration: `${shot.id}: "${shotWords(evalCase, shot)
          .map((word) => word.text)
          .join(' ')}"`,
        style: 'One uneven ink line over muddy flat colour, grime as flat shapes, one warm light.',
        contract:
          'export const place = { id, name, bounds: [w, h], light?, anchors?, collide?, draw(g, ink, t) }',
      });
    }
    case 'c-cam-direction':
      // Grim Ink films only (PLAN.md#14.16); an eval case is a built-in style: its own narration.
      return ok(
        cCamDirectionPromptVars({
          script: readFileSync(path.join(evalCase.projectDir, 'script.txt'), 'utf8'),
          words: evalCase.words,
          style:
            'One uneven ink line over muddy flat colour, grime as flat shapes, one warm light.',
          gagKinds: EVAL_GAG_KINDS,
        }),
      );
    case 'world-asset-critic':
      return ok({
        worldLabel: 'Sketchbook',
        imagePaths: '.reelforge/frames/world-assets/crops-A.png',
        tiles: 'crops-A.png: A1, A2',
      });
    case 'brief':
      return ok({
        topic: brief.topic,
        language: brief.language,
        targetMinutes: brief.targetMinutes ?? 5,
      });
    case 'short-script': {
      // A 30 s teaser of the case's film (PLAN.md#13.18); the golden output is in <case>/short/.
      const read = (name: string): string =>
        readFileSync(path.join(evalCase.projectDir, name), 'utf8');
      return ok(
        shortScriptPromptVars({
          parentTitle: project.title,
          parentScript: read('script.txt'),
          parentBeats: read('beats.md'),
          research: read('research.md'),
          channelName: 'Eval Channel',
          lengthS: 30,
          language: brief.language,
        }),
      );
    }
    case 'publish-seo':
      return ok(seoEvalVars(evalCase));
    case 'youtube-meta':
      return ok({
        title: project.title,
        language: project.language,
        script: readFileSync(path.join(evalCase.projectDir, 'script.txt'), 'utf8'),
        chapters: file.youtubeMeta?.chapters,
      });
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
