/**
 * Fixtures of the Game B2 open-vocabulary calibration (PLAN.md#13.15 phase 2): the six kit examples
 * built only through the open layer (packages/kit/examples/game-b2/open: forest, ocean, space
 * station, medieval village, desert, city), each with the narration of its header comment and short
 * research notes in the words its HUD uses (the place on the compass, the inventory, the speaker,
 * the meter). Each film is judged with its own sources, as a real project would be.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface OpenFilm {
  readonly narration: string;
  readonly research: string;
}

/** Narration and research notes per example file. */
export const GAME_B2_OPEN_FILMS: Readonly<Record<string, OpenFilm>> = {
  'o1_forest.js': {
    narration: 'Under every tree, fungi link the roots. Pick one up: that thread is the network.',
    research:
      'Old-growth forest: fungal threads (mycelium) link the roots of the trees into one network; mushrooms are the fruit of the fungi.',
  },
  'o2_ocean.js': {
    narration: 'Corals are animals, not plants. Each tiny polyp builds its own stone cup.',
    research:
      "A coral reef is built by colonies of polyps; a diver's air runs down on every dive; shells lie on the sand of the reef.",
  },
  'o3_space.js': {
    narration:
      'The station circles the Earth about every ninety minutes. That is some sixteen sunrises a day.',
    research:
      'The station flies in low Earth orbit, one orbit in about 90 minutes; its crew see about 16 sunrises a day; solar panels charge its power cells.',
  },
  'o4_medieval.js': {
    narration:
      'Every village had its well, and every well its gossip. The baker: the miller raised his price again.',
    research:
      'A medieval village met at the market square and the well; the baker bought flour from the miller and sold bread.',
  },
  'o5_desert.js': {
    narration:
      'An oasis is groundwater that reaches the surface. Caravans planned their routes around them.',
    research:
      'An oasis: groundwater reaching the surface in the desert; caravans carried water and planned their routes from oasis to oasis.',
  },
  'o6_city.js': {
    narration: 'At night, a city runs on a second shift: bakers, nurses, drivers, cleaners.',
    research:
      'Night workers of a city: the night bus on the main street carries nurses, bakers, drivers and cleaners to the second shift.',
  },
};

const KIT = fileURLToPath(new URL('../../../kit/', import.meta.url));

/** The kit's Game B2 open-vocabulary examples: name -> source. */
export function gameB2OpenExamples(): Map<string, string> {
  const dir = path.join(KIT, 'examples', 'game-b2', 'open');
  const files = readdirSync(dir).filter((name) => name.endsWith('.js'));
  return new Map(files.map((name) => [name, readFileSync(path.join(dir, name), 'utf8')]));
}
