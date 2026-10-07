/**
 * A 2D level played inside the TV (`screen.level(spec)`, PLAN.md#13.15 B1 rework): the film's hero
 * runs through a level designed from the narration, jumps over pits and obstacles, dodges or
 * stomps enemies on patrol, collects items and reaches the goal while the playfield scrolls in
 * whole 4-unit blocks. A toolkit, not a template: `intent` (required) says what the level means
 * for the narration; the hero's run and jumps are keys on the narration's beats; every event
 * (collect, hit, stomp, goal) is DERIVED from the geometry by sampling the run at 30 fps, so the
 * scene shows game logic, never a simulation with state. Schema + plan + readable errors here;
 * drawing in level-draw.ts.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { missingGlyphs } from '../core/fonts.js';
import { FPS } from '../core/math.js';
import { colorOfSwatch } from '../palette.js';
import type { B1Sprite } from '../vocab/sprite.js';
import { heroAt, heroBox, patrolX, type LevelTrack } from './level-motion.js';

const CALL = 'kit.fx.b1Screen().level()';
export const VIEW_W = 160;
export const ROLES = ['scenery', 'item', 'obstacle', 'enemy', 'goal'] as const;
export type ThingRole = (typeof ROLES)[number];

const ink = z.string().min(1).describe('A game-b1 colour (night, walnut, avocado, ...)');

export const levelSchema = z.strictObject({
  intent: z
    .string()
    .min(12)
    .max(160)
    .describe(
      'What the level means for the narration (e.g. "the routine is the run to the reward")',
    ),
  at: whenParam.default(0).describe('The level starts playing'),
  until: whenParam.optional().describe('The level is gone (default: the shot end)'),
  width: z
    .int()
    .min(160)
    .max(1280)
    .default(160)
    .describe('Level length in TV units (> 160 scrolls)'),
  sky: z
    .array(z.tuple([z.int().min(0).max(179), ink]))
    .min(1)
    .max(10)
    .default([[0, 'night']])
    .describe('Colour bands top-down [[y, colour], ...] behind the level'),
  ground: z
    .strictObject({
      y: z.int().min(60).max(176).default(150).describe('Top of the floor the hero runs on'),
      colour: ink.default('walnut'),
      edge: ink.optional().describe('A one-unit line on top of the floor'),
      field: z.string().optional().describe('A playfield id of the film drawn from y (scrolls)'),
      pits: z
        .array(z.tuple([z.number(), z.number()]))
        .max(8)
        .default([])
        .describe('[x0, x1) gaps in the floor: the hero must jump them'),
    })
    .prefault({}),
  platforms: z
    .array(
      z.strictObject({
        x: z.number(),
        y: z.int().min(20).max(170),
        w: z.int().min(8).max(160),
        colour: ink.default('teak'),
      }),
    )
    .max(8)
    .default([])
    .describe('Ledges (playfield blocks) a jump may land on (`onto`)'),
  hero: z.strictObject({
    sprite: z.string().min(1).describe("The film's sprite id of the hero"),
    run: z
      .array(z.tuple([whenParam, z.number()]))
      .min(2)
      .max(24)
      .describe('[[t, x], ...] level x of the hero on the narration beats (it must move)'),
    jumps: z
      .array(
        z.strictObject({
          at: whenParam,
          dur: z.number().min(0.25).max(1.6).default(0.6),
          height: z.int().min(6).max(90).default(26),
          onto: z.int().min(0).max(7).optional().describe('Index of the platform it lands on'),
        }),
      )
      .max(12)
      .default([]),
    fps: z.int().min(4).max(30).default(15).describe('Held steps of the run (2600 cadence)'),
  }),
  things: z
    .array(
      z.strictObject({
        sprite: z.string().min(1),
        x: z.number().describe('Level x (TV units)'),
        y: z.number().optional().describe('Top (default: standing on the floor)'),
        role: z.enum(ROLES),
        label: z.string().min(1).max(14).optional().describe('A word of the narration over it'),
        labelAt: whenParam.optional().describe('The label types (default: when the level starts)'),
        appear: whenParam.optional().describe('It drops in at this time (default: always there)'),
        patrol: z
          .strictObject({ to: z.number(), period: z.number().min(0.5).max(8).default(2) })
          .optional()
          .describe('An enemy walking between x and to'),
      }),
    )
    .min(1)
    .max(16),
  camera: z.enum(['follow', 'fixed']).default('follow'),
  hitStop: z.number().min(0).max(0.3).default(0.1).describe('Freeze on a hit, seconds'),
});

export type LevelInput = z.input<typeof levelSchema>;
type Spec = z.output<typeof levelSchema>;

export interface ThingPlan {
  readonly sprite: B1Sprite;
  readonly role: ThingRole;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly label: string | undefined;
  readonly labelAt: number;
  readonly appear: number | undefined;
  readonly patrol: { readonly to: number; readonly period: number } | undefined;
}

export type LevelEventKind = 'jump' | 'collect' | 'hit' | 'stomp' | 'goal';

export interface LevelEvent {
  readonly t: number;
  readonly kind: LevelEventKind;
  /** Index into `things` (jumps: -1). */
  readonly thing: number;
}

export interface LevelPlan extends LevelTrack {
  readonly intent: string;
  /** The hero's sprite id in the film's vocabulary. */
  readonly heroSprite: string;
  readonly at: number;
  readonly until: number;
  readonly width: number;
  readonly sky: readonly (readonly [number, number])[];
  readonly ground: {
    readonly y: number;
    readonly colour: number;
    readonly edge: number | undefined;
    readonly field: string | undefined;
    readonly pits: readonly (readonly [number, number])[];
  };
  readonly platforms: readonly {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly colour: number;
  }[];
  readonly things: readonly ThingPlan[];
  readonly camera: 'follow' | 'fixed';
  readonly hitStop: number;
  readonly events: readonly LevelEvent[];
}

function fail(message: string): never {
  throw new KitError('invalid-params', `${CALL}: ${message}`);
}

function inkOf(name: string, what: string): number {
  const index = colorOfSwatch(name);
  if (index === undefined) fail(`${what}: "${name}" is not a game-b1 colour`);
  return index;
}

function caps(what: string, text: string): string {
  const upper = text.toUpperCase();
  const missing = missingGlyphs(upper, 'joy');
  if (missing.length > 0) fail(`${what} "${text}": the B1 font cannot draw ${missing.join(' ')}`);
  return upper;
}

const sizeOf = (s: B1Sprite) => ({ w: s.width * s.size, h: s.height * s.rowH });

function planThings(
  spec: Spec,
  at: (when: number | string) => number,
  sprite: (id: string) => B1Sprite,
  floor: number,
  start: number,
): ThingPlan[] {
  const things = spec.things.map((thing, i): ThingPlan => {
    const s = sprite(thing.sprite);
    const { w, h } = sizeOf(s);
    if (thing.x < 0 || thing.x + w > spec.width)
      fail(
        `things[${String(i)}] "${thing.sprite}" at x ${String(thing.x)} is outside the level (0-${String(spec.width - w)})`,
      );
    if (thing.patrol !== undefined && thing.role !== 'enemy')
      fail(`things[${String(i)}]: only an enemy patrols (role "${thing.role}")`);
    return {
      sprite: s,
      role: thing.role,
      x: thing.x,
      y: thing.y ?? floor - h,
      w,
      h,
      label:
        thing.label === undefined ? undefined : caps(`things[${String(i)}].label`, thing.label),
      labelAt: thing.labelAt === undefined ? start : at(thing.labelAt),
      appear: thing.appear === undefined ? undefined : at(thing.appear),
      patrol: thing.patrol,
    };
  });
  const playable = things.filter((thing) => thing.role !== 'scenery').length;
  if (playable < 2)
    fail(
      `${String(playable)} playable thing(s): a level needs at least 2 items, obstacles, enemies or a goal (scenery alone is a static picture)`,
    );
  if (things.filter((thing) => thing.role === 'goal').length > 1) fail('at most one goal');
  return things;
}

function planTrack(
  spec: Spec,
  at: (when: number | string) => number,
  hero: B1Sprite,
  floor: number,
  platforms: LevelPlan['platforms'],
): LevelTrack {
  const run = spec.hero.run.map(([t, x]) => [at(t), x] as const);
  for (let i = 1; i < run.length; i += 1)
    if ((run[i]?.[0] ?? 0) < (run[i - 1]?.[0] ?? 0))
      fail(`hero.run[${String(i)}]: keys must be in time order`);
  const { w, h } = sizeOf(hero);
  const xs = run.map(([, x]) => x);
  if (Math.max(...xs) - Math.min(...xs) < 8)
    fail('hero.run: the hero must move through the level (at least 8 units), not stand still');
  for (const x of xs)
    if (x < 0 || x + w > spec.width)
      fail(`hero.run x ${String(x)} is outside the level (0-${String(spec.width - w)})`);
  const jumps = spec.hero.jumps
    .map((jump, i) => {
      if (jump.onto !== undefined && platforms[jump.onto] === undefined)
        fail(
          `hero.jumps[${String(i)}].onto ${String(jump.onto)}: there are ${String(platforms.length)} platforms`,
        );
      const land = jump.onto === undefined ? floor : (platforms[jump.onto]?.y ?? floor);
      return { at: at(jump.at), dur: jump.dur, height: jump.height, land };
    })
    .sort((a, b) => a.at - b.at);
  for (let i = 1; i < jumps.length; i += 1) {
    const a = jumps[i - 1];
    const b = jumps[i];
    if (a !== undefined && b !== undefined && b.at < a.at + a.dur)
      fail(
        `hero.jumps: the jump at ${b.at.toFixed(2)} starts before the one at ${a.at.toFixed(2)} lands`,
      );
  }
  return { run, jumps, heroW: w, heroH: h, floor, fps: spec.hero.fps };
}

/** Standing still on the ground over a pit, or past the end of a ledge, is an error. */
function groundIssue(plan: Omit<LevelPlan, 'events'>, feet: number, mid: number, t: number): void {
  if (feet >= plan.ground.y) {
    for (const [x0, x1] of plan.ground.pits)
      if (mid > x0 && mid < x1)
        fail(
          `the hero walks into the pit [${String(x0)}, ${String(x1)}) at ${t.toFixed(2)} s: add a jump over it (hero.jumps) or move the pit`,
        );
    return;
  }
  const ledge = plan.platforms.findIndex((p) => p.y === feet && mid >= p.x && mid <= p.x + p.w);
  if (ledge < 0)
    fail(
      `the hero runs off its ledge at ${t.toFixed(2)} s (x ${String(Math.round(mid))}): keep hero.run on the platform or add a jump down`,
    );
}

/** Samples the run at 30 fps: pits walked into are errors; collisions become events. */
function deriveEvents(plan: Omit<LevelPlan, 'events'>): LevelEvent[] {
  const events: LevelEvent[] = plan.jumps.map((jump) => ({ t: jump.at, kind: 'jump', thing: -1 }));
  const done = new Set<number>();
  let safeUntil = -Infinity;
  for (let f = Math.ceil(plan.at * FPS); f / FPS < plan.until; f += 1) {
    const t = f / FPS;
    const hero = heroAt(plan, t);
    const box = heroBox(plan, hero);
    const mid = hero.x + plan.heroW / 2;
    if (!hero.airborne) groundIssue(plan, hero.y + plan.heroH, mid, t);
    plan.things.forEach((thing, i) => {
      if (thing.role === 'scenery' || done.has(i)) return;
      if (thing.appear !== undefined && t < thing.appear) return;
      const tx = patrolX(thing, t, plan.fps);
      const overlap =
        box.x < tx + thing.w &&
        tx < box.x + box.w &&
        box.y < thing.y + thing.h &&
        thing.y < box.y + box.h;
      if (!overlap) return;
      if (thing.role === 'item' || thing.role === 'goal') {
        done.add(i);
        events.push({ t, kind: thing.role === 'item' ? 'collect' : 'goal', thing: i });
        return;
      }
      // landing on it (coming down onto its top half, or touching down on it) squashes it
      const fromAbove =
        (hero.falling && box.y + box.h <= thing.y + Math.ceil(thing.h / 2)) ||
        hero.sinceLanding < 0.1;
      if (thing.role === 'enemy' && fromAbove) {
        done.add(i);
        events.push({ t, kind: 'stomp', thing: i });
        return;
      }
      if (t < safeUntil) return;
      safeUntil = t + 0.6;
      events.push({ t, kind: 'hit', thing: i });
    });
  }
  return events.sort((a, b) => a.t - b.t);
}

export function planLevel(
  spec: Spec,
  at: (when: number | string) => number,
  end: number,
  sprite: (id: string) => B1Sprite,
): LevelPlan {
  const start = at(spec.at);
  const until = spec.until === undefined ? end : at(spec.until);
  if (!Number.isFinite(until)) fail('give until (the shot has no duration)');
  if (until <= start) fail('until must come after at');
  const floor = spec.ground.y;
  const platforms = spec.platforms.map((p, i) => ({
    x: p.x,
    y: p.y,
    w: p.w,
    colour: inkOf(p.colour, `platforms[${String(i)}].colour`),
  }));
  const hero = sprite(spec.hero.sprite);
  const track = planTrack(spec, at, hero, floor, platforms);
  const base = {
    ...track,
    intent: spec.intent,
    heroSprite: hero.id,
    at: start,
    until,
    width: spec.width,
    sky: spec.sky.map(([y, name], i) => [y, inkOf(name, `sky[${String(i)}]`)] as const),
    ground: {
      y: floor,
      colour: inkOf(spec.ground.colour, 'ground.colour'),
      edge: spec.ground.edge === undefined ? undefined : inkOf(spec.ground.edge, 'ground.edge'),
      field: spec.ground.field,
      pits: spec.ground.pits.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const),
    },
    platforms,
    things: planThings(spec, at, sprite, floor, start),
    camera: spec.camera,
    hitStop: spec.hitStop,
  };
  return { ...base, events: deriveEvents(base) };
}
