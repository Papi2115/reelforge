/**
 * Prompt variables of a world's moment catalog (real run Sketchbook 1): the storyboard gets the
 * closed list with "use when the narration …" lines and the film's quota (variety.ts); the scene
 * build and fix turns get the exact call of the shot's planned moment; the critic gets what must
 * be visible. A shot without a moment (plain) or outside a world gets none of them.
 */
import type { WorldMomentOption, WorldPromptText } from './types.js';
import {
  breakthroughQuota,
  continuityQuota,
  WORLD_VARIETY_RULES,
  type WorldQuotaOverride,
  type WorldVarietyRules,
} from './variety.js';

/** The catalog entry of a planned moment (undefined for plain, absent or unknown ids). */
export function worldMomentOption(
  text: Pick<WorldPromptText, 'moments'>,
  momentId: string | undefined,
): WorldMomentOption | undefined {
  return momentId === undefined ? undefined : text.moments.find((entry) => entry.id === momentId);
}

const quote = (id: string): string => `\`${id}\``;

function momentLine(option: WorldMomentOption): string {
  const kind = option.breakthrough ? 'breakthrough' : 'moment';
  const host =
    option.looks.length === 0 ? 'any look' : `look ${option.looks.map(quote).join(' or ')}`;
  const length =
    option.minShotS === undefined ? '' : `; a shot of at least ${String(option.minShotS)} s`;
  const again = option.repeatable === true ? '; may recur' : '';
  return `- ${quote(option.id)} (${kind}; ${host}${length}${again}): use when the narration ${option.useWhen}.`;
}

function quotaSentence(
  breakthroughs: readonly string[],
  durationS: number,
  rules: WorldVarietyRules,
  override: WorldQuotaOverride | undefined,
): string {
  const quota = breakthroughQuota(durationS, override, rules);
  const names = breakthroughs.map(quote).join(', ');
  const film = `this film (about ${String(Math.round(durationS))} s) needs at least ${String(quota.min)} and at most ${String(quota.max)}`;
  const kinds = quota.kinds >= 2 ? `, of at least ${String(quota.kinds)} different kinds` : '';
  return `Breakthroughs (${names}) are the showpieces of this world: about one per ${String(rules.breakthroughTargetEveryS)} s of film; ${film}${kinds}; never in adjacent shots.`;
}

/** Storyboard variables of the moment catalog for a film of `durationS` seconds. */
export function storyboardMomentVars(
  text: Pick<WorldPromptText, 'moments'>,
  durationS: number,
  override?: WorldQuotaOverride,
  rules: WorldVarietyRules = WORLD_VARIETY_RULES,
): Record<string, string> {
  if (text.moments.length === 0) return {};
  const breakthroughs = text.moments.filter((entry) => entry.breakthrough).map((entry) => entry.id);
  const transitions =
    durationS >= rules.distinctTransitionsFromS
      ? ` Name the \`style\` of every non-cut transition and use at least ${String(rules.minDistinctTransitions)} different page transitions in the film.`
      : '';
  const rulesText = [
    breakthroughs.length > 0 ? quotaSentence(breakthroughs, durationS, rules, override) : '',
    `The same moment kind at most once per ${String(rules.momentRepeatS)} s${text.moments.some((entry) => entry.repeatable === true) ? ' (except the ones that may recur)' : ''}; never ${String(rules.maxMomentRun + 1)} shots in a row with the same moment (or none) in the same roll; never more than ${String(rules.maxLookRun)} shots in a row in one look.${transitions}`,
  ]
    .filter((part) => part !== '')
    .join(' ');
  const example = text.moments.find((entry) => entry.breakthrough) ?? text.moments[0];
  return {
    worldMoments: text.moments.map(momentLine).join('\n'),
    worldMomentRules: rulesText,
    ...(example === undefined
      ? {}
      : {
          worldMomentExample: `{ "id": "s07_${example.id}", …, "look": "${example.looks[0] ?? ''}", "worldMoment": "${example.id}" }`,
        }),
  };
}

/**
 * Storyboard variable of the world's continuity quota (rendered only inside the prompt's
 * continuity-links section, so a project with links off never sees it); none for short films.
 */
export function storyboardContinuityVars(
  text: Pick<WorldPromptText, 'continuity'>,
  durationS: number,
  rules: WorldVarietyRules = WORLD_VARIETY_RULES,
): Record<string, string> {
  const min = continuityQuota(durationS, rules);
  if (min === 0) return {};
  const links = min === 1 ? 'at least 1 link' : `at least ${String(min)} links`;
  return {
    worldContinuity: `In this world the link is the signature cut: this film (about ${String(Math.round(durationS))} s) needs ${links} (the validator counts them). ${text.continuity}`,
  };
}

/** Scene-build / scene-fix variables of the shot's planned moment (none when plain). */
export function sceneMomentVars(
  text: Pick<WorldPromptText, 'moments'>,
  momentId: string | undefined,
): Record<string, string> {
  const option = worldMomentOption(text, momentId);
  return option === undefined ? {} : { worldMoment: option.id, worldMomentDirective: option.build };
}

/** Critic variables of the shot's planned moment (none when plain). */
export function criticMomentVars(
  text: Pick<WorldPromptText, 'moments'>,
  momentId: string | undefined,
): Record<string, string> {
  const option = worldMomentOption(text, momentId);
  return option === undefined ? {} : { worldMoment: option.id, worldMomentCheck: option.visible };
}
