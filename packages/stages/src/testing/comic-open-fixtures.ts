/**
 * Fixtures of the Comic anti-slop calibration on the open vocabulary (PLAN.md#13.15 phase 2): the
 * kit's six topic-neutral examples (packages/kit/examples/comic/open, far from the showcase) with
 * the narration of each (its header comment) and short research notes of the kind a research
 * stage writes for that topic. Each example is judged against its own film's sources only.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface OpenComicExample {
  readonly file: string;
  readonly narration: string;
  readonly research: string;
}

export const COMIC_OPEN_EXAMPLES: readonly OpenComicExample[] = [
  {
    file: 'o1_forest.js',
    narration:
      'At first light the ranger walks the old pine forest. Something moves. A red deer freezes in the ferns... then a woodpecker starts drumming.',
    research:
      'Red deer (Cervus elaphus) graze at dawn and dusk; stags carry antlers from spring to late winter. The great spotted woodpecker drums on dead wood to mark its territory, up to 20 strokes a second. Scots pine forests, ferns in the understorey.',
  },
  {
    file: 'o2_ocean.js',
    narration:
      'Two hundred metres down, the sunlight is gone. Down here most animals make their own light: the anglerfish dangles a glowing lure, and a jellyfish flashes in the dark.',
    research:
      'The twilight zone begins at about 200 m, where too little sunlight is left for photosynthesis. Bioluminescence: about three quarters of deep-sea animals make light. The anglerfish lure (esca) holds glowing bacteria; many jellyfish flash when touched.',
  },
  {
    file: 'o3_station.js',
    narration:
      'Four hundred kilometres up, the station circles the Earth every ninety minutes. Inside, the crew float... and listen. Hsss: a leak.',
    research:
      'The International Space Station orbits at about 400 km and circles the Earth about every 90 minutes, some 16 orbits a day. Crews hunt slow air leaks by closing hatches between modules and watching the cabin pressure.',
  },
  {
    file: 'o4_village.js',
    narration:
      "Market day, 1350. The whole village came down from the hill: carts, geese, and a baker shouting, 'Bread! Fresh bread!' over the church bells.",
    research:
      'Medieval market charters granted a weekly market day; villagers sold geese, eggs and grain from carts in the square. Bakers were regulated by the Assize of Bread. Church bells marked the hours of the market.',
  },
  {
    file: 'o5_desert.js',
    narration:
      "Noon in the Sonoran desert. The sand is hot enough to burn. The hiker's canteen is empty... and the rattlesnake doesn't care.",
    research:
      'Summer ground temperatures in the Sonoran Desert can pass 70 °C at noon. Hikers need about one litre of water per hour in the heat. Western diamondback rattlesnakes shake their rattle as a warning; saguaro cacti grow only in the Sonoran Desert.',
  },
  {
    file: 'o6_city.js',
    narration:
      "Rush hour. Eight million people live in this city, and at six o'clock most of them want the same crossing. Then the light turns red.",
    research:
      'The city has about 8 million residents; the evening rush peaks around 6 pm. Busy crossings give pedestrians a walk phase of a few seconds; the signal beeps for blind pedestrians.',
  },
];

const OPEN_DIR = fileURLToPath(new URL('../../../kit/examples/comic/open/', import.meta.url));

/** The source of an open example scene. */
export function openComicSource(file: string): string {
  return readFileSync(path.join(OPEN_DIR, file), 'utf8');
}
