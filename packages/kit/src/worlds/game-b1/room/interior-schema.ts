/**
 * The room DSL (PLAN.md#13.15): the room around the TV is not always the 1982 living room. A
 * shell (living room, bedroom, arcade, office, classroom, garage, workshop) gives the wall, the
 * floor and default furniture; props are generic and parametric (a window with its own view, a
 * shelf of whatever the film needs, a poster showing one of the film's sprites, a blackboard with
 * the narration's words, ...). The TV cabinet, the console and the joystick stay where they are:
 * they are the world's identity and the camera's anchors.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';

export const SHELLS = [
  'living-room',
  'bedroom',
  'arcade',
  'office',
  'classroom',
  'garage',
  'workshop',
] as const;
export const WALLS = ['panelling', 'wallpaper', 'paint', 'brick', 'concrete', 'tiles'] as const;
export const FLOORS = ['shag', 'carpet', 'boards', 'checker', 'concrete'] as const;
export const SKIES = ['day', 'dusk', 'night'] as const;
export const VIEWS_OUT = [
  'none',
  'trees',
  'city',
  'sea',
  'hills',
  'desert',
  'snow',
  'stars',
] as const;
export const SHELF_ITEMS = [
  'cartridges',
  'books',
  'boxes',
  'papers',
  'tools',
  'jars',
  'trophies',
  'records',
] as const;

const ink = z.string().min(1).max(16);
/** Room units: the room is 320 x 180, the TV cabinet stands at x 22-146, the floor starts at 123. */
const x = z.number().min(-20).max(330);
const y = z.number().min(-10).max(180);

export const propSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('window'), x, y: y.default(18), w: z.number().min(16).max(90).default(44), h: z.number().min(16).max(80).default(46), sky: z.enum(SKIES).default('day'), view: z.enum(VIEWS_OUT).default('none') }),
  z.strictObject({ kind: z.literal('poster'), x, y: y.default(22), w: z.number().min(14).max(70).default(26), h: z.number().min(16).max(80).default(34), sprite: z.string().min(1).max(32).optional().describe('A sprite id of the film, printed big'), colour: ink.default('teal'), frame: z.enum(['poster', 'frame']).default('poster') }),
  z.strictObject({ kind: z.literal('shelf'), x, y: y.default(40), w: z.number().min(16).max(90).default(40), rows: z.int().min(1).max(3).default(2), items: z.enum(SHELF_ITEMS).default('books') }),
  z.strictObject({ kind: z.literal('clock'), x, y: y.default(14), time: z.string().regex(/^\d{1,2}:\d{2}$/).default('10:10') }),
  z.strictObject({ kind: z.literal('blackboard'), x, y: y.default(14), w: z.number().min(30).max(140).default(90), h: z.number().min(20).max(70).default(46), lines: z.array(z.string().min(1).max(14)).max(3).default([]).describe('Chalk words from the narration') }),
  z.strictObject({ kind: z.literal('pegboard'), x, y: y.default(30), w: z.number().min(20).max(100).default(50), h: z.number().min(16).max(60).default(36) }),
  z.strictObject({ kind: z.literal('plant'), x, size: z.enum(['small', 'tall']).default('tall'), pot: ink.default('rust') }),
  z.strictObject({ kind: z.literal('lamp'), x, type: z.enum(['floor', 'desk']).default('floor'), on: z.boolean().default(true) }),
  z.strictObject({ kind: z.literal('rug'), x, w: z.number().min(20).max(160).default(70), colour: ink.default('rust') }),
  z.strictObject({ kind: z.literal('desk'), x, w: z.number().min(30).max(90).default(56), on: z.enum(['none', 'papers', 'typewriter', 'computer', 'phone']).default('papers') }),
  z.strictObject({ kind: z.literal('bed'), x, colour: ink.default('blue') }),
  z.strictObject({ kind: z.literal('sofa'), x, colour: ink.default('orange') }),
  z.strictObject({ kind: z.literal('cabinet'), x, type: z.enum(['filing', 'arcade', 'locker']).default('filing'), colour: ink.optional() }),
  z.strictObject({ kind: z.literal('workbench'), x, w: z.number().min(30).max(100).default(60) }),
  z.strictObject({ kind: z.literal('boxes'), x, count: z.int().min(1).max(6).default(3) }),
  z.strictObject({ kind: z.literal('instrument'), x, type: z.enum(['guitar', 'drum']).default('guitar') }),
]); // prettier-ignore

export type RoomProp = z.output<typeof propSchema>;

export const interiorSchema = z.strictObject({
  shell: z.enum(SHELLS).default('living-room'),
  wall: z.enum(WALLS).optional().describe("Overrides the shell's wall"),
  wallColours: z.array(ink).min(1).max(3).optional(),
  floor: z.enum(FLOORS).optional(),
  floorColours: z.array(ink).min(1).max(2).optional(),
  light: z.enum(['day', 'evening', 'night']).default('evening'),
  calendar: z
    .union([
      z.literal(false),
      z.strictObject({
        month: z.string().min(1).max(9).default('DEC'),
        year: z.int().min(1000).max(2999).optional().describe('Printed under the month'),
        mark: z.int().min(0).max(28).default(0),
        markAt: z.tuple([whenParam, whenParam]).optional(),
      }),
    ])
    .default(false),
  defaults: z.boolean().default(true).describe("false = only your props, not the shell's"),
  props: z.array(propSchema).max(12).default([]),
  carts: z.int().min(0).max(4).default(0).describe('Loose cartridges by the console'),
});

export type InteriorSpec = z.input<typeof interiorSchema>;
export type Interior = z.output<typeof interiorSchema>;
