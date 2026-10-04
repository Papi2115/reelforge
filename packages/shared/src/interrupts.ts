/**
 * Pattern interrupts (PLAN.md#12.25, ADR-020): planned surprises, 1–2 per minute (more where the
 * tension map is high). The storyboard marks a shot with `interrupt: { kind, note }`; the shot
 * realises it with a transition of the transition kit (12.15: a look change, `crt-zoom` to enter a
 * screen) or a cinematic camera move of its scene (12.28: dolly zoom, orbit, rack focus,
 * parallax). The rules here are shared by the storyboard validator, the scene-build directive and
 * the interrupt report (planned vs realised per minute). Pure.
 */
import { z } from 'zod';
import type { StoryboardShot } from './storyboard.js';

export const INTERRUPT_KINDS = [
  'look-switch',
  'scale-shift',
  'perspective-shift',
  'enter-screen',
] as const;
export const interruptKindSchema = z.enum(INTERRUPT_KINDS);
export type InterruptKind = z.infer<typeof interruptKindSchema>;

/** A planned surprise at the start of a shot (storyboard `shot.interrupt`, optional). */
export const interruptSchema = z.object({
  kind: interruptKindSchema,
  /** What surprises the viewer, in plain words ("we dive into the CRT and land in the map"). */
  note: z.string().min(1).max(160),
});
export type Interrupt = z.infer<typeof interruptSchema>;

export interface InterruptRules {
  /** Planned interrupts per minute of film (warning outside). */
  readonly minPerMinute: number;
  readonly maxPerMinute: number;
  /** No interrupt before this (s): the hook must land first. */
  readonly firstAllowedS: number;
  /** Minimum gap between two interrupts (s). */
  readonly minSpacingS: number;
}

export const DEFAULT_INTERRUPT_RULES: InterruptRules = {
  minPerMinute: 1,
  maxPerMinute: 2,
  firstAllowedS: 5,
  minSpacingS: 15,
};

/** Looks whose scenes may run the 12.28 camera moves (2D boards and UI panels may not). */
export const CAMERA_MOVE_LOOKS: readonly string[] = ['voxel'];

/** The transition style that enters (or leaves) a screen. */
export const ENTER_SCREEN_STYLE = 'crt-zoom';
const SCREEN_LOOK = 'retro-ui';

export const CAMERA_MOVE_NAMES = ['dollyZoom', 'orbit', 'rackFocus', 'parallax'] as const;
export type CameraMoveName = (typeof CAMERA_MOVE_NAMES)[number];

/** How each kind is realised: by the shot's transition in, or by a camera move of its scene. */
export const INTERRUPT_REALISATION: Readonly<Record<InterruptKind, 'transition' | 'camera'>> = {
  'look-switch': 'transition',
  'enter-screen': 'transition',
  'scale-shift': 'camera',
  'perspective-shift': 'camera',
};

/** The camera moves (ctx.camera, PLAN.md#12.28) that realise a camera kind. */
export const INTERRUPT_CAMERA_MOVES: Readonly<Record<InterruptKind, readonly CameraMoveName[]>> = {
  'look-switch': [],
  'enter-screen': [],
  'scale-shift': ['dollyZoom'],
  'perspective-shift': ['orbit', 'rackFocus', 'parallax'],
};

/** Planned-rate target per minute at tension v (0..1): 1/min calm … 2/min at the peak. */
export function targetInterruptRate(
  tension: number | undefined,
  rules = DEFAULT_INTERRUPT_RULES,
): number {
  const v = Math.min(1, Math.max(0, tension ?? 0.5));
  return rules.minPerMinute + (rules.maxPerMinute - rules.minPerMinute) * v;
}

/** Allowed number of planned interrupts in a film of `durationS` seconds. */
export function interruptRange(
  durationS: number,
  rules = DEFAULT_INTERRUPT_RULES,
): { readonly min: number; readonly max: number } {
  const minutes = Math.max(0, durationS) / 60;
  return {
    min: minutes < 0.75 ? 0 : Math.floor(minutes * rules.minPerMinute),
    max: Math.max(1, Math.ceil(minutes * rules.maxPerMinute)),
  };
}

type LookPair = { readonly from: string | undefined; readonly to: string };

/** Why `kind` cannot happen between these looks (undefined = it can). */
export function interruptKindProblem(kind: InterruptKind, looks: LookPair): string | undefined {
  const { from, to } = looks;
  if (kind === 'look-switch') {
    return from !== undefined && from !== to
      ? undefined
      : `a look-switch needs a different look than the previous shot (both ${to})`;
  }
  if (kind === 'enter-screen') {
    if (from === undefined || from === to) {
      return 'enter-screen needs a look change into or out of a screen (retro-ui)';
    }
    return from === SCREEN_LOOK || to === SCREEN_LOOK
      ? undefined
      : `enter-screen dives into or out of a retro-ui screen; ${from} -> ${to} has none`;
  }
  return CAMERA_MOVE_LOOKS.includes(to)
    ? undefined
    : `${kind} needs a camera move, which the ${to} look does not allow (use ${CAMERA_MOVE_LOOKS.join(', ')})`;
}

const MOVE_PATTERNS: Readonly<Record<CameraMoveName, RegExp>> = {
  dollyZoom: /\bcamera\s*\.\s*dollyZoom\s*\(/,
  rackFocus: /\bcamera\s*\.\s*rackFocus\s*\(/,
  parallax: /\bcamera\s*\.\s*parallax\s*\(/,
  // The orbit MOVE takes `t0` (the older orbit rig takes from/to): look inside its options.
  orbit: /\bcamera\s*\.\s*orbit\s*\(\s*\{[^}]*\bt0\b/,
};

/** 12.28 camera moves a scene source calls (by name, in CAMERA_MOVE_NAMES order). */
export function cameraMovesIn(source: string): CameraMoveName[] {
  return CAMERA_MOVE_NAMES.filter((name) => MOVE_PATTERNS[name].test(source));
}

type InterruptShot = Pick<StoryboardShot, 'id' | 't0' | 't1' | 'look' | 'transitionIn'> & {
  readonly interrupt?: Interrupt | undefined;
};

const lookOf = (shot: Pick<StoryboardShot, 'look'> | undefined): string | undefined =>
  shot === undefined ? undefined : (shot.look ?? 'voxel');

/** How a planned interrupt shows up in the film (`undefined` = not realised). */
export function interruptRealisedBy(
  shot: InterruptShot,
  previous: InterruptShot | undefined,
  source: string | undefined,
): string | undefined {
  const interrupt = shot.interrupt;
  if (interrupt === undefined) return undefined;
  const transition = shot.transitionIn;
  const style = transition?.type === 'cut' ? undefined : transition?.style;
  if (interrupt.kind === 'enter-screen') {
    return style === ENTER_SCREEN_STYLE ? `transition ${style}` : undefined;
  }
  if (interrupt.kind === 'look-switch') {
    const changes = previous !== undefined && lookOf(previous) !== lookOf(shot);
    if (!changes || transition === undefined || transition.type === 'cut') return undefined;
    return `transition ${style ?? transition.type}`;
  }
  const moves = cameraMovesIn(source ?? '').filter((name) =>
    INTERRUPT_CAMERA_MOVES[interrupt.kind].includes(name),
  );
  return moves.length === 0 ? undefined : `camera ${moves.join(', ')}`;
}

export const INTERRUPT_REPORT_VERSION = 1;

export const interruptReportSchema = z.object({
  version: z.literal(INTERRUPT_REPORT_VERSION),
  durationS: z.number().nonnegative(),
  planned: z.int().nonnegative(),
  realised: z.int().nonnegative(),
  /** Allowed planned count for this length (DEFAULT_INTERRUPT_RULES). */
  range: z.object({ min: z.int().nonnegative(), max: z.int().nonnegative() }),
  perMinute: z.array(
    z.object({
      minute: z.int().nonnegative(),
      planned: z.int().nonnegative(),
      realised: z.int().nonnegative(),
    }),
  ),
  shots: z.array(
    z.object({
      shotId: z.string().min(1),
      t: z.number().nonnegative(),
      kind: interruptKindSchema,
      note: z.string(),
      /** How it was realised ("transition crt-zoom", "camera dollyZoom"); null = not in the frames. */
      realisedBy: z.string().nullable(),
    }),
  ),
});
export type InterruptReport = z.infer<typeof interruptReportSchema>;

/** Planned vs realised interrupts, per minute (sources: scene source text per shot id). */
export function buildInterruptReport(
  shots: readonly InterruptShot[],
  sources: ReadonlyMap<string, string>,
): InterruptReport {
  const durationS = shots.at(-1)?.t1 ?? 0;
  const entries = shots.flatMap((shot, index) => {
    if (shot.interrupt === undefined) return [];
    const realisedBy = interruptRealisedBy(shot, shots[index - 1], sources.get(shot.id)) ?? null;
    return [
      {
        shotId: shot.id,
        t: shot.t0,
        kind: shot.interrupt.kind,
        note: shot.interrupt.note,
        realisedBy,
      },
    ];
  });
  const minutes = Math.max(1, Math.ceil(durationS / 60));
  const perMinute = Array.from({ length: minutes }, (_, minute) => {
    const inMinute = entries.filter((entry) => Math.floor(entry.t / 60) === minute);
    return {
      minute,
      planned: inMinute.length,
      realised: inMinute.filter((entry) => entry.realisedBy !== null).length,
    };
  });
  return {
    version: INTERRUPT_REPORT_VERSION,
    durationS,
    planned: entries.length,
    realised: entries.filter((entry) => entry.realisedBy !== null).length,
    range: interruptRange(durationS),
    perMinute,
    shots: entries,
  };
}

/** The scene-build directive of a shot's interrupt (empty when it has none). */
export function interruptDirective(
  shot: InterruptShot,
  previous: InterruptShot | undefined,
): string {
  const interrupt = shot.interrupt;
  if (interrupt === undefined) return '';
  const head = `${interrupt.kind}: ${interrupt.note}`;
  switch (interrupt.kind) {
    case 'look-switch':
    case 'enter-screen':
      return `${head}. The engine draws the transition from ${lookOf(previous) ?? 'the previous shot'} (storyboard \`transitionIn\`); open the shot on a strong, readable first frame that pays the surprise off.`;
    case 'scale-shift':
      return `${head}. Realise it with \`ctx.camera.dollyZoom({ from, to, t0, t1 })\` in update() (resolve t0/t1 from anchors in build), within the first 1.5 s of the shot.`;
    case 'perspective-shift':
      return `${head}. Realise it with \`ctx.camera.orbit({ degrees, t0, t1 })\`, \`ctx.camera.rackFocus({ from, to, t0, t1 })\` or \`ctx.camera.parallax({ amount, t0, t1 })\` in update(), within the first 1.5 s of the shot.`;
  }
}
