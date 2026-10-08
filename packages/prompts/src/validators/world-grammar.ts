/**
 * The film grammar of a world (Game B1 rework; docs/beta-feedback.md, Papi on B1 film 2: "it no
 * longer reads as a 2D game, constant zoom in and out onto the TV"), checked on the storyboard of
 * a world with `WorldPromptText.grammar`: every shot names its framing (`worldView`); the camera
 * crosses between the room and the screen at most a few times per minute (inside a shot or at a
 * cut); most shots play a game moment and enough of them are gameplay; never three shots of one
 * kind in a row; the film links its shots with enough game-native transitions instead of plain
 * cuts; the breakthrough pair every early film repeated never shares a film. Every finding is an
 * error with the fix in its message, so the storyboard's repair turn fixes it.
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { WorldFilmGrammar, WorldMomentOption, WorldViewOption } from '../worlds/types.js';
import { issue, type ValidationIssue } from './issues.js';

const PLAIN = 'plain';
const where = (index: number, field: string): string => `shots[${String(index)}].${field}`;

/** Room <-> screen switches a film of `durationS` may have. */
export function maxViewSwitches(grammar: WorldFilmGrammar, durationS: number): number {
  return Math.max(grammar.maxSwitchesMin, Math.floor((durationS * grammar.switchesPerMinute) / 60));
}

/** Gameplay shots a film of `shots` shots needs. */
export function minGameplayShots(grammar: WorldFilmGrammar, shots: number): number {
  return Math.max(grammar.minGameplay, Math.ceil(shots / grammar.gameplayEveryShots));
}

/** Game-native transitions a film of `durationS` needs. */
export function minNativeTransitions(grammar: WorldFilmGrammar, durationS: number): number {
  return Math.max(
    grammar.minNativeTransitions,
    Math.round(durationS / grammar.nativeTransitionEveryS),
  );
}

function viewIssues(
  shots: readonly StoryboardShot[],
  views: ReadonlyMap<string, WorldViewOption>,
  grammar: WorldFilmGrammar,
  durationS: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = [...views.keys()].join(', ');
  let switches = 0;
  let previous: WorldViewOption | undefined;
  const crossings: string[] = [];
  shots.forEach((shot, index) => {
    const view = shot.worldView === undefined ? undefined : views.get(shot.worldView);
    if (view === undefined) {
      issues.push(
        issue(
          'error',
          'view-missing',
          `${shot.id}: give "worldView" one of ${ids} (where the shot is framed: the game picture filling the frame, the room around the TV, or one camera move between them)`,
          where(index, 'worldView'),
        ),
      );
      previous = undefined;
      return;
    }
    const atCut = previous !== undefined && previous.end !== view.start ? 1 : 0;
    if (atCut + view.moves > 0) crossings.push(shot.id);
    switches += atCut + view.moves;
    previous = view;
  });
  const max = maxViewSwitches(grammar, durationS);
  if (switches > max)
    issues.push(
      issue(
        'error',
        'view-switches',
        `${String(switches)} room <-> screen switches in ${durationS.toFixed(0)} s (at ${crossings.join(', ')}); at most ${String(max)}: keep the film inside the game (open in the room and push in once, pull back out at the end); between game shots use a game-native transition, not a camera trip to the room; a cut from a room shot straight to a screen shot counts too`,
        'shots',
      ),
    );
  return issues;
}

function shareIssues(
  shots: readonly StoryboardShot[],
  catalog: ReadonlyMap<string, WorldMomentOption>,
  grammar: WorldFilmGrammar,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const game = shots.filter((shot) => catalog.get(shot.worldMoment ?? PLAIN)?.game === true);
  const games = [...catalog.values()].filter((option) => option.game === true).map((o) => o.id);
  const needed = Math.ceil(shots.length * grammar.minGameShare);
  if (game.length < needed)
    issues.push(
      issue(
        'error',
        'game-share',
        `${String(game.length)} of ${String(shots.length)} shots play the game; at least ${String(needed)} (${String(Math.round(grammar.minGameShare * 100))} %) must: give plain or room shots a game moment (${games.join(', ')}); the narration itself becomes the level, the menu or the boss`,
        'shots',
      ),
    );
  const gameplay = shots.filter((shot) => shot.worldMoment === grammar.gameplayMoment).length;
  const minimum = minGameplayShots(grammar, shots.length);
  if (gameplay < minimum)
    issues.push(
      issue(
        'error',
        'gameplay-quota',
        `${String(gameplay)} gameplay shot(s) ("worldMoment": "${grammar.gameplayMoment}"); this film needs at least ${String(minimum)}: the hero moving through a level of the narration toward a goal past obstacles, enemies and items (the topic as the level), not sprites standing on a still picture`,
        'shots',
      ),
    );
  return issues;
}

function runIssues(shots: readonly StoryboardShot[], grammar: WorldFilmGrammar): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let run = 0;
  shots.forEach((shot, index) => {
    const kind = shot.worldMoment ?? PLAIN;
    run = index > 0 && (shots[index - 1]?.worldMoment ?? PLAIN) === kind ? run + 1 : 1;
    if (run === grammar.maxKindRun + 1)
      issues.push(
        issue(
          'error',
          'kind-run',
          `${String(run)} shots in a row are ${kind} (up to ${shot.id}); never more than ${String(grammar.maxKindRun)} of one kind in a row: alternate gameplay with a menu screen, the boss or a level select`,
          where(index, 'worldMoment'),
        ),
      );
  });
  return issues;
}

function transitionIssues(
  shots: readonly StoryboardShot[],
  grammar: WorldFilmGrammar,
  durationS: number,
): ValidationIssue[] {
  const native = shots.filter(
    (shot, index) =>
      index > 0 &&
      (shot.continuity !== undefined ||
        (shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut')),
  ).length;
  const needed = Math.min(shots.length - 1, minNativeTransitions(grammar, durationS));
  if (native >= needed) return [];
  return [
    issue(
      'error',
      'native-transitions',
      `${String(native)} game-native transition(s) in ${durationS.toFixed(0)} s; this film needs at least ${String(needed)} (the rest may be cuts): link shots the way the game moves (the next screen of the level, a level select, attract mode, a scanline redraw, a game swap, a continuity link); name the style in transitionIn`,
      'shots',
    ),
  ];
}

function pairIssues(
  shots: readonly StoryboardShot[],
  grammar: WorldFilmGrammar,
): ValidationIssue[] {
  const pair = grammar.exclusiveBreakthroughs;
  const used = pair.filter((id) => shots.some((shot) => shot.worldMoment === id));
  if (pair.length < 2 || used.length < pair.length) return [];
  return [
    issue(
      'error',
      'breakthrough-pair',
      `${used.join(' and ')} in one film: every early film used exactly this pair; keep at most one of them and give the other beat another breakthrough of this world`,
      'shots',
    ),
  ];
}

/** The grammar checks of a world's storyboard (see the module comment). */
export function checkWorldGrammar(
  shots: readonly StoryboardShot[],
  grammar: WorldFilmGrammar,
  catalog: ReadonlyMap<string, WorldMomentOption>,
): ValidationIssue[] {
  const durationS = shots.at(-1)?.t1 ?? 0;
  const views = new Map(grammar.views.map((view) => [view.id, view]));
  return [
    ...viewIssues(shots, views, grammar, durationS),
    ...shareIssues(shots, catalog, grammar),
    ...runIssues(shots, grammar),
    ...transitionIssues(shots, grammar, durationS),
    ...pairIssues(shots, grammar),
  ];
}
