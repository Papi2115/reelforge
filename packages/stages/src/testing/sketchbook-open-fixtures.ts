/**
 * Fixtures of the Sketchbook anti-slop calibration on the open vocabulary (PLAN.md#13.15 phase
 * 2): the kit's six topic-neutral examples (packages/kit/examples/sketchbook/open, far from the
 * showcase) with the narration of each (its header comment) and short research notes of the kind
 * a research stage writes for that topic (they source the crossed-out guesses and the titles the
 * pages letter). Each example is judged against its own film's sources only.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface OpenSketchbookExample {
  readonly file: string;
  readonly narration: string;
  readonly research: string;
}

export const SKETCHBOOK_OPEN_EXAMPLES: readonly OpenSketchbookExample[] = [
  {
    file: 'o1_forest.js',
    narration: 'Rangers still count the old oaks one by one. This one is three hundred years old.',
    research:
      'Veteran oaks are surveyed tree by tree. The big oak by the fire lookout tower: a first estimate from its girth said about 200 years; the ring count of a core sample says about 300 years. Deer browse the young growth.',
  },
  {
    file: 'o2_ocean.js',
    narration:
      'Sunlight fades fast: below two hundred metres the sea is dark, yet a sperm whale dives to two thousand metres.',
    research:
      'Ocean zones of the deep sea: the sunlit zone (0-200 m), the twilight zone (200-1,000 m), the midnight zone below 1,000 m. Sperm whales dive to about 2,000 m to hunt squid; jellyfish live at every depth.',
  },
  {
    file: 'o3_space.js',
    narration:
      'The space station flies four hundred kilometres up and goes round the Earth sixteen times a day, once every ninety minutes.',
    research:
      'The International Space Station orbits at about 400 km and circles the Earth about every 90 minutes, about 16 times a day. Astronauts carry out repairs on spacewalks.',
  },
  {
    file: 'o4_village.js',
    narration:
      'The village grew around one well. The market was held right here, between the church and the well; the mill stood by the river.',
    research:
      'Medieval village plans: houses clustered around the well and the church; the weekly market was held on the open ground between them; the mill stood on the river. Village maps are drawn from above.',
  },
  {
    file: 'o5_desert.js',
    narration:
      "A camel's hump is not a water tank, it stores fat. When it finds water, a camel can drink a hundred litres in ten minutes.",
    research:
      'The hump stores fat, not water (a common myth). A thirsty camel can drink about 100 litres in about 10 minutes. Dromedaries cross the dunes of hot deserts.',
  },
  {
    file: 'o6_city.js',
    narration:
      'In 1950 fewer than one in three people lived in a city. Today it is more than half.',
    research:
      'UN World Urbanization Prospects: in 1950 about 30 % of people lived in cities; today about 55 %, more than half.',
  },
];

const OPEN_DIR = fileURLToPath(new URL('../../../kit/examples/sketchbook/open/', import.meta.url));

/** The source of an open example scene. */
export function openSketchbookSource(file: string): string {
  return readFileSync(path.join(OPEN_DIR, file), 'utf8');
}
