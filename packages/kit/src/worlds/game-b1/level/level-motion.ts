/**
 * Motion of a B1 level (level-plan.ts), all pure functions of t: the hero's held-step run along
 * its keys, jump arcs (a parabola from the floor it stands on to the floor it lands on), the
 * level it stands on after each jump, an enemy's patrol, and the coarse camera scroll in whole
 * 4-unit playfield blocks (a 2600 cannot scroll by a pixel).
 */
import { path } from '../vocab/logic.js';

export interface Jump {
  readonly at: number;
  readonly dur: number;
  readonly height: number;
  /** The floor (top y, TV units) it lands on. */
  readonly land: number;
}

export interface LevelTrack {
  readonly run: readonly (readonly [number, number])[];
  readonly jumps: readonly Jump[];
  readonly heroW: number;
  readonly heroH: number;
  /** The ground's top (TV units). */
  readonly floor: number;
  readonly fps: number;
}

export interface HeroState {
  /** Top-left in level units. */
  readonly x: number;
  readonly y: number;
  readonly dir: -1 | 0 | 1;
  readonly moving: boolean;
  readonly airborne: boolean;
  /** In the second half of a jump (coming down: a stomp). */
  readonly falling: boolean;
  /** Seconds since the last landing (squash), Infinity when it never jumped. */
  readonly sinceLanding: number;
}

/** The floor the hero stands on at t (after the jumps that have landed). */
export function standingFloor(track: LevelTrack, t: number): number {
  let floor = track.floor;
  for (const jump of track.jumps) if (jump.at + jump.dur <= t) floor = jump.land;
  return floor;
}

export function heroAt(track: LevelTrack, t: number): HeroState {
  const tt = Math.floor(t * track.fps + 1e-6) / track.fps;
  const step = path(
    track.run.map(([at, x]) => [at, x, 0] as const),
    tt,
    { fps: track.fps },
  );
  let sinceLanding = Number.POSITIVE_INFINITY;
  let from = track.floor;
  for (const jump of track.jumps) {
    if (tt < jump.at) break;
    if (tt < jump.at + jump.dur) {
      const u = (tt - jump.at) / jump.dur;
      const base = from + (jump.land - from) * u;
      return {
        x: step.x,
        y: Math.round(base - jump.height * 4 * u * (1 - u)) - track.heroH,
        dir: step.dir,
        moving: true,
        airborne: true,
        falling: u > 0.5,
        sinceLanding,
      };
    }
    from = jump.land;
    sinceLanding = tt - (jump.at + jump.dur);
  }
  return {
    x: step.x,
    y: from - track.heroH,
    dir: step.dir,
    moving: step.moving,
    airborne: false,
    falling: false,
    sinceLanding,
  };
}

/** The hero's collision box (a unit inside its sprite: near misses read as misses). */
export function heroBox(track: LevelTrack, hero: HeroState) {
  return { x: hero.x + 1, y: hero.y + 1, w: Math.max(1, track.heroW - 2), h: track.heroH - 1 };
}

/** An enemy's x at t on its patrol (there and back, held steps); others stay at x. */
export function patrolX(
  thing: {
    readonly x: number;
    readonly patrol: { readonly to: number; readonly period: number } | undefined;
  },
  t: number,
  fps: number,
): number {
  const patrol = thing.patrol;
  if (patrol === undefined) return thing.x;
  const tt = Math.floor(t * fps + 1e-6) / fps;
  const phase = (((tt / patrol.period) % 2) + 2) % 2;
  const tri = phase < 1 ? phase : 2 - phase;
  return Math.round(thing.x + (patrol.to - thing.x) * tri);
}

/** The left edge of the view in level units: whole 4-unit blocks, the hero kept left of centre. */
export function cameraX(width: number, follow: boolean, hero: HeroState): number {
  if (!follow || width <= 160) return 0;
  const want = Math.min(Math.max(0, hero.x - 52), width - 160);
  return Math.floor(want / 4) * 4;
}
