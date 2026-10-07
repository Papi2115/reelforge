/**
 * The breakthrough methods of `kit.fx.b2View` (PLAN.md#13.4 part b): `automap(spec)` (the level
 * from above, unfolding out of and folding back into the HUD minimap), `throw(item, spec)` (an
 * item leaves the hand along an arc into the level, the sprite it hits flinches) and `fog(spec)`
 * (a fog bank rolls in and clears: time passes). Every call validates its spec with readable
 * errors and returns its times plus suggested sound cues (`ctx.sfx.at(cue.t, cue.name)`).
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { clamp } from '../core/rand.js';
import type { CompiledLevel } from '../level/compile.js';
import { Automap } from '../map/automap.js';
import { planAutomap, type Time } from '../map/automap-plan.js';
import { automapSchema } from '../map/automap-spec.js';
import { roomAt } from '../ray/raycast.js';
import type { ItemLook } from '../ray/sprites-props.js';
import type { ThrowEvent } from './throw.js';
import type { B2World } from './world.js';

export interface Cue {
  readonly t: number;
  /** A built-in sound name for `ctx.sfx.at` (the world's palette re-voices it). */
  readonly name: 'whoosh' | 'hit-soft' | 'blip-up' | 'blip-down' | 'paper';
}

export interface Timed {
  readonly at: number;
  readonly end: number;
  readonly cues: readonly Cue[];
}

const cell = z.tuple([z.number(), z.number()]);

export const throwSchema = z.strictObject({
  intent: z
    .string()
    .min(12)
    .max(160)
    .describe('What the throw means (the cartridge goes into the pit: the end of the game)'),
  at: whenParam.describe('The item leaves the hand (the wind-up is before it)'),
  to: cell.optional().describe('Landing point in cells (or target)'),
  target: z.string().min(1).optional().describe('Sprite id it hits (it flinches); or to'),
  z: z.number().min(-0.5).max(1).optional().describe('Landing height (default floor / low wall / sprite)'),
  arc: z.number().min(0).max(1.2).optional().describe('Extra height at the top of the arc'),
  dur: z.number().min(0.25).max(1.6).optional().describe('Flight seconds (default from distance)'),
  windup: z.number().min(0.2).max(0.8).default(0.38).describe('Seconds of dip and swing before it'),
  stay: z.boolean().default(true).describe('false = gone on landing (into a bin, a pit)'),
  shake: z.number().min(0).max(3).default(0).describe('A thump of the view on landing'),
});

export const fogSchema = z.strictObject({
  at: whenParam,
  until: whenParam,
  amount: z.number().min(0.1).max(1).default(0.85),
});

interface Context {
  readonly world: B2World;
  readonly compiled: CompiledLevel;
  readonly seed: number;
  readonly time: Time;
  readonly fail: (message: string) => never;
  readonly parse: <S extends z.ZodType>(schema: S, value: unknown, what: string) => z.output<S>;
  readonly itemLook: (value: unknown) => ItemLook;
}

function landing(
  ctx: Context,
  spec: z.output<typeof throwSchema>,
  dir: readonly [number, number],
): { to: [number, number, number]; hit: string | undefined } {
  const { compiled, fail } = ctx;
  if ((spec.to === undefined) === (spec.target === undefined))
    fail('throw(): give exactly one of to: [x, y] or target: spriteId');
  if (spec.target !== undefined) {
    const sprite = compiled.sprites.find((entry) => entry.id === spec.target);
    if (sprite === undefined) return fail(`throw(): no sprite with id "${spec.target}" in the level`);
    // People catch it on the chest and it drops at their feet; things take it on top.
    const person = sprite.kind === 'clerk';
    const z = spec.z ?? (person ? 0 : sprite.z + Math.min(sprite.h * 0.45, 0.45));
    const back = person ? 0.24 : 0.05;
    return { to: [sprite.x - dir[0] * back, sprite.y - dir[1] * back, z], hit: spec.target };
  }
  const [x, y] = spec.to ?? [0, 0];
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= compiled.w || cy >= compiled.h)
    fail(`throw(to): [${String(x)}, ${String(y)}] is outside the grid`);
  const type = compiled.wallTypes[compiled.wall[cy * compiled.w + cx] ?? 0];
  const height = type === undefined || type.tex.length === 0 ? 0 : type.h;
  if (height >= 1 || type?.door === true)
    fail(`throw(to): [${String(x)}, ${String(y)}] is inside a wall or door; land it in an open cell or on a low wall`);
  return { to: [x, y, spec.z ?? height], hit: undefined };
}

export function viewExtras(ctx: Context) {
  const { world, compiled, seed, time, fail, parse } = ctx;
  return {
    automap(spec: unknown): Timed & { open: number; fold: number; intent: string } {
      const parsed = parse(automapSchema, spec, 'automap()');
      const plan = planAutomap(parsed, compiled, world.path, time, fail);
      for (let t = plan.at; t < plan.until; t += 0.1)
        if (world.mapCover(t) !== null) fail('automap(): two automaps overlap in time');
      world.addAutomap(new Automap(plan, world.path, seed));
      const cues: Cue[] = [{ t: plan.at, name: 'blip-up' }];
      if (plan.exit === 'fold') cues.push({ t: plan.foldAt + 0.1, name: 'blip-down' });
      return { at: plan.at, end: plan.until, open: plan.open, fold: plan.foldAt, intent: plan.intent, cues };
    },
    throw(item: unknown, spec: unknown): Timed & { release: number; land: number; intent: string } {
      const look = ctx.itemLook(item);
      const o = parse(throwSchema, spec, 'throw()');
      const release = time(o.at, 'throw');
      const cam = world.path.at(release, 0, 0);
      const dir: [number, number] = [Math.cos(cam.a), Math.sin(cam.a)];
      const { to, hit } = landing(ctx, o, dir);
      // It leaves the hand about where the held item is on screen (the same size): ~1 cell ahead.
      const ahead = Math.min(1, 0.6 * Math.hypot(to[0] - cam.x, to[1] - cam.y));
      const from: [number, number, number] = [
        cam.x + dir[0] * ahead,
        cam.y + dir[1] * ahead,
        cam.eye + 0.05,
      ];
      const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const dur = o.dur ?? clamp(0.3 + distance * 0.11, 0.35, 1.3);
      const event: ThrowEvent = {
        windup: release - o.windup,
        release,
        land: release + dur,
        end: release + 0.6,
        item: look,
        from,
        to,
        arc: o.arc ?? Math.min(0.6, 0.12 + distance * 0.06),
        stay: o.stay,
        spin: hashSpin(seed, release),
        region: (x, y) => roomAt(compiled, x, y),
      };
      world.throwItem(event, hit);
      world.hand.add({ kind: 'throw', at: event.windup, release, until: event.end, item: look });
      if (o.shake > 0) world.shake(event.land, o.shake);
      const landSound = look.kind === 'note' ? 'paper' : 'hit-soft';
      return {
        at: event.windup,
        release,
        land: event.land,
        end: event.land + 0.4,
        intent: o.intent,
        cues: [
          { t: release - 0.04, name: 'whoosh' },
          { t: event.land, name: landSound },
        ],
      };
    },
    fog(spec: unknown): Timed {
      const o = parse(fogSchema, spec, 'fog()');
      const at = time(o.at, 'fog');
      const until = time(o.until, 'fog');
      if (until - at < 1.2) fail('fog(): a fog bank needs >= 1.2 s (0.6 s in, 0.6 s out)');
      world.fog(at, until, o.amount);
      return { at, end: until, cues: [] };
    },
  };
}

function hashSpin(seed: number, release: number): number {
  return (Math.floor(release * 31) + seed) % 2 === 0 ? 1 : -1;
}
