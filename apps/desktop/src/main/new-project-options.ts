/**
 * What the New project form asks createProject for (PLAN.md#6.2, #13.6, #13.8, #13.13): the
 * request is checked before the folder picker (a style the app does not offer, a genre preset it
 * does not know), then folded with the channel and the app defaults. Precedence (ADR-035): the
 * form's explicit choices > genre preset > channel default style > app defaults, so only the fields
 * the user actually touched are passed as explicit; the rest are defaults the preset may replace.
 */
import type { CreateProjectOptions } from '@reelforge/project';
import {
  findGenrePreset,
  type CharacterMode,
  type MascotChoice,
  type ShotsPerMinute,
} from '@reelforge/shared';
import {
  NEW_PROJECT_FORM_FIELDS,
  type NewProjectFormField,
  type NewProjectRequest,
  type ProjectErrorInfo,
} from '../shared/project-contract.js';
import { isOfferedStyle } from '../shared/style-choices.js';
import type { NewProjectChannel } from './channels/new-project-channel.js';

/** App settings of new projects (Settings → Projects). */
export interface NewProjectAppDefaults {
  readonly style?: string | undefined;
  readonly characters?: CharacterMode;
  readonly mascot?: MascotChoice;
  readonly shotsPerMinute?: ShotsPerMinute | null;
  readonly fasterChecks?: boolean;
}

/** Why the request cannot create a project (checked before the folder picker); undefined = fine. */
export function refuseNewProjectRequest(
  request: NewProjectRequest,
  experimentalWorlds: boolean,
): ProjectErrorInfo | undefined {
  if (request.style !== undefined && !isOfferedStyle(request.style, experimentalWorlds)) {
    return {
      kind: 'invalid-argument',
      message: `style "${request.style}" is not offered (preview worlds need Settings → Projects → Experimental worlds)`,
    };
  }
  const genre = request.genrePreset;
  if (typeof genre === 'string' && findGenrePreset(genre) === undefined) {
    return { kind: 'invalid-argument', message: `there is no genre preset "${genre}"` };
  }
  return undefined;
}

/** The form fields the user chose: the request's list, else every one the request carries. */
export function explicitFormFields(request: NewProjectRequest): NewProjectFormField[] {
  if (request.explicitFields !== undefined) return [...new Set(request.explicitFields)];
  return NEW_PROJECT_FORM_FIELDS.filter((field) => request[field] !== undefined);
}

/** createProject's options from the request, the channel and the app defaults (no folder yet). */
export function newProjectChoices(
  request: NewProjectRequest,
  channel: NewProjectChannel | undefined,
  experimentalWorlds: boolean,
  defaults: NewProjectAppDefaults,
): Omit<CreateProjectOptions, 'dir'> {
  const { style: appStyle, ...appDefaults } = defaults;
  // The form's style, else the channel's, else the app's default (a preset may replace the last two).
  const style = request.style ?? channel?.style ?? appStyle;
  return {
    title: request.title,
    language: request.language,
    ...(style === undefined ? {} : { style }),
    ...(channel === undefined
      ? {}
      : {
          channel: {
            id: channel.channel.id,
            defaultStyle: channel.style ?? null,
            genrePreset: channel.channel.genrePreset,
          },
        }),
    ...appDefaults,
    ...(request.shotsPerMinute === undefined ? {} : { shotsPerMinute: request.shotsPerMinute }),
    ...(request.fasterChecks === undefined ? {} : { fasterChecks: request.fasterChecks }),
    ...(request.genrePreset === undefined ? {} : { genrePreset: request.genrePreset }),
    explicitFields: explicitFormFields(request),
    isStyleAvailable: (id) => isOfferedStyle(id, experimentalWorlds),
  };
}
