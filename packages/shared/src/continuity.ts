/**
 * Continuity links between shots (PLAN.md#13.2, docs/worlds/DECISIONS.md "What Papi loved" #1):
 * the signature of ReelForge worlds. A shot may carry `continuity` = an explicit link from the
 * previous shot: a shared object or anchor that the camera or the action carries across the cut
 * instead of a wipe. Kinds:
 * - `zoom-through`: the camera dives into the object and the next shot opens on it, centred (the
 *   wall calendar becomes the page of a year); the anchor is the object's place in the first shot;
 * - `shared-object`: the object stays at the same screen position and scale while the world
 *   around it changes;
 * - `carry-environment`: the place continues while the object in it changes (a cartridge is pulled
 *   out, another goes in).
 * The link is rendered as a continuity style of the transition kit (`continuity-<kind>`) with the
 * anchor as its focus: the storyboard stage writes that `transitionIn` from the link, so the render
 * manifest, the preview and the export carry it like any other transition (one engine). Rules: rare
 * (about one per 45 s at most), never on the first shot. Pure.
 */
import { z } from 'zod';
import type { ProjectFile } from './project.js';
import type { StoryboardShot, Transition, TransitionFocus } from './storyboard.js';

export const CONTINUITY_KINDS = ['zoom-through', 'shared-object', 'carry-environment'] as const;
export const continuityKindSchema = z.enum(CONTINUITY_KINDS);
export type ContinuityKind = z.infer<typeof continuityKindSchema>;

/**
 * `shot.continuity`: the link from the previous shot into this one. `object` names the thing both
 * shots show; `anchor` is where it sits on screen at the cut (share of the frame from the left /
 * top edge, 0..1; absent = the centre): in both shots, except `zoom-through`, whose second shot
 * opens on the object centred.
 */
export const continuityLinkSchema = z.object({
  kind: continuityKindSchema,
  object: z.string().min(1).max(80),
  anchor: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
});
export type ContinuityLink = z.infer<typeof continuityLinkSchema>;

export const CONTINUITY_STYLE_IDS = [
  'continuity-zoom-through',
  'continuity-shared-object',
  'continuity-carry-environment',
] as const;
export type ContinuityStyleId = (typeof CONTINUITY_STYLE_IDS)[number];

export interface ContinuityStyle {
  readonly id: ContinuityStyleId;
  readonly kind: ContinuityKind;
  readonly label: string;
  /** One line for the docs. */
  readonly description: string;
  /** Plain transition type (sound, act detection, fallback rendering in an older engine). */
  readonly type: 'crossfade';
  /** Seconds: what the stage writes (capped at half the incoming shot). */
  readonly duration: number;
}

export const CONTINUITY_STYLES: Readonly<Record<ContinuityStyleId, ContinuityStyle>> = {
  'continuity-zoom-through': {
    id: 'continuity-zoom-through',
    kind: 'zoom-through',
    label: 'Zoom through',
    description:
      'the camera dives into the object at the anchor; the next shot opens on it, centred, and settles',
    type: 'crossfade',
    duration: 1,
  },
  'continuity-shared-object': {
    id: 'continuity-shared-object',
    kind: 'shared-object',
    label: 'Shared object',
    description:
      'the object holds its place on screen while the world around it changes, edges first',
    type: 'crossfade',
    duration: 0.6,
  },
  'continuity-carry-environment': {
    id: 'continuity-carry-environment',
    kind: 'carry-environment',
    label: 'Carry environment',
    description: 'the place continues; the object at the anchor changes first, then the rest',
    type: 'crossfade',
    duration: 0.6,
  },
};

export const CONTINUITY_RULES = {
  /** About one link per this many seconds at most (closer: warning). */
  spacingS: 45,
} as const;

const CENTRE: TransitionFocus = { x: 0.5, y: 0.5 };

/** The continuity style id of a link kind. */
export function continuityStyleId(kind: ContinuityKind): ContinuityStyleId {
  return `continuity-${kind}`;
}

export function isContinuityStyle(style: string | undefined): style is ContinuityStyleId {
  return style !== undefined && (CONTINUITY_STYLE_IDS as readonly string[]).includes(style);
}

/** The link kind a `transitionIn` renders, if it is a continuity style. */
export function continuityKindOf(transition: Transition | undefined): ContinuityKind | undefined {
  if (transition === undefined || transition.type === 'cut') return undefined;
  return isContinuityStyle(transition.style) ? CONTINUITY_STYLES[transition.style].kind : undefined;
}

/** How many links a film of this length may have (at least one). */
export function continuityBudget(durationS: number): number {
  return Math.max(1, Math.floor(durationS / CONTINUITY_RULES.spacingS));
}

/** The continuity switch of a project (absent = off: storyboards are planned as before). */
export function projectContinuityLinks(project: Pick<ProjectFile, 'continuityLinks'>): boolean {
  return project.continuityLinks === true;
}

/**
 * Seconds a link plays into `shot`: its style's duration, at most half of the shot (rounded to ms
 * so storyboard.json stays readable).
 */
export function continuityDuration(
  shot: Pick<StoryboardShot, 't0' | 't1'>,
  link: Pick<ContinuityLink, 'kind'>,
): number {
  const room = (shot.t1 - shot.t0) / 2;
  const duration = Math.min(CONTINUITY_STYLES[continuityStyleId(link.kind)].duration, room);
  return Math.max(0.001, Math.round(duration * 1000) / 1000);
}

/** The `transitionIn` a link renders as: its continuity style, focused on the anchor. */
export function continuityTransition(
  shot: Pick<StoryboardShot, 't0' | 't1'>,
  link: ContinuityLink,
): Transition {
  const style = CONTINUITY_STYLES[continuityStyleId(link.kind)];
  return {
    type: style.type,
    duration: continuityDuration(shot, link),
    style: style.id,
    focus: link.anchor ?? CENTRE,
  };
}

export interface LinkedShots<Shot> {
  readonly shots: Shot[];
  /** Ids of the shots whose `transitionIn` was written from their link. */
  readonly changed: readonly string[];
}

function sameTransition(first: Transition | undefined, second: Transition): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * Writes every linked shot's `transitionIn` from its `continuity` (the link wins over whatever the
 * storyboard wrote there). The first shot and shots without a link are left alone. Storyboards
 * without links come back unchanged.
 */
export function applyContinuityTransitions<
  Shot extends Pick<StoryboardShot, 'id' | 't0' | 't1' | 'transitionIn' | 'continuity'>,
>(shots: readonly Shot[]): LinkedShots<Shot> {
  const changed: string[] = [];
  const result = shots.map((shot, index): Shot => {
    if (shot.continuity === undefined || index === 0) return shot;
    const transition = continuityTransition(shot, shot.continuity);
    if (sameTransition(shot.transitionIn, transition)) return shot;
    changed.push(shot.id);
    return { ...shot, transitionIn: transition };
  });
  return { shots: result, changed };
}

/** A planned link of the storyboard: the shot it leads into and the shot before it. */
export interface PlannedLink {
  readonly fromShotId: string;
  readonly toShotId: string;
  readonly link: ContinuityLink;
  /** The shot's `transitionIn` renders the link (its continuity style). */
  readonly wired: boolean;
}

/** Every link of the storyboard, in shot order (a link on the first shot is not one). */
export function plannedLinks(
  shots: readonly Pick<StoryboardShot, 'id' | 'transitionIn' | 'continuity'>[],
): PlannedLink[] {
  return shots.flatMap((shot, index): PlannedLink[] => {
    const previous = shots[index - 1];
    if (shot.continuity === undefined || previous === undefined) return [];
    return [
      {
        fromShotId: previous.id,
        toShotId: shot.id,
        link: shot.continuity,
        wired: continuityKindOf(shot.transitionIn) === shot.continuity.kind,
      },
    ];
  });
}
