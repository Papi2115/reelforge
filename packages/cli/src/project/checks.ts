/**
 * Cross-file checks the per-file schemas cannot see: shots contiguous from 0 (the engine renders
 * them back to back), scene files present inside the project, a known style (a world's style when
 * its world is registered and wired and, if experimental, experimental worlds are on), words/cues
 * that fit the storyboard's time range, a world film's variety (world-checks.ts) and a short's cut
 * rules (short-checks.ts).
 */
import { existsSync } from 'node:fs';
import { STYLE_REGISTRY, type StyleRegistry } from '@reelforge/engine';
import { isUnwiredWorldStyle } from '@reelforge/kit';
import type { ProjectFile, StoryboardFile } from '@reelforge/shared';
import { experimentalWorldsEnabled } from '../commands/kit-docs-world.js';
import { UsageError } from '../errors.js';
import type { Problem, ProjectFiles } from './files.js';
import { PROJECT_PATHS, resolveInProject } from './paths.js';
import { appWrittenScene, shortCutProblems } from './short-checks.js';
import { worldVarietyProblems } from './world-checks.js';

/** Shot boundaries closer than this count as touching. */
const CONTIGUITY_EPSILON = 1e-6;
/** Words spoken after the last shot by more than this are reported. */
const WORDS_OVERHANG_S = 0.25;

const STORYBOARD = PROJECT_PATHS.storyboard;

function storyboardProblem(at: string, message: string, fix: string): Problem {
  return { severity: 'error', file: STORYBOARD, at, message, fix };
}

function timelineProblems(storyboard: StoryboardFile): Problem[] {
  const problems: Problem[] = [];
  const seen = new Set<string>();
  storyboard.shots.forEach((shot, index) => {
    if (seen.has(shot.id)) {
      problems.push(
        storyboardProblem(
          `shots[${String(index)}].id`,
          `duplicate shot id "${shot.id}"`,
          'give every shot its own id',
        ),
      );
    }
    seen.add(shot.id);
    const expected = index === 0 ? 0 : (storyboard.shots[index - 1]?.t1 ?? 0);
    if (Math.abs(shot.t0 - expected) > CONTIGUITY_EPSILON) {
      problems.push(
        storyboardProblem(
          `shots[${String(index)}].t0`,
          `shot "${shot.id}" starts at ${String(shot.t0)} s but must start at ${String(expected)} s (shots are contiguous from 0)`,
          index === 0
            ? 'start the first shot at 0'
            : 'make each shot start exactly where the previous one ends (t0 = previous t1)',
        ),
      );
    }
  });
  return problems;
}

function sceneFileProblems(
  root: string,
  storyboard: StoryboardFile,
  project: ProjectFile | undefined,
): Problem[] {
  return storyboard.shots.flatMap((shot, index): Problem[] => {
    const at = `shots[${String(index)}].scene`;
    let file: string;
    try {
      file = resolveInProject(root, shot.scene, 'scene');
    } catch (error) {
      if (!(error instanceof UsageError)) throw error;
      return [storyboardProblem(at, error.message, 'point it to a file under scenes/')];
    }
    if (!shot.scene.endsWith('.js')) {
      return [storyboardProblem(at, `"${shot.scene}" is not a .js module`, 'use scenes/<id>.js')];
    }
    // A short's end card is written by the app (PLAN.md#13.18): never a scene for Claude.
    if (!existsSync(file) && !appWrittenScene(project, shot)) {
      return [
        {
          severity: 'warning',
          file: STORYBOARD,
          at,
          message: `shot "${shot.id}": scene file ${shot.scene} does not exist yet`,
          fix: `write ${shot.scene} (scene contract: meta, build(ctx), update(t, state, ctx))`,
        },
      ];
    }
    return [];
  });
}

function extentProblems(files: ProjectFiles, storyboard: StoryboardFile): Problem[] {
  const end = storyboard.shots.at(-1)?.t1 ?? 0;
  const problems: Problem[] = [];
  if (files.words.status === 'ok') {
    const lastWord = files.words.data.words.at(-1);
    if (lastWord !== undefined && lastWord.tEnd > end + WORDS_OVERHANG_S) {
      problems.push({
        severity: 'warning',
        file: STORYBOARD,
        at: `shots[${String(storyboard.shots.length - 1)}].t1`,
        message: `the voice-over runs to ${lastWord.tEnd.toFixed(2)} s but the last shot ends at ${end.toFixed(2)} s`,
        fix: 'extend the last shot (or add one) to cover the whole voice-over',
      });
    }
  }
  if (files.cues.status === 'ok') {
    files.cues.data.sfx.forEach((cue, index) => {
      if (cue.t < end) return;
      problems.push({
        severity: 'warning',
        file: PROJECT_PATHS.cues,
        at: `sfx[${String(index)}].t`,
        message: `sfx cue at ${cue.t.toFixed(2)} s is after the end of the video (${end.toFixed(2)} s)`,
        fix: 'move the cue inside the video or delete it',
      });
    });
  }
  return problems;
}

export interface CrossFileOptions {
  /** Experimental worlds on (the app's setting, passed as REELFORGE_EXPERIMENTAL_WORLDS). */
  readonly experimentalWorlds?: boolean;
  /** Default: the engine's built-in and world styles. */
  readonly styles?: StyleRegistry;
}

/**
 * A built-in style or a registered, wired world's style is valid; an experimental world's style
 * only with experimental worlds on; a world that is not wired yet (render-only) never. Otherwise
 * the fix tells Claude not to edit the style itself.
 */
export function styleProblems(
  style: string,
  styles: StyleRegistry,
  experimentalWorlds: boolean,
): Problem[] {
  const problem = (message: string, fix: string): Problem[] => [
    { severity: 'error', file: PROJECT_PATHS.project, at: 'style', message, fix },
  ];
  if (styles.entry(style) === undefined) {
    const known = (experimentalWorlds ? styles.allIds : styles.ids).filter(
      (id) => !isUnwiredWorldStyle(id),
    );
    return problem(`unknown style preset "${style}"`, `use one of: ${known.join(', ')}`);
  }
  if (isUnwiredWorldStyle(style)) {
    return problem(
      `style "${style}" is a world still in development; it cannot be used for a project yet`,
      'do not change the style yourself: ask the user to pick another style for this project',
    );
  }
  if (styles.isExperimental(style) && !experimentalWorlds) {
    return problem(
      `style "${style}" is an experimental world; turn on Experimental worlds in Settings`,
      'do not change the style yourself: ask the user to turn on Experimental worlds in Settings',
    );
  }
  return [];
}

/** Problems across files; per-file schema problems are reported separately (fileProblems). */
export function crossFileProblems(files: ProjectFiles, options: CrossFileOptions = {}): Problem[] {
  const experimentalWorlds = options.experimentalWorlds ?? experimentalWorldsEnabled();
  const project = files.project.status === 'ok' ? files.project.data : undefined;
  const problems =
    project === undefined
      ? []
      : styleProblems(project.style, options.styles ?? STYLE_REGISTRY, experimentalWorlds);
  if (files.storyboard.status !== 'ok') return problems;
  const storyboard = files.storyboard.data;
  return [
    ...problems,
    ...timelineProblems(storyboard),
    ...sceneFileProblems(files.root, storyboard, project),
    ...extentProblems(files, storyboard),
    ...(project === undefined ? [] : worldVarietyProblems(project, storyboard, experimentalWorlds)),
    // A short's cut rules (PLAN.md#13.18); a film: none.
    ...(project === undefined ? [] : shortCutProblems(project, storyboard)),
  ];
}
