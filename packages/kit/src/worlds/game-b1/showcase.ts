/**
 * The Game B1 showcase pieces (PLAN.md#13.15, ../showcase.ts): parts of the approved mockup film
 * (docs/worlds/game-hud-b1-boss-v2: the Christmas living room, the cartridge) that its templates
 * keep using. They stay valid, but docs name them only in `GAME_B1_SHOWCASE_LINE`, and `room()`
 * draws none of them unless a parameter asks (no calendar, tree, presents, gift or loose carts by
 * default).
 */
import { showcaseLine } from '../showcase.js';

export const GAME_B1_SHOWCASE = {
  /** `room()` decorations of the mockup's living room. */
  room: ['tree', 'presents', 'gift', 'carts'],
  /** TV painter calls. */
  painter: ['g.cart(x, y, stripe, { scale, body, label, tumble, phase })'],
  /** Manual figure shapes. */
  shapes: ['cartridge'],
} as const;

/** The one line that names them (kit-docs and the look docs). */
export const GAME_B1_SHOWCASE_LINE = showcaseLine({
  'room()': GAME_B1_SHOWCASE.room.join(', '),
  'in tv()': `${GAME_B1_SHOWCASE.painter.join(', ')} (a cartridge)`,
  'manual figure shape': GAME_B1_SHOWCASE.shapes.map((shape) => `'${shape}'`).join(' | '),
});
