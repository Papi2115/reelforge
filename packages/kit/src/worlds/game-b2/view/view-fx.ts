/**
 * `kit.fx.b2View`: the first-person view of the Game B2 world. A level (built-in or the scene's
 * own, checked with readable errors), a scripted camera walk with head-bob, and the timed things
 * that happen in it (doors, a bulb clicking on, an NPC talking, props dropping, a shake, the hand
 * taking / holding / presenting an item). Full-frame raster, repainted from scratch every t.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { asFx, type FxObject } from '../../../fx/shared.js';
import {
  anchorParam,
  createResolver,
  whenParam,
  type Resolver,
} from '../../../looks/blueprint/timing.js';
import { defineFx, type KitTools } from '../../../registry.js';
import { EASE_IDS } from '../core/rand.js';
import { compileExtraSprite, compileLevel, type CompiledLevel } from '../level/compile.js';
import { BUILT_IN_LEVELS, builtInLevel, isBuiltInLevel } from '../level/examples.js';
import { checkLevel, isDoor, isWall, legendOf, levelSchemas, type Level } from '../level/schema.js';
import { createPath, type Camera, type PathKey } from '../ray/camera.js';
import { colorOfSwatch } from '../palette.js';
import { ITEM_KINDS, type ItemLook } from '../ray/sprites-props.js';
import { createOutput, SCREEN_H, SCREEN_W } from './output.js';
import { viewExtras, type Timed } from './view-extra.js';
import { artOf, defineAsset, isPerson, loadViewAssets, type ViewAssets } from './view-assets.js';
import { GAME_B2_SHOWCASE_LINE } from '../showcase.js';
import { B2World } from './world.js';

const CALL = 'kit.fx.b2View()';

const keySchema = z.strictObject({
  at: whenParam,
  x: z.number(),
  y: z.number(),
  yaw: z
    .number()
    .optional()
    .describe('Heading in degrees: 0 = +x (east), 90 = +y (south); default: the previous key'),
  pitch: z
    .number()
    .min(-60)
    .max(60)
    .optional()
    .describe('Look down (+) / up (-) in pixels; default the previous key, else 0'),
  eye: z
    .number()
    .min(0.15)
    .max(0.85)
    .optional()
    .describe('Eye height (0.5 standing, 0.4 crouching)'),
  ease: z
    .enum(EASE_IDS)
    .default('inOut')
    .describe('Easing into this key: in (start walking), out (stop), inOut, sine, lin, outBack'),
});

export const b2ViewParams = z.object({
  size: z
    .tuple([z.int().min(64).max(3840), z.int().min(36).max(2160)])
    .default([SCREEN_W, SCREEN_H])
    .describe('Pass [ctx.shot.width, ctx.shot.height]'),
  level: z
    .union([
      z.record(z.string(), z.unknown()),
      z.string().refine(isBuiltInLevel, {
        message: `write the film's own level object; the only level names are the showcase pieces ${BUILT_IN_LEVELS.join(', ')}`,
      }),
    ])
    .describe(
      `The film's own level object { name, mood, floor, ceiling, sky, grid, legend, lights, sprites }. ${GAME_B2_SHOWCASE_LINE}`,
    ),
  assets: z
    .union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown())).max(4)])
    .optional()
    .describe(
      "The film's own { sprites, textures, icons } (pixel art or generators, e.g. { gen: 'plant', kind: 'conifer' }); their ids work in the level like built-in names",
    ),
  stencil: z
    .string()
    .min(1)
    .max(5)
    .optional()
    .describe('Showcase levels only: the word stencilled on their signs (a real word of the film)'),
  path: z
    .array(keySchema)
    .min(1)
    .max(64)
    .describe('Camera keys [{ at, x, y, yaw, pitch, eye, ease }] in level cells'),
  bob: z.number().min(0).max(2).default(1).describe('Head-bob strength while walking'),
  duration: z
    .number()
    .min(0.5)
    .max(600)
    .optional()
    .describe('Shot length (ctx.shot.duration): held items stay until then'),
  seed: z.int().min(0).optional(),
  layer: z.int().min(0).max(9).default(0),
  anchor: anchorParam,
});

const itemSchema = z.strictObject({
  icon: z
    .string()
    .optional()
    .describe(
      "An icon id of the film's assets (a ledger, a brick): the usual way to give an item its look",
    ),
  kind: z
    .enum(ITEM_KINDS)
    .optional()
    .describe("Without an icon: 'note' or 'key' ('cartridge' is a showcase piece)"),
  label: z.string().max(5).optional().describe('Word on the item label (real, <= 5 letters)'),
  band: z.string().optional().describe('Label band colour: pink = THE item of the story (default)'),
  dirty: z.boolean().optional(),
});
const timeSchema = z.strictObject({ at: whenParam, until: whenParam.optional() });
const point3 = z.tuple([z.number(), z.number(), z.number()]);

export type B2ViewObject = FxObject & {
  open(
    cell: readonly [number, number],
    options: { at: number | string; dur?: number },
  ): { at: number; end: number };
  switchOn(id: string, options: { at: number | string }): { at: number; end: number };
  act(
    id: string,
    options: { act: 'talk' | 'no'; at: number | string; until: number | string },
  ): { at: number; end: number };
  place(
    sprite: unknown,
    options: { at: number | string; fall?: number },
  ): { at: number; end: number };
  shake(options: { at: number | string; amp?: number }): { at: number; end: number };
  take(
    item: unknown,
    options: {
      at: number | string;
      from: readonly [number, number, number];
      until?: number | string;
    },
  ): { at: number; end: number };
  hold(
    item: unknown,
    options: { at: number | string; until?: number | string },
  ): { at: number; end: number };
  present(options: { at: number | string; until: number | string }): { at: number; end: number };
  defineSprite(id: string, spec: unknown): void;
  defineIcon(id: string, spec: unknown): void;
  cameraAt(t: number): Camera;
  automap(spec: unknown): Timed & { open: number; fold: number; intent: string };
  throw(item: unknown, spec: unknown): Timed & { release: number; land: number; intent: string };
  fog(spec: unknown): Timed;
};

/** The world behind each view object (b2Hud reads the camera, level and walk from it). */
const WORLDS = new WeakMap<object, B2World>();

export function b2WorldOf(view: unknown): B2World | undefined {
  return typeof view === 'object' && view !== null ? WORLDS.get(view) : undefined;
}

function fail(message: string): never {
  throw new KitError('invalid-params', `${CALL}: ${message}`);
}

function parse<S extends z.ZodType>(schema: S, value: unknown, what: string): z.output<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  fail(
    `${what}: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || '(value)'} ${issue.message}`).join('; ')}`,
  );
}

function loadLevel(params: z.output<typeof b2ViewParams>, assets: ViewAssets): Level {
  // A string is a built-in (showcase) level: the params schema refuses any other name.
  const input =
    typeof params.level === 'string' ? builtInLevel(params.level, params.stencil) : params.level;
  const checked = checkLevel(input, assets.known);
  if (!checked.ok) fail(`level is invalid:\n- ${checked.errors.join('\n- ')}`);
  return checked.level;
}

function pathKeys(
  params: z.output<typeof b2ViewParams>,
  level: Level,
  resolve: Resolver,
): PathKey[] {
  let yaw = 0;
  let pitch = 0;
  let eye = 0.5;
  return params.path.map((key, i) => {
    const ch = level.grid[Math.floor(key.y)]?.[Math.floor(key.x)];
    const entry = ch === undefined ? undefined : legendOf(level, ch);
    if (entry === undefined || isWall(entry))
      fail(
        `path[${String(i)}]: [${String(key.x)}, ${String(key.y)}] is ${entry === undefined ? 'outside the grid' : `inside the wall "${ch ?? ''}"`}; keys must stand in open or door cells`,
      );
    yaw = key.yaw ?? yaw;
    pitch = key.pitch ?? pitch;
    eye = key.eye ?? eye;
    return { at: resolve(key.at, 0), x: key.x, y: key.y, yaw, pitch, eye, ease: key.ease };
  });
}

function itemLook(value: unknown, assets: ViewAssets): ItemLook {
  const item = parse(itemSchema, value ?? {}, 'item');
  const band = item.band === undefined ? undefined : colorOfSwatch(item.band);
  if (item.band !== undefined && band === undefined)
    fail(`item.band "${item.band}" is not a game-b2 colour (e.g. pink, clay, dusk)`);
  if (item.icon === undefined && item.kind === undefined)
    fail(
      "item: give it the film's own look, { icon: 'ledger' } (an icon of the assets or view.defineIcon), or kind: 'note' | 'key'",
    );
  const art = item.icon === undefined ? undefined : artOf(assets.set, item.icon);
  if (item.icon !== undefined && art === undefined)
    fail(`item.icon "${item.icon}" is not an icon of the assets (define it in assets.icons)`);
  return { kind: item.kind, label: item.label, band, dirty: item.dirty, art };
}

/** A take (reach and swing back) settles at least this long before the shot ends. */
const TAKE_SETTLE_S = 0.3;

function buildView(params: z.output<typeof b2ViewParams>, tools: KitTools): B2ViewObject {
  const resolve = createResolver(params.anchor, CALL);
  const seed = params.seed ?? Math.floor(tools.rng() * 2_147_483_647) % 100_000;
  const assets = loadViewAssets(params.assets, fail);
  const level = loadLevel(params, assets);
  const compiled: CompiledLevel = compileLevel(level, assets.set);
  const world = new B2World(
    compiled,
    createPath(pathKeys(params, level, resolve), seed),
    seed,
    params.bob,
    assets.set,
  );
  const look = (value: unknown): ItemLook => itemLook(value, assets);
  const forever = params.duration ?? Number.POSITIVE_INFINITY;
  const output = createOutput(tools, params.size, params.layer, 'b2View');
  const screen = new Uint8Array(SCREEN_W * SCREEN_H);
  const time = (when: number | string, what: string): number => {
    const t = resolve(when, 0);
    if (!Number.isFinite(t)) fail(`${what}: time must be finite`);
    return t;
  };
  const api = {
    open(cell: readonly [number, number], options: { at: number | string; dur?: number }) {
      const [x, y] = cell;
      const ch = level.grid[y]?.[x];
      if (ch === undefined || !isDoor(legendOf(level, ch)))
        fail(`open([${String(x)}, ${String(y)}]): that cell is not a door`);
      const at = time(options.at, 'open');
      world.open(x, y, at, options.dur ?? 0.7);
      return { at, end: at + (options.dur ?? 0.7) };
    },
    switchOn(id: string, options: { at: number | string }) {
      if (!level.lights.some((light) => light.id === id))
        fail(`switchOn("${id}"): no light with that id`);
      const at = time(options.at, 'switchOn');
      world.switchOn(id, at);
      return { at, end: at + 0.3 };
    },
    act(id: string, options: { act: 'talk' | 'no'; at: number | string; until: number | string }) {
      if (!level.sprites.some((entry) => entry.id === id && isPerson(assets, entry.sprite)))
        fail(`act("${id}"): no clerk or person sprite with that id`);
      const at = time(options.at, 'act');
      const until = time(options.until, 'act');
      world.act(id, options.act, at, until);
      return { at, end: until };
    },
    place(sprite: unknown, options: { at: number | string; fall?: number }) {
      const spec = parse(levelSchemas(assets.known).sprite, sprite, 'place(sprite)');
      const checked = checkLevel({ ...level, sprites: [...level.sprites, spec] }, assets.known);
      if (!checked.ok) fail(`place(): ${checked.errors.join('; ')}`);
      const at = time(options.at, 'place');
      world.place(compileExtraSprite(compiled, spec, assets.set), at, options.fall ?? 0.25);
      return { at, end: at + 0.22 };
    },
    shake(options: { at: number | string; amp?: number }) {
      const at = time(options.at, 'shake');
      world.shake(at, options.amp ?? 2);
      return { at, end: at + 0.5 };
    },
    take(
      item: unknown,
      options: {
        at: number | string;
        from: readonly [number, number, number];
        until?: number | string;
      },
    ) {
      const timing = parse(timeSchema, { at: options.at, until: options.until }, 'take()');
      const from = parse(point3, options.from, 'take(from)');
      const until = timing.until === undefined ? forever : time(timing.until, 'take');
      const span = world.hand.add({
        kind: 'take',
        at: time(timing.at, 'take'),
        until,
        item: look(item),
        from,
      });
      // Real run Game B2 2: a take that lands after the cut blinks the item out at the seam.
      if (timing.until === undefined && span.end > forever - TAKE_SETTLE_S)
        fail(
          `take(): the hand is still swinging back at the end of the shot (back at ${span.end.toFixed(2)} s, the shot ends at ${forever.toFixed(2)} s); start it by ${(forever - TAKE_SETTLE_S - (span.end - span.at)).toFixed(2)} s so the item is held still when the shot cuts (the next shot may carry it on)`,
        );
      return span;
    },
    hold(item: unknown, options: { at: number | string; until?: number | string }) {
      const until = options.until === undefined ? forever : time(options.until, 'hold');
      return world.hand.add({
        kind: 'hold',
        at: time(options.at, 'hold'),
        until,
        item: look(item),
      });
    },
    present(options: { at: number | string; until: number | string }) {
      return world.hand.add({
        kind: 'present',
        at: time(options.at, 'present'),
        until: time(options.until, 'present'),
      });
    },
    defineSprite(id: string, spec: unknown) {
      defineAsset(assets, 'sprites', id, spec, fail);
    },
    defineIcon(id: string, spec: unknown) {
      defineAsset(assets, 'icons', id, spec, fail);
    },
    cameraAt: (t: number) => world.camera(t),
    ...viewExtras({
      world,
      compiled,
      seed,
      duration: params.duration,
      time,
      fail,
      parse,
      itemLook: look,
    }),
  };
  const fx = asFx(output.object, (t) => {
    world.render(t, screen);
    output.present(screen);
  });
  const built = Object.assign(fx, api);
  WORLDS.set(built, world);
  return built;
}

export const b2View = defineFx({
  name: 'b2View',
  description:
    'Game B2 world (first-person RPG, Doom vibe): a software-raycast level (textured walls, doors, shelves, props and NPC sprites, tungsten / fluorescent light and fog) seen through a scripted walk with head-bob, plus the first-person hand. Full-frame 2D raster: build once, call update(t) every frame; put kit.fx.b2Hud({ view }) on top.',
  params: b2ViewParams,
  methods: {
    'update(t)': 'Repaints the view for local time t: call it every frame',
    'open([x, y], { at, dur })': 'Slides a door cell open (dur default 0.7 s)',
    'switchOn(lightId, { at })': 'The light (off until then) clicks on with two uneven stutters',
    "act(personId, { act: 'talk' | 'no', at, until })":
      "A person sprite of the level (the person generator's or the film's own) talks (mouth flaps at an uneven cadence) or shakes its head",
    'place(sprite, { at, fall })':
      'A sprite ({ sprite, pos, z, label, ... }) drops in at `at` with an overshoot (a thing set down on a table)',
    'shake({ at, amp })': 'Screen shake with decay (a thump)',
    'take(item, { at, from: [x, y, z], until })':
      "The hand reaches for a world point, closes on the item ({ icon: an icon of the film's assets } or { kind: 'note' | 'key', label, band, dirty }) and swings back holding it",
    'hold(item, { at, until })': 'The hand rises holding an item and lowers at until',
    'present({ at, until })':
      'The held item is pushed forward at someone (dip, overshoot, hold, ease back)',
    'defineSprite(id, spec)':
      "Defines one more project sprite after build (pixel art { rows, legend } or { gen: 'creature', ... }) for place()",
    'defineIcon(id, spec)':
      "Defines an item icon ({ gen: 'icon', kind: 'book' } or 12x12 rows) for take/hold/throw ({ icon: id }) and the HUD inventory",
    'cameraAt(t)': 'The camera { x, y, yaw, pitch, eye } at t',
    'automap({ intent, at, until, enter, exit, scale, backdrop, rooms, replay, marks, note, camera, legend })':
      "Breakthrough: the level from above, generated from its grid (walls, doors, walked / next / ahead rooms, footprints, the arrow). Unfolds out of the HUD minimap and folds back (continuity); the rooms span >= half the frame (scale up to 24); backdrop: 'freeze' holds the level dimmed behind it (a map held to the shot's end needs it or exit 'fold'). Returns { at, end, open, fold, cues }",
    'throw(item, { intent, at, to: [x, y] | target: spriteId, z, arc, dur, windup, stay, shake })':
      'The held item is thrown (dip, swing, release at `at`) along an arc; it tumbles, lands with dust; the target sprite flinches. Returns { at, release, land, end, cues }',
    'fog({ at, until, amount })': 'A fog bank rolls in and clears: time passes between two beats',
  },
  build: buildView,
});
