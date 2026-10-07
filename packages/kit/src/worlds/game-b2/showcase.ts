/**
 * The Game B2 showcase pieces (PLAN.md#13.15, ../showcase.ts): ids ported from the approved mockup
 * film (docs/worlds/game-hud-b2-rpg-v2) that the showcase templates keep using. They stay valid
 * names, but docs and error messages name them only in `GAME_B2_SHOWCASE_LINE`; a held item has
 * no default look (the mockup's cartridge only with `kind: 'cartridge'`).
 */
import { showcaseLine } from '../showcase.js';

export const GAME_B2_SHOWCASE = {
  levels: ['office', 'warehouse'],
  sprites: ['item', 'sand-pile', 'clerk', 'carton'],
  icons: ['cartridge', 'carton'],
  items: ['cartridge'],
} as const;

const quoted = (ids: readonly string[]): string => ids.map((id) => `'${id}'`).join(' | ');

/** The one line that names them (kit-docs and the look docs). */
export const GAME_B2_SHOWCASE_LINE = showcaseLine({
  levels: quoted(GAME_B2_SHOWCASE.levels),
  sprites: GAME_B2_SHOWCASE.sprites.join(', '),
  'inventory icons': quoted(GAME_B2_SHOWCASE.icons),
  'item kind': quoted(GAME_B2_SHOWCASE.items),
});
