/**
 * Style and worlds in the project UI (PLAN.md#13.6, ADR-029): the New project form's style
 * choice, the read-only "Style" row of Project settings, and the rows that do not apply in a
 * world's project (a world mixes only its own A/B/C looks and draws its own heroes, so look mode,
 * characters and mascot have nothing to switch; a world whose looks are optional, Grim Ink, lets
 * the project turn some of them off, PLAN.md#14.12). Pure.
 */
import type { LookSummary, ProjectStyle } from '../../shared/project-settings-contract.js';
import type { StyleChoice } from '../../shared/style-choices.js';
import type { OptionRowId } from './project-settings-view.js';

/** The tag next to an experimental world's name. */
export const PREVIEW_TAG = 'preview';

export const STYLE_FIELD_HINT =
  'A project keeps its style. A world is a whole film language with its own looks and heroes.';

/**
 * The style the New project form shows as chosen: the user's pick while it is offered, else the
 * default style of the settings, else the first offered one.
 */
export function chosenStyle(
  picked: string | undefined,
  defaultStyle: string | undefined,
  choices: readonly StyleChoice[],
): string | undefined {
  const offered = (id: string | undefined): id is string =>
    id !== undefined && choices.some((choice) => choice.id === id);
  if (offered(picked)) return picked;
  if (offered(defaultStyle)) return defaultStyle;
  return choices[0]?.id;
}

export const STYLE_ROW_NOTE =
  'A project keeps the style it was created with. Choose another style for a new project.';

/**
 * The Style row's line for a preview world while the switch is off, or for a world still in
 * development (undefined otherwise).
 */
export function styleBlockedText(style: ProjectStyle): string | undefined {
  if (style.enabled) return undefined;
  if (style.inDevelopment === true) {
    return `${style.label} is a world still in development: it cannot be built yet. Choose another style for a new project.`;
  }
  return `${style.label} is a preview world: turn on Settings → Projects → “Experimental worlds (preview)” to build this project in it.`;
}

/** A row of a world's project that replaces an option row with what applies instead. */
export interface WorldRowNotice {
  readonly title: string;
  readonly reason: string;
}

/** Option rows that do not apply in a world's project, with the reason shown instead. */
export function worldRowNotice(
  id: OptionRowId,
  style: ProjectStyle | undefined,
): WorldRowNotice | undefined {
  if (style?.world !== true) return undefined;
  switch (id) {
    case 'look-mode':
      return {
        title: 'Looks of this world',
        reason:
          style.optionalLooks === true
            ? `A ${style.label} film mixes its own looks: turn off the ones this film should not use (at least one stays on). The voxel looks and look mode do not apply.`
            : `A ${style.label} film always mixes its own looks; the voxel looks and look mode do not apply.`,
      };
    case 'characters':
      return {
        title: 'People in the film',
        reason: `${style.label} draws its own heroes: the character pack and the classic hero are not used.`,
      };
    case 'mascot':
      return {
        title: 'Mascot of this film',
        reason: `${style.label} draws its own heroes: no mascot appears in its films.`,
      };
    default:
      return undefined;
  }
}

/** `A`, `B`, `C`, …: the roll of a world's look by its place (A roll first). */
export function rollLetter(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

/** One line per look of a world: `A · Sketch story`, with its description. */
export function worldLookLines(
  looks: readonly LookSummary[],
): { readonly id: string; readonly title: string; readonly description: string }[] {
  return looks.map((look, index) => ({
    id: look.id,
    title: `${rollLetter(index)} · ${look.label}`,
    description: look.description,
  }));
}

/** Note of the "Looks of this world" row when its looks can be turned off. */
export const WORLD_LOOKS_NOTE =
  'Applies to the next Storyboard and Scenes build. Shots already built keep their look; no step is marked out of date.';

/** One look of a world with its on/off box (`locked`: the last look on cannot be turned off). */
export interface WorldLookToggle {
  readonly id: string;
  /** `A · Ink scene` (the roll among the looks on) or `Off · Ink insert`. */
  readonly title: string;
  readonly description: string;
  readonly checked: boolean;
  readonly locked: boolean;
}

/** The world's looks with their boxes; `enabled` null = all on. */
export function worldLookToggles(
  looks: readonly LookSummary[],
  enabled: readonly string[] | null,
): WorldLookToggle[] {
  const on = looks.filter((look) => enabled === null || enabled.includes(look.id));
  // A list without any of the world's looks counts as all on (as in the stages).
  const kept = on.length === 0 ? looks : on;
  return looks.map((look) => {
    const index = kept.indexOf(look);
    return {
      id: look.id,
      title: `${index < 0 ? 'Off' : rollLetter(index)} · ${look.label}`,
      description: look.description,
      checked: index >= 0,
      locked: index >= 0 && kept.length === 1,
    };
  });
}

/**
 * The project's looks after turning `id` on or off, in the world's order: null when every look is
 * on (the field is removed); the same list when it would leave no look on.
 */
export function toggledWorldLooks(
  looks: readonly LookSummary[],
  enabled: readonly string[] | null,
  id: string,
  on: boolean,
): readonly string[] | null {
  const current = worldLookToggles(looks, enabled).filter((look) => look.checked);
  const ids = new Set(current.map((look) => look.id));
  if (on) ids.add(id);
  else ids.delete(id);
  const next = looks.filter((look) => ids.has(look.id)).map((look) => look.id);
  if (next.length === 0) return current.map((look) => look.id);
  return next.length === looks.length ? null : next;
}
