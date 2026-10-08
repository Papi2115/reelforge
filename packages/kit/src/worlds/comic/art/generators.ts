/**
 * The table of comic art generators (PLAN.md#13.15a): name -> options schema + painter. The page
 * API (`page.art.<name>(g, options)`), project assets (`{ gen: '<name>', ... }`) and the shape
 * DSL (`{ shape: 'gen', gen: '<name>' }`) all draw through it, so every name is validated the
 * same way (zod, readable errors).
 */
import type { z } from 'zod';
import type { ComicPen } from '../page/pen.js';
import { animalSchema, drawAnimal } from './gen-animals.js';
import { backdropSchema, drawBackdrop } from './gen-backdrop.js';
import { birdSchema, drawBird } from './gen-birds.js';
import { buildingSchema, drawBuilding } from './gen-buildings.js';
import { chartSchema, drawChart, drawMap, drawSign, mapSchema, signSchema } from './gen-charts.js';
import { drawEffect, effectSchema } from './gen-effects.js';
import { drawFish, fishSchema } from './gen-fish.js';
import { drawObject, objectSchema } from './gen-objects.js';
import { crowdSchema, drawCrowd, drawPerson, personSchema } from './gen-people.js';
import { drawInterior, drawSpace, interiorSchema, spaceSchema } from './gen-places.js';
import { drawTree, treeSchema } from './gen-plants.js';
import { drawInsect, drawReptile, insectSchema, reptileSchema } from './gen-small.js';
import { drawIcon, iconSchema } from './gen-symbols.js';
import {
  drawDunes,
  drawForest,
  drawSkyline,
  dunesSchema,
  forestSchema,
  skylineSchema,
} from './gen-terrain-rows.js';
import {
  drawHills,
  drawLand,
  drawSea,
  drawSky,
  hillsSchema,
  landSchema,
  seaSchema,
  skySchema,
} from './gen-terrain.js';
import {
  bushSchema,
  cactusSchema,
  drawBush,
  drawCactus,
  drawFlowers,
  drawGrass,
  drawSeaweed,
  flowersSchema,
  grassSchema,
  seaweedSchema,
} from './gen-undergrowth.js';
import { drawVehicle, vehicleSchema } from './gen-vehicles.js';

export interface Generator<S extends z.ZodType = z.ZodType> {
  readonly schema: S;
  readonly draw: (g: ComicPen, options: z.output<S>) => void;
  /** One line for the docs: what it draws and its main knobs. */
  readonly doc: string;
}

function gen<S extends z.ZodType>(
  schema: S,
  draw: (g: ComicPen, options: z.output<S>) => void,
  doc: string,
): Generator {
  return { schema, draw: draw as Generator['draw'], doc };
}

export const GENERATORS = {
  person: gen(
    personSchema,
    drawPerson,
    'a figure: pose, expression, build, skin, hair, hat, outfit, top/bottom, tool',
  ),
  crowd: gen(crowdSchema, drawCrowd, 'rows of figures between x0 and x1, back rows flatter'),
  animal: gen(
    animalSchema,
    drawAnimal,
    'a four-legged animal: species preset, pose, fill, ears, tail, feature',
  ),
  bird: gen(
    birdSchema,
    drawBird,
    'a bird: species, pose fly/glide/perch/peck/swim (centre when flying)',
  ),
  fish: gen(
    fishSchema,
    drawFish,
    'sea life by its centre: fish, tropical, shark, eel, whale, ray, jellyfish, crab, octopus',
  ),
  insect: gen(
    insectSchema,
    drawInsect,
    'an insect or spider by its centre: kind, pose fly/crawl/still',
  ),
  reptile: gen(
    reptileSchema,
    drawReptile,
    'lizard, snake, turtle, crocodile, frog; pose still/crawl/strike/leap',
  ),
  tree: gen(treeSchema, drawTree, 'pine, oak, birch, palm, dead, willow; season, lean, sway'),
  bush: gen(bushSchema, drawBush, 'a bush: width, fill, dots (berries)'),
  grass: gen(grassSchema, drawGrass, 'grass tufts from x0 to x1 on y: height, density'),
  flowers: gen(
    flowersSchema,
    drawFlowers,
    'a row of flowers: daisy, tulip, sunflower, poppy, bell',
  ),
  cactus: gen(cactusSchema, drawCactus, 'saguaro, barrel, prickly; bloom'),
  seaweed: gen(seaweedSchema, drawSeaweed, 'kelp, sea grass, coral (sways)'),
  sky: gen(
    skySchema,
    drawSky,
    'fills box: day, dawn, dusk, night, storm, overcast, underwater, space; sun, moon, stars, clouds',
  ),
  land: gen(
    landSchema,
    drawLand,
    'ground under a horizon: meadow, dirt, sand, snow, rock, seabed, road, cobbles, floor, deck',
  ),
  hills: gen(hillsSchema, drawHills, 'rolling hills or snowy peaks, 1-3 layers'),
  sea: gen(seaSchema, drawSea, 'sea to the horizon with moving waves'),
  dunes: gen(dunesSchema, drawDunes, 'desert dunes with shaded lee sides'),
  forest: gen(forestSchema, drawForest, 'rows of trees on a horizon, back rows flat'),
  skyline: gen(skylineSchema, drawSkyline, 'city skyline, lit windows at night'),
  interior: gen(
    interiorSchema,
    drawInterior,
    'room, module (space station), stone hall, wood cabin; window view, door',
  ),
  space: gen(spaceSchema, drawSpace, 'stars and a planet: earth, moon, mars, ringed'),
  backdrop: gen(
    backdropSchema,
    drawBackdrop,
    'an establishing backdrop by preset (forest, ocean, station, village, desert, city, ...)',
  ),
  building: gen(
    buildingSchema,
    drawBuilding,
    'house, cottage, tower, castle, skyscraper, shop, hut, church, lighthouse, tent, barn, factory, station',
  ),
  vehicle: gen(
    vehicleSchema,
    drawVehicle,
    'car, truck, bus, bike, boat, sailboat, ship, cart, wagon, train, rocket, plane, helicopter, submarine, satellite',
  ),
  object: gen(
    objectSchema,
    drawObject,
    'skull, bone, barrel, crate, chest, book, key, clock, lamp, coin, gem, phone, ... (defining features)',
  ),
  icon: gen(
    iconSchema,
    drawIcon,
    'symbols by centre: heart, star, check, cross, question, warning, pin, arrow, ...',
  ),
  chart: gen(
    chartSchema,
    drawChart,
    'bar, line or pie in box; values from the narration, highlight, progress',
  ),
  map: gen(mapSchema, drawMap, 'island, coast or continent with pins and a dashed route'),
  sign: gen(signSchema, drawSign, 'post, board, arrow, banner, plaque, billboard with lettering'),
  effect: gen(
    effectSchema,
    drawEffect,
    'impact, motion, sweat, sparkle, steam, smoke, rain, snow, fire, dust, bubbles, splash, zzz, hearts, lightning, emphasis',
  ),
} as const satisfies Readonly<Record<string, Generator>>;

export type GeneratorName = keyof typeof GENERATORS;

export const GENERATOR_NAMES = Object.keys(GENERATORS) as GeneratorName[];

export function isGeneratorName(name: string): name is GeneratorName {
  return Object.hasOwn(GENERATORS, name);
}
