/**
 * The level-select map (`screen.levelSelect(spec)`, the showcase's trans.js map): the story's
 * places as nodes of a 2600 world map (a plain icon or one of the film's own sprites: `sprite`)
 * joined by hand-placed dotted paths, a cartridge as the
 * cursor hopping from node to node in uneven hops (lift, squash on take-off and landing, a breath
 * at a node it passes), the chosen place blinking gold when it lands. Places the story has not
 * reached are locked '?' nodes (the same lock as the high-score table's ??? rows). For a change
 * of PLACE or TIME. In TV units (160 x 180, a unit = 4 x 2 px), drawn as a picture overlay.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import type { IndexCanvas } from '../core/canvas.js';
import { joy, joyWidth, missingGlyphs } from '../core/fonts.js';
import { EASES, hash, sid } from '../core/math.js';
import { C, colorOfSwatch } from '../palette.js';
import type { B1Sprite } from '../vocab/sprite.js';

const ICONS = {
  home: {
    rows: [
      '...##...',
      '..####..',
      '.######.',
      '########',
      '.#....#.',
      '.#.##.#.',
      '.#.##.#.',
      '.######.',
    ],
    cols: [C.RUST, C.RUST, C.RUST, C.RUST, C.TAN, C.GOLD, C.GOLD, C.TAN],
  },
  store: {
    rows: ['########', '#.#.#.#.', '########', '.#....#.', '.#.##.#.', '.#.##.#.', '.######.'],
    cols: [C.TEAL, C.CREAM, C.TEAL, C.TAN, C.GOLD, C.GOLD, C.TAN],
  },
  pit: {
    rows: ['..####..', '.######.', '########', '##....##', '###..###', '########'],
    cols: [C.DUSK, C.DUSK, C.TEAK, C.TEAK, C.WALNUT, C.WALNUT],
  },
  office: {
    rows: ['.######.', '.#.#.#..', '.######.', '.#.#.#..', '.######.', '.#.#.#..', '########'],
    cols: [C.GREY, C.AQUA, C.GREY, C.AQUA, C.GREY, C.AQUA, C.GREY_D],
  },
  factory: {
    rows: ['#.......', '#.......', '#..#..#.', '##.##.##', '########', '#.##.#.#', '########'],
    cols: [C.GREY_D, C.GREY_D, C.RUST, C.RUST, C.RUST, C.GOLD, C.RUST],
  },
  lock: {
    rows: ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..'],
    cols: [C.GREY_D, C.GREY_D, C.GREY_D, C.GREY_D, C.GREY_D, C.GREY_D, C.GREY_D],
  },
} as const;
export const ICON_NAMES = Object.keys(ICONS) as (keyof typeof ICONS)[];
type Icon = keyof typeof ICONS;

const CART = ['.####.', '######', '#....#', '#....#', '#....#', '#....#', '######'];

export const levelSelectSchema = z.strictObject({
  intent: z.string().min(12).max(160).describe('Why the story changes place / time here'),
  at: whenParam,
  until: whenParam,
  nodes: z
    .array(
      z.strictObject({
        label: z.string().max(14).default('').describe('Place (and year) in narration words'),
        icon: z
          .enum(ICON_NAMES as [Icon, ...Icon[]])
          .optional()
          .describe("A plain icon (or give sprite); lock = not reached yet ('?')"),
        sprite: z
          .string()
          .min(1)
          .max(32)
          .optional()
          .describe("A sprite id of the film (its assets or defineSprite) as the place's icon"),
        x: z.number().min(10).max(150).describe('TV units (160 wide)'),
        y: z.number().min(46).max(144).describe('TV units (180 high)'),
        above: z.boolean().default(false).describe('Label above the icon'),
      }),
    )
    .min(2)
    .max(6)
    .describe('The places in story order; paths join them in this order'),
  route: z.strictObject({
    from: z.int().min(0).max(5),
    to: z.int().min(0).max(5),
    at: whenParam.describe('The cursor sets off'),
    dur: z.number().min(0.4).max(4).default(1.1),
  }),
});

export type LevelSelectInput = z.input<typeof levelSelectSchema>;
type Spec = z.output<typeof levelSelectSchema>;

/** A node's picture: a plain icon or one of the film's sprites. */
type Mark =
  | { readonly kind: 'icon'; readonly icon: Icon }
  | { readonly kind: 'sprite'; readonly sprite: B1Sprite };

interface Node {
  readonly label: string;
  readonly mark: Mark;
  readonly x: number;
  readonly y: number;
  readonly above: boolean;
}

export interface SelectPlan {
  readonly intent: string;
  readonly at: number;
  readonly until: number;
  readonly nodes: readonly Node[];
  readonly legs: readonly (readonly (readonly [number, number])[])[];
  readonly route: {
    readonly from: number;
    readonly to: number;
    readonly at: number;
    readonly dur: number;
  };
  readonly path: readonly (readonly [number, number])[];
  readonly hops: readonly { readonly len: number; readonly dur: number }[];
  readonly seed: number;
}

const CALL = 'kit.fx.b1Screen().levelSelect()';

function fail(message: string): never {
  throw new KitError('invalid-params', `${CALL}: ${message}`);
}

/** A leg between two nodes: dense points along a hand-placed bend (seeded waypoints). */
function leg(a: Node, b: Node, seed: number, i: number): [number, number][] {
  const way: [number, number][] = [[a.x, a.y]];
  const nx = -(b.y - a.y);
  const ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  for (let k = 1; k <= 3; k += 1) {
    const off = (hash(seed, i, k) - 0.5) * 12;
    way.push([
      a.x + ((b.x - a.x) * k) / 4 + (nx / len) * off,
      a.y + ((b.y - a.y) * k) / 4 + (ny / len) * off * 0.6,
    ]);
  }
  way.push([b.x, b.y]);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < way.length; k += 1) {
    const p = way[k] ?? ([0, 0] as const);
    const q = way[k + 1] ?? p;
    const n = Math.max(1, Math.round(Math.hypot((q[0] - p[0]) * 2, q[1] - p[1]) / 2));
    for (let s = 0; s < n; s += 1)
      out.push([p[0] + ((q[0] - p[0]) * s) / n, p[1] + ((q[1] - p[1]) * s) / n]);
  }
  out.push([b.x, b.y]);
  return out;
}

function nodeMark(node: Spec['nodes'][number], i: number, sprite: (id: string) => B1Sprite): Mark {
  if (node.icon !== undefined && node.sprite !== undefined)
    fail(`nodes[${String(i)}]: give icon OR sprite, not both`);
  if (node.sprite !== undefined) return { kind: 'sprite', sprite: sprite(node.sprite) };
  if (node.icon === undefined)
    fail(`nodes[${String(i)}]: give sprite (one of the film's sprite ids) or icon`);
  return { kind: 'icon', icon: node.icon };
}

const isLock = (mark: Mark): boolean => mark.kind === 'icon' && mark.icon === 'lock';

export function planLevelSelect(
  spec: Spec,
  at: (when: number | string) => number,
  sprite: (id: string) => B1Sprite,
): SelectPlan {
  const start = at(spec.at);
  const until = at(spec.until);
  if (until <= start) fail('until must come after at');
  const seed = Math.abs(sid(spec.intent)) % 100_000;
  const nodes = spec.nodes.map((node, i): Node => {
    const label = node.label.toUpperCase();
    const missing = missingGlyphs(label, 'joy');
    if (missing.length > 0)
      fail(`nodes[${String(i)}].label "${node.label}": cannot draw ${missing.join(' ')}`);
    const mark = nodeMark(node, i, sprite);
    if (isLock(mark) && label !== '' && label !== '?')
      fail(`nodes[${String(i)}] is locked: a locked place has no name yet (label '')`);
    if (!isLock(mark) && label === '') fail(`nodes[${String(i)}]: give the place its label`);
    if (joyWidth(label, 2) > 300) fail(`nodes[${String(i)}].label "${label}" is too long`);
    return { label, mark, x: node.x, y: node.y, above: node.above };
  });
  const { from, to } = spec.route;
  if (from >= nodes.length || to >= nodes.length) fail(`route: only ${String(nodes.length)} nodes`);
  if (from === to) fail('route: from and to are the same node');
  const target = nodes[to];
  if (target !== undefined && isLock(target.mark))
    fail('route.to is locked: the cursor cannot land on a ? node');
  const legs = nodes.slice(1).map((b, i) => leg(nodes[i] ?? b, b, seed, i));
  const path: [number, number][] = [];
  const step = to > from ? 1 : -1;
  for (let i = from; i !== to; i += step) {
    const points = [...(legs[Math.min(i, i + step)] ?? [])];
    if (step < 0) points.reverse();
    if (path.length > 0) points.shift();
    path.push(...points);
  }
  const count = Math.max(3, Math.min(9, Math.round(path.length / 9)));
  const hops = Array.from({ length: count }, (_, i) => ({
    len: 0.7 + hash(seed, i, 1) * 0.6,
    dur:
      0.75 +
      hash(seed, i, 2) * 0.5 +
      (i === Math.floor(count / 2) && Math.abs(to - from) > 1 ? 1.1 : 0),
  }));
  const route = { from, to, at: at(spec.route.at), dur: spec.route.dur };
  if (route.at < start || route.at + route.dur > until)
    fail('route: the cursor must set off and land between at and until');
  return { intent: spec.intent, at: start, until, nodes, legs, route, path, hops, seed };
}

/** The cursor at t: position (TV units), lift and squash. */
function cursorAt(plan: SelectPlan, t: number) {
  const { path, hops, route } = plan;
  const first = path[0] ?? [0, 0];
  const total = hops.reduce((s, h) => s + h.len, 0);
  const time = hops.reduce((s, h) => s + h.dur, 0);
  let tt = ((t - route.at) / route.dur) * time;
  if (tt <= 0) return { p: first, lift: 0, squash: 1 };
  let acc = 0;
  for (const [i, hop] of hops.entries()) {
    if (tt < hop.dur || i === hops.length - 1) {
      const f = Math.min(1, tt / hop.dur);
      const a = acc / total;
      const b = (acc + hop.len) / total;
      const pos = a + (b - a) * EASES.inOut(Math.min(1, f / 0.8));
      const point = path[Math.min(path.length - 1, Math.round(pos * (path.length - 1)))] ?? first;
      const lift = f < 0.8 ? Math.sin(Math.PI * Math.min(1, f / 0.8)) * (4 + hop.len * 3) : 0;
      const squash = f < 0.08 ? 0.72 : f > 0.8 && f < 0.92 ? 0.75 : 1;
      return { p: point, lift, squash };
    }
    tt -= hop.dur;
    acc += hop.len;
  }
  return { p: path[path.length - 1] ?? first, lift: 0, squash: 1 };
}

/** Bit rows at TV units (4 x 2 px), one colour per row. */
function sprite(
  cv: IndexCanvas,
  rows: readonly string[],
  cols: readonly number[],
  x: number,
  y: number,
  rowH = 2,
) {
  rows.forEach((row, r) => {
    for (let k = 0; k < row.length; k += 1)
      if (row[k] === '#') cv.rect((x + k) * 4, (y + r * rowH) * 2, 4, rowH * 2, cols[r] ?? C.GREY);
  });
}

/** Rows of a film sprite on the map: one TV line per row step, <= 28 lines tall (frame 0). */
function spriteMark(cv: IndexCanvas, s: B1Sprite, x: number, bottom: number): number {
  const rows = s.frames[0] ?? [];
  const lineH = Math.max(1, Math.min(s.rowH, Math.floor(28 / rows.length)));
  const top = bottom - rows.length * lineH;
  const cols = rows.map((_, r) => colorOfSwatch(s.colours[r] ?? '') ?? -1);
  rows.forEach((row, r) => {
    const ink = cols[r] ?? -1;
    if (ink < 0) return;
    for (let k = 0; k < row.length; k += 1)
      if (row[k] === '#')
        cv.rect((x - s.width / 2 + k) * 4, (top + r * lineH) * 2, 4, lineH * 2, ink);
  });
  return top;
}

/** A node's icon or sprite standing on its place; returns its top (TV units). */
function drawMark(cv: IndexCanvas, node: Node): number {
  if (node.mark.kind === 'sprite') return spriteMark(cv, node.mark.sprite, node.x, node.y - 3);
  const icon = ICONS[node.mark.icon];
  const w = icon.rows[0].length;
  const top = node.y - icon.rows.length * 2 - 3;
  sprite(cv, icon.rows, icon.cols, node.x - w / 2, top);
  return top;
}

function drawCursor(cv: IndexCanvas, x: number, y: number, squash: number): void {
  if (squash < 1) {
    const shown = Math.max(1, Math.round(CART.length * squash));
    const rows = Array.from(
      { length: shown },
      (_, i) => CART[Math.floor((i / shown) * CART.length)] ?? '',
    );
    sprite(
      cv,
      rows,
      rows.map(() => C.GREY),
      x,
      y + (CART.length - shown),
      1,
    );
    return;
  }
  sprite(
    cv,
    CART,
    CART.map(() => C.GREY),
    x,
    y,
    1,
  );
  cv.rect((x + 1) * 4, (y + 2) * 2, 16, 2, C.CREAM);
  cv.rect((x + 1) * 4, (y + 3) * 2, 16, 4, C.ORANGE);
  cv.rect((x + 1) * 4, (y + 5) * 2, 16, 2, C.CREAM);
}

/** The map on the TV picture (an overlay over what the painters drew). */
export function drawLevelSelect(cv: IndexCanvas, plan: SelectPlan, t: number): void {
  if (t < plan.at || t >= plan.until) return;
  const u = t - plan.at;
  const { route } = plan;
  cv.rect(0, 0, cv.w, 300, C.TUBE);
  cv.rect(0, 300, cv.w, 32, C.NIGHT);
  cv.rect(0, 332, cv.w, cv.h - 332, C.TUBE);
  for (let b = 0; b < 40; b += 1) {
    const h = 2 + Math.floor(hash(77, b, 1) * 5);
    cv.rect(b * 16, (150 - h) * 2, 16, h * 2, C.NIGHT);
  }
  const [lo, hi] = [Math.min(route.from, route.to), Math.max(route.from, route.to)];
  plan.legs.forEach((points, li) => {
    for (let i = 1; i < points.length - 1; i += 1) {
      if (hash(31 + plan.seed, li, i) < 0.42) continue;
      const [px = 0, py = 0] = points[i] ?? [];
      const jx = Math.round((hash(32, li, i) - 0.5) * 1.2);
      cv.rect((px + jx) * 4, py * 2, 4, 4, li >= lo && li < hi ? C.TAN : C.TEAK);
    }
  });
  const arrive = route.at + route.dur;
  plan.nodes.forEach((node, i) => {
    const pop = i === route.from ? 0 : 0.06 + hash(41 + plan.seed, i, 1) * 0.16;
    if (u < pop) return;
    const top = drawMark(cv, node);
    if (isLock(node.mark)) return;
    const since = t - arrive;
    const chosen = i === route.to && since > 0;
    const off = chosen && ((since > 0.07 && since < 0.14) || (since > 0.26 && since < 0.31));
    const colour = chosen ? (off ? C.TEAK : C.GOLD) : i === route.to ? C.CREAM : C.TAN;
    const lw = joyWidth(node.label, 2);
    const lx = Math.min(600 - lw, Math.max(40, node.x * 4 - lw / 2));
    const ly = node.above ? top * 2 - 18 : node.y * 2 + 6;
    joy(cv, node.label, lx, ly, 2, colour);
  });
  const cur = cursorAt(plan, t);
  const [px, py] = cur.p;
  cv.rect((px - 2) * 4, (py - 1) * 2, 16, 2, C.VOID);
  drawCursor(cv, Math.round(px - 3), Math.round(py - 16 - cur.lift), cur.squash);
}

export function levelSelectCues(plan: SelectPlan): { t: number; name: string }[] {
  const time = plan.hops.reduce((s, h) => s + h.dur, 0);
  let acc = 0;
  const out = plan.hops.map((hop) => {
    acc += hop.dur;
    return { t: plan.route.at + ((acc - hop.dur * 0.2) / time) * plan.route.dur, name: 'blip' };
  });
  out.push({ t: plan.route.at + plan.route.dur, name: 'success' });
  return out;
}
