/**
 * Grim Ink props (PLAN.md#14.20): the registry of `env.ink.props.*` (and `ink.props.*` in people /
 * places modules) — one checked entry per thing with its doc line, its options line and what it
 * returns, read by the kit-docs topic `ink-props`. The drawing lives in props-door.ts,
 * props-structure.ts, props-furniture.ts, props-light.ts, props-goods.ts, props-paper.ts,
 * props-table.ts, props-gear.ts and props-vehicles.ts.
 */
import { checkedDraws } from './common.js';
import { doorSchema, drawDoor, drawWindow, windowSchema } from './props-door.js';
import { drawSeat, drawTable, seatSchema, tableSchema } from './props-furniture.js';
import { boatSchema, cartSchema, drawBoat, drawCart } from './props-vehicles.js';
import { coinsSchema, containerSchema, drawCoins, drawContainer } from './props-goods.js';
import { drawPaper, paperSchema } from './props-paper.js';
import { drawTool, drawWeapon, toolSchema, weaponSchema } from './props-gear.js';
import { bannerSchema, drawBanner, drawLamp, lampSchema } from './props-light.js';
import {
  archSchema,
  bellSchema,
  boardSchema,
  columnSchema,
  drawArch,
  drawBell,
  drawBoard,
  drawColumn,
  drawLadder,
  drawPanel,
  ladderSchema,
  panelSchema,
} from './props-structure.js';
import { PROPS_TABLE } from './props-table.js';

const PARAMS_PLACE = 'tone (material or palette token), wear 0-1, seed';

/** Every prop with its docs, options schema and drawing. */
export const PROPS_ITEMS = {
  door: {
    doc: 'a doorway with its leaf: planks, panels, iron bands or a cloth; swings open, gets barred, planked or broken',
    params: `x, y = threshold centre; w = 220, h = 340; kind plank|arch|panel|iron|curtain; state shut|open|ajar|barred|planked|broken; swing 0-1 (animate open); shake px; frame (tone); ${PARAMS_PLACE}`,
    returns: 'points handle, opening, top, threshold; label = a sign above',
    schema: doorSchema,
    draw: drawDoor,
  },
  windowFrame: {
    doc: 'a window: glass with the sky or a lit room behind, mullions, bars, a porthole bezel, a paper screen or shutters',
    params: `x, y = centre; w = 260, h = 300; kind square|arched|barred|porthole|screen|shuttered; state day|dusk|night|lit|broken; view(box) draws what is outside (clipped); ${PARAMS_PLACE}`,
    returns: 'points centre, sill; light when lit',
    schema: windowSchema,
    draw: drawWindow,
  },
  arch: {
    doc: 'a stone (or brick, timber) arch on its jambs, voussoir joints',
    params: `x, y = floor centre; w = span 420, h = 520, thick = 60; state whole|cracked; ${PARAMS_PLACE}`,
    returns: 'points top, left, right (springing points)',
    schema: archSchema,
    draw: drawArch,
  },
  column: {
    doc: 'a column or post: round with flutes, square, timber, riveted iron; broken leaves a jagged stump',
    params: `x, y = foot; h = 600, w = 90; kind round|square|timber|iron; state whole|broken; ${PARAMS_PLACE}`,
    returns: 'points top, base',
    schema: columnSchema,
    draw: drawColumn,
  },
  ladder: {
    doc: 'a ladder between two world points (rails and rungs): lean it on a wall, a palm grips a rung',
    params: `x0, y0 = foot, x1, y1 = top; width = 68; ${PARAMS_PLACE}`,
    returns: 'points foot, top, mid',
    schema: ladderSchema,
    draw: drawLadder,
  },
  board: {
    doc: 'a loose board (nailed across a door, carried, broken), a curved roof tile or a heavy beam',
    params: `x, y = centre; len = 520, w = 44; rot deg; kind board|tile|beam; nails; state whole|broken; ${PARAMS_PLACE}`,
    returns: 'points a, b (the two ends), centre',
    schema: boardSchema,
    draw: drawBoard,
  },
  panel: {
    doc: 'a flat wall or machine panel: rivet rows, a strip of tape, scuffs',
    params: `x, y = top-left; w = 300, h = 500; rivets; tape; ${PARAMS_PLACE}`,
    returns: 'points centre; label = a stencil spot',
    schema: panelSchema,
    draw: drawPanel,
  },
  bell: {
    doc: 'a bell hanging from its beam, swinging (pair it with fx.shakeLines for the clang)',
    params: 'x, y = pivot; size = 1; swing deg (-80..80); tone = brass; seed',
    returns: 'points mouth, pivot',
    schema: bellSchema,
    draw: drawBell,
  },
  table: {
    doc: 'a table or desk seen from the front, a little from above: top board, legs, a hanging cloth, a counter front; broken drops one end',
    params:
      'x, y = floor centre; w = 460, h = 170 (top height); kind plank|long|low|desk|counter|trestle; cloth; state whole|broken; tone, wear, seed',
    returns: 'points top, left, right (put things ON the top, palms on the edge)',
    schema: tableSchema,
    draw: drawTable,
  },
  seat: {
    doc: 'a stool, bench, chair, high-backed chair or floor cushion (draw it before the seated person)',
    params:
      'x, y = floor centre; kind stool|bench|chair|highBack|cushion; w = 150; size; state whole|broken; tone, wear, seed',
    returns: 'points seat (where the hips go), back',
    schema: seatSchema,
    draw: drawSeat,
  },
  lamp: {
    doc: 'a light source: candle, iron candle stand, torch, lantern, oil lamp, paper floor lamp, hanging work lamp, bare bulb; the flame flickers on twos',
    params:
      'x, y = base (candle, stand, oil, paper), grip (torch) or hook (lantern, hanging, bulb); kind; state lit|out; level 0-1 (wax / oil left); size; t; pool (draw its light pool first); rot; seed',
    returns: 'points flame, grip, base; light = the pool to draw BEHIND the people (env.ink.pool)',
    schema: lampSchema,
    draw: drawLamp,
  },
  banner: {
    doc: 'cloth that tells who owns a place: a flag or pennant on a pole, a hanging banner, a split doorway curtain, a hanging signboard; sways on twos',
    params:
      'x, y = pole top / rail left; w = 260, h = 170; kind flag|pennant|hanging|curtain|sign; emblem none|stripe|band|disc|cross|chevron|star; tone = RUST, emblemTone; wind 0-1; state whole|torn; t; seed',
    returns: 'points top, tip; label = where its word goes (drawText)',
    schema: bannerSchema,
    draw: drawBanner,
  },
  container: {
    doc: 'goods in a container: barrel (iron hoops), crate (brace, nails), sack (tied neck), straw bale (rope bands), basket, clay jar, tub; open shows the contents, spilled pours them out, broken holes it',
    params:
      'x, y = floor centre; kind barrel|crate|sack|bale|basket|jar|tub; size (1 = about 150-180 px wide); state shut|open|spilled|broken; contents (tone of what is inside) = straw; tone, wear, seed',
    returns:
      'points top, gripL, gripR (hug it: palms on the sides), centre; label = a stencil spot',
    schema: containerSchema,
    draw: drawContainer,
  },
  coins: {
    doc: 'money: n round coins, oval coins or small bars in a fan (on a palm), a stack or a scatter',
    params:
      'x, y = centre (a palm); n = 3 (1-40); kind round|oval|bar; spread fan|stack|scatter; size; tone = brass; seed',
    returns: 'points centre, top',
    schema: coinsSchema,
    draw: drawCoins,
  },
  paper: {
    doc: 'paper in every period: a sheet or slip, a lop-sided stack, a book (shut / open, a page mid-flip, pages unfolding down), a scroll, a stone or wax tablet, fanned cards, name tags on a rail',
    params:
      'x, y = centre (tags: rail left); kind sheet|stack|book|scroll|tablet|cards|tags; state shut|open|torn|crumpled; w = 120; n (sheets, pages unfolded below an open book, cards, tags); page 0-1 (flip); rot; lines (scribbles); tie (cord); tone; seed',
    returns: 'points centre, top; label = where the heading goes (drawText the real word there)',
    schema: paperSchema,
    draw: drawPaper,
  },
  weapon: {
    doc: 'a weapon with wear and state: sword or dagger (drawn / sheathed scabbard / broken / bent, a gleam), spear, club, axe, round shield',
    params:
      'x, y = grip (a palm; shield = centre); kind sword|dagger|spear|club|axe|shield; state drawn|sheathed|broken|bent; rot deg (0 = point to the right, 90 = down); size; gleam 0-1; tone (blade / shield); wear (nicks, dents); seed',
    returns: 'points grip, tip, pommel (two tips meeting = acting.clink)',
    schema: weaponSchema,
    draw: drawWeapon,
  },
  tool: {
    doc: 'a tool for a job: hammer, shovel, broom, big key (turns in a lock), saw, wrench, walking stick, seal stamp',
    params:
      'x, y = grip (a palm); kind hammer|shovel|broom|key|saw|wrench|stick|stamp; rot deg (0 = working end right, 90 = down); size; turn 0-1 (key bow turning); state whole|broken; tone; wear; seed',
    returns: 'points grip, head (the working end), tail',
    schema: toolSchema,
    draw: drawTool,
  },
  cart: {
    doc: 'a minimal cart: handcart, four-wheeled wagon, wheelbarrow; wheels roll with distance, a load on the bed, broken = a wheel off',
    params:
      'x, y = ground centre; kind handcart|wagon|barrow; size; roll (px travelled: spins the wheels); load (tone of the heap); state whole|broken; tone; wear; seed',
    returns: 'points handle (palms), bed',
    schema: cartSchema,
    draw: drawCart,
  },
  boat: {
    doc: 'a minimal boat: rowboat, raft, barge, rocking on twos at the waterline; sinking lists it',
    params:
      'x, y = waterline centre; kind rowboat|raft|barge; size; t; rock deg (0-30); state whole|sinking; water (ripple strokes); tone; wear; seed',
    returns: 'points bow, stern, seat',
    schema: boatSchema,
    draw: drawBoat,
  },
  ...PROPS_TABLE,
} as const;

/** `env.ink.props`: `(g, e, opts)` per prop, options checked. */
export const PROPS = checkedDraws('props', PROPS_ITEMS);
