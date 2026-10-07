/**
 * The room DSL's painter (PLAN.md#13.15): a shell's wall, floor and light, the wall props, the
 * wall calendar (at the living room's place, so the calendar zoom still lands; the year is a
 * parameter), the floor props, then the world's identity exactly as in the living room: the TV
 * cabinet with the picture in its glass, the console, the joystick and its cable.
 */
import { z } from 'zod';
import { joy, joyWidth } from '../core/fonts.js';
import { seg } from '../core/math.js';
import { C } from '../palette.js';
import { colourProblem } from '../vocab/colours.js';
import type { B1Sprite } from '../vocab/sprite.js';
import {
  bedProp,
  boxesProp,
  cabinetProp,
  deskProp,
  instrumentProp,
  lampProp,
  plantProp,
  rugProp,
  sofaProp,
  workbenchProp,
} from './furniture-floor.js';
import {
  blackboardProp,
  clockProp,
  ink,
  pegboardProp,
  posterProp,
  shelfProp,
  windowProp,
} from './furniture-wall.js';
import { propSchema, type Interior, type RoomProp } from './interior-schema.js';
import { console2600, joystick, tvCabinet, type GlassRect } from './living-room.js';
import { calendar, looseCarts } from './props.js';
import { drawFloor, drawLight, drawWall, type FloorKind, type WallKind } from './surfaces.js';
import type { RoomPen } from './view.js';

interface ShellDefaults {
  readonly wall: WallKind;
  readonly wallColours: readonly string[];
  readonly floor: FloorKind;
  readonly floorColours: readonly string[];
  readonly props: readonly z.input<typeof propSchema>[];
}

/** Wall props stay right of x 206 so the calendar (166-200) keeps its place. */
export const SHELL_DEFAULTS: Record<Interior['shell'], ShellDefaults> = {
  'living-room': { wall: 'panelling', wallColours: [], floor: 'shag', floorColours: [], props: [{ kind: 'shelf', x: 214, y: 44, w: 46, items: 'books' }, { kind: 'plant', x: 290 }] },
  bedroom: { wall: 'wallpaper', wallColours: ['dusk', 'mauve', 'tan'], floor: 'carpet', floorColours: ['blue', 'night'], props: [{ kind: 'window', x: 214, sky: 'night', view: 'stars' }, { kind: 'poster', x: 274, y: 24 }, { kind: 'bed', x: 226 }] },
  arcade: { wall: 'paint', wallColours: ['night', 'tube'], floor: 'checker', floorColours: ['night', 'dusk'], props: [{ kind: 'cabinet', x: 214, type: 'arcade' }, { kind: 'cabinet', x: 248, type: 'arcade', colour: 'teal' }, { kind: 'cabinet', x: 282, type: 'arcade', colour: 'rust' }] },
  office: { wall: 'paint', wallColours: ['greyDark', 'grey'], floor: 'carpet', floorColours: ['greyDark', 'tube'], props: [{ kind: 'window', x: 212, sky: 'day', view: 'city' }, { kind: 'clock', x: 296, y: 14 }, { kind: 'desk', x: 214, on: 'typewriter' }, { kind: 'cabinet', x: 288, type: 'filing' }] },
  classroom: { wall: 'paint', wallColours: ['cream', 'teal'], floor: 'boards', floorColours: ['teak', 'walnut'], props: [{ kind: 'blackboard', x: 210, y: 14, w: 92 }, { kind: 'desk', x: 226, w: 50, on: 'none' }] },
  garage: { wall: 'concrete', wallColours: ['greyDark', 'grey'], floor: 'concrete', floorColours: ['grey', 'greyDark'], props: [{ kind: 'pegboard', x: 212, y: 26, w: 60 }, { kind: 'workbench', x: 210, w: 66 }, { kind: 'boxes', x: 286, count: 4 }] },
  workshop: { wall: 'brick', wallColours: ['rust', 'walnut'], floor: 'boards', floorColours: ['teak', 'walnut'], props: [{ kind: 'shelf', x: 214, y: 24, w: 52, items: 'jars' }, { kind: 'workbench', x: 210, w: 62 }, { kind: 'instrument', x: 290, type: 'guitar' }] },
}; // prettier-ignore

export interface InteriorPlan {
  readonly wall: WallKind;
  readonly wallInks: readonly number[];
  readonly floor: FloorKind;
  readonly floorInks: readonly number[];
  readonly light: Interior['light'];
  readonly calendar:
    | { month: string; year: number | undefined; mark: number; ring: readonly [number, number] }
    | undefined;
  readonly props: readonly RoomProp[];
  readonly carts: number;
  readonly seed: number;
}

/** Every colour the interior names that is not an ink, and every sprite a poster names that is unknown. */
export function interiorProblems(o: Interior, hasSprite: (id: string) => boolean): string[] {
  const names = [...(o.wallColours ?? []), ...(o.floorColours ?? [])];
  for (const prop of o.props) {
    if ('colour' in prop && prop.colour !== undefined) names.push(prop.colour);
    if (prop.kind === 'plant') names.push(prop.pot);
  }
  const problems = names.flatMap((name) => colourProblem(name) ?? []);
  for (const prop of o.props)
    if (prop.kind === 'poster' && prop.sprite !== undefined && !hasSprite(prop.sprite))
      problems.push(`poster sprite "${prop.sprite}" is not defined (define it before interior())`);
  return problems;
}

export function planInterior(
  o: Interior,
  seed: number,
  ring: readonly [number, number],
  monthText: string,
): InteriorPlan {
  const shell = SHELL_DEFAULTS[o.shell];
  const props = [...(o.defaults ? z.array(propSchema).parse(shell.props) : []), ...o.props];
  return {
    wall: o.wall ?? shell.wall,
    wallInks: (o.wallColours ?? shell.wallColours).map(ink),
    floor: o.floor ?? shell.floor,
    floorInks: (o.floorColours ?? shell.floorColours).map(ink),
    light: o.light,
    calendar:
      o.calendar === false
        ? undefined
        : { month: monthText, year: o.calendar.year, mark: o.calendar.mark, ring },
    props,
    carts: o.carts,
    seed,
  };
}

const WALL_KINDS: readonly RoomProp['kind'][] = [
  'window',
  'poster',
  'shelf',
  'clock',
  'blackboard',
  'pegboard',
];

function drawProp(p: RoomPen, prop: RoomProp, t: number, seed: number, sprite: (id: string) => B1Sprite | undefined): void {
  switch (prop.kind) {
    case 'window': { windowProp(p, prop, t, seed); return; }
    case 'poster': { posterProp(p, prop, prop.sprite === undefined ? undefined : sprite(prop.sprite)); return; }
    case 'shelf': { shelfProp(p, prop, seed); return; }
    case 'clock': { clockProp(p, prop); return; }
    case 'blackboard': { blackboardProp(p, prop, seed); return; }
    case 'pegboard': { pegboardProp(p, prop, seed); return; }
    case 'plant': { plantProp(p, prop, seed); return; }
    case 'lamp': { lampProp(p, prop); return; }
    case 'rug': { rugProp(p, prop); return; }
    case 'desk': { deskProp(p, prop, t, seed); return; }
    case 'bed': { bedProp(p, prop); return; }
    case 'sofa': { sofaProp(p, prop); return; }
    case 'cabinet': { cabinetProp(p, prop, t, seed); return; }
    case 'workbench': { workbenchProp(p, prop, seed); return; }
    case 'boxes': { boxesProp(p, prop, seed); return; }
    case 'instrument': { instrumentProp(p, prop); return; }
  }
} // prettier-ignore

export function drawInterior(
  p: RoomPen,
  t: number,
  plan: InteriorPlan,
  sprite: (id: string) => B1Sprite | undefined,
  glass: (rect: GlassRect) => void,
): void {
  drawWall(p, plan.wall, plan.wallInks, plan.seed);
  drawFloor(p, plan.floor, plan.floorInks, plan.seed);
  drawLight(p, plan.light);
  const wallProps = plan.props.filter((prop) => WALL_KINDS.includes(prop.kind));
  const floorProps = plan.props.filter((prop) => !WALL_KINDS.includes(prop.kind));
  wallProps.forEach((prop, i) => {
    drawProp(p, prop, t, plan.seed + i * 17, sprite);
  });
  const cal = plan.calendar;
  if (cal !== undefined) {
    calendar(p, 166, 22, {
      month: cal.month,
      mark: cal.mark,
      ring: seg(t, cal.ring[0], cal.ring[1]),
    });
    if (cal.year !== undefined) {
      const scale = Math.max(1, Math.round(p.s / 2));
      const text = String(cal.year);
      joy(p.cv, text, p.X(166 + 31) - joyWidth(text, scale), p.Y(22 + 21), scale, C.WALNUT);
    }
  }
  [
    ...floorProps.filter((prop) => prop.kind === 'rug'),
    ...floorProps.filter((prop) => prop.kind !== 'rug'),
  ].forEach((prop, i) => {
    drawProp(p, prop, t, plan.seed + 300 + i * 17, sprite);
  });
  tvCabinet(p, glass);
  console2600(p, 48, 136);
  joystick(p);
  if (plan.carts > 0) looseCarts(p, plan.carts, plan.seed);
}
