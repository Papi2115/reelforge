/**
 * Style and worlds in the project UI (PLAN.md#13.6, ADR-029): the New project form's style
 * choice, the read-only "Style" row of Project settings, and the rows that do not apply in a
 * world's project (a world mixes only its own A/B/C looks and draws its own heroes, so look mode,
 * characters and mascot have nothing to switch). Pure.
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
        reason: `A ${style.label} film always mixes its own looks; the voxel looks and look mode do not apply.`,
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
