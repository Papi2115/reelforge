/**
 * Variables of the world-assets prompt (PLAN.md#13.15 phase 2): one world-neutral prompt, the
 * world's own grammar (its prompt wording: what the world is + the craft brief), how its open
 * vocabulary is written, how files are named and the film's budget.
 */
import type { World } from '@reelforge/kit';
import type { WorldAssetWorld } from '@reelforge/shared';
import { promptWorld } from '../worlds.js';

/** At most this many things per film (the step's cost and the worlds' caps). */
export const WORLD_ASSET_BUDGETS: Readonly<Record<WorldAssetWorld, string>> = {
  sketchbook: '24 things',
  comic: '24 things (characters, props and backdrops together)',
  'game-b2': '24 sprites, 8 textures and 8 icons',
  'game-b1': '32 entries (sprites, playfields, generated and rooms together)',
};

const VOCABULARY: Readonly<Record<WorldAssetWorld, string>> = {
  sketchbook:
    'figures are page.person looks (clothes, colour, hat, hair, skin, holds; `reelforge kit-docs sketchPage`), props are a doodle, spot art or a generator call (beast, bird, fish, tree, building, vehicle, object, tool, icon, backdrops: hills, sea, forest, skyline, room, …).',
  comic:
    'characters use the creature generators (person, animal, bird, fish, insect, reptile) with knobs, props use generators (tree, building, vehicle, object, …), shape parts or a sprite, backdrops are layers (sky, land, hills, sea, forest, skyline, interior, space; `reelforge kit-docs comicPage`).',
  'game-b2':
    'sprites are pixel art (rows + a legend of ramp steps) or generators (plant, creature, person, structure, vehicle, object), textures are generators (grass, sand, water, brick, …) or 16/32/64 px tiles, icons are 12x12 rows or the icon generator (`reelforge kit-docs b2View`).',
  'game-b1':
    'sprites are 2600 players (<= 8 bits per row, one colour per row, size / copies), playfields are 20/40-bit rows, `generated` entries call the generators (tree, animal, person, vehicle, building, item, boss, effect, scenery), rooms are the room DSL around the TV (`reelforge kit-docs b1Screen`).',
};

const NAMING: Readonly<Record<WorldAssetWorld, string>> = {
  sketchbook:
    'one file per thing, named after its id: assets/sketchbook/ranger.json holds id "ranger"',
  comic: 'a few files grouped by place or story part, kebab-case names such as forest.json',
  'game-b2': 'a few files grouped by place or kind, kebab-case names such as forest.json',
  'game-b1': 'a few files grouped by place or kind, kebab-case names such as forest.json',
};

/** The grammar text of a world: its prompt wording, else the kit's description. */
function grammarOf(world: World): string {
  const text = promptWorld(world)?.text;
  return text === undefined ? world.description : `${text.brief}\n${text.craftBrief}`;
}

export function worldAssetsPromptVars(
  world: World,
  id: WorldAssetWorld,
  options: {
    readonly existing: readonly string[];
    readonly findings: readonly string[];
    readonly attempt: number;
  },
): Record<string, string | number> {
  return {
    world: id,
    worldLabel: world.label,
    grammar: grammarOf(world),
    vocabulary: VOCABULARY[id],
    naming: NAMING[id],
    budget: WORLD_ASSET_BUDGETS[id],
    ...(options.existing.length === 0 ? {} : { existing: options.existing.join(', ') }),
    ...(options.findings.length === 0
      ? {}
      : {
          findings: options.findings.map((line) => `- ${line}`).join('\n'),
          attempt: options.attempt,
        }),
  };
}
