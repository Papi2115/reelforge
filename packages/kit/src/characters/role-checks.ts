/**
 * Checks of a role spec by code (ADR-026, the QA of on-demand roles): at most four outfit
 * colours, only pack swatches or style tokens, a face (eyes or a visor), and every accessory and
 * held prop resolved in the vocabulary on a valid slot. The render checks (height within the
 * pack's range, views, vibe guard) live with the lineup render in the CLI.
 */
import { isSpecColor } from './palette.js';
import { NO_PROJECT_CAST, type ProjectCast } from './project-roles.js';
import { HEADGEAR_TABLE, MAX_OUTFIT_COLORS, outfitColors, type AnyRoleSpec } from './role-spec.js';

export type RoleSpecCheckId = 'outfit-colors' | 'palette' | 'face' | 'accessories';

export interface RoleSpecCheck {
  readonly id: RoleSpecCheckId;
  readonly ok: boolean;
  readonly message: string;
}

function specColors(spec: AnyRoleSpec): string[] {
  const items = [
    spec.headgear,
    ...spec.layers,
    ...spec.accessories,
    ...(spec.held ? [spec.held] : []),
  ];
  const colors = [
    spec.top.color,
    spec.legs.color,
    spec.shoes.color,
    spec.hair.color,
    spec.eyes.color,
    ...items.flatMap((item) => [item.color, 'trim' in item ? item.trim : undefined]),
    ...[...spec.layers, ...spec.accessories, spec.headgear].map((item) =>
      'detail' in item ? item.detail : undefined,
    ),
  ];
  return [...new Set(colors.filter((color): color is string => color !== undefined))];
}

function accessoryCheck(spec: AnyRoleSpec, project: ProjectCast): RoleSpecCheck {
  const described = [
    ...spec.accessories.map((ref) => ({ id: ref.id, held: false })),
    ...(spec.held ? [{ id: spec.held.id, held: true }] : []),
  ].map(({ id, held }) => {
    const extension = project.accessories.get(id);
    const known = held ? project.vocabulary.held.has(id) : project.vocabulary.accessories.has(id);
    if (!known) return { id, problem: `${id} is not in the vocabulary` };
    if (extension === undefined) return { id, text: `${id} (kit${held ? ', hand' : ''})` };
    const slotOk = held ? extension.slot === 'hand' : extension.slot !== 'hand';
    return slotOk
      ? { id, text: `${id} (project, ${extension.slot})` }
      : {
          id,
          problem: `${id} is a ${extension.slot} accessory in ${held ? 'held' : 'accessories'}`,
        };
  });
  const problems = described.flatMap((entry) => ('problem' in entry ? [entry.problem] : []));
  if (problems.length > 0) return { id: 'accessories', ok: false, message: problems.join('; ') };
  const texts = described.flatMap((entry) => ('text' in entry ? [entry.text] : []));
  return {
    id: 'accessories',
    ok: true,
    message: texts.length === 0 ? 'no accessories or held prop' : `attached: ${texts.join(', ')}`,
  };
}

/** The spec checks of a (validated) role. */
export function roleSpecChecks(
  spec: AnyRoleSpec,
  project: ProjectCast = NO_PROJECT_CAST,
): RoleSpecCheck[] {
  const outfit = outfitColors(spec);
  const colors = specColors(spec);
  const offPalette = colors.filter((color) => !isSpecColor(color));
  const visor = HEADGEAR_TABLE.get(spec.headgear.id)?.adjust?.hidesEyes === true;
  return [
    outfit.length <= MAX_OUTFIT_COLORS
      ? { id: 'outfit-colors', ok: true, message: `outfit colours: ${outfit.join(', ')}` }
      : {
          id: 'outfit-colors',
          ok: false,
          message: `the outfit uses ${String(outfit.length)} colours (${outfit.join(', ')}); at most ${String(MAX_OUTFIT_COLORS)}`,
        },
    offPalette.length === 0
      ? {
          id: 'palette',
          ok: true,
          message: `${String(colors.length)} colours, all pack swatches or style tokens`,
        }
      : { id: 'palette', ok: false, message: `not palette colours: ${offPalette.join(', ')}` },
    spec.eyes.style !== 'none' || visor
      ? {
          id: 'face',
          ok: true,
          message: visor ? 'a visor instead of eyes' : `eyes: ${spec.eyes.style}`,
        }
      : {
          id: 'face',
          ok: false,
          message: 'no face: eyes.style is "none" (the pack always shows eyes or a visor)',
        },
    accessoryCheck(spec, project),
  ];
}
