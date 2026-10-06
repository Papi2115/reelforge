/**
 * Test fixture (PLAN.md#13.1): a tiny experimental world with one look, used only by tests to
 * prove that a world's looks and style appear only while its style is active. Never registered
 * in `WORLDS`; real worlds follow the same shape in `worlds/<id>/` (docs/worlds/README.md).
 */
import { z } from 'zod';
import { defineLook } from '../looks/types.js';
import { defineProp } from '../registry.js';
import { defineWorld } from '../worlds/types.js';

export const TEST_WORLD_ID = 'test-world';

/** A 16-colour paper palette with every token; legible text on the plate. */
export const TEST_WORLD_STYLE = {
  version: 1,
  id: TEST_WORLD_ID,
  name: 'Test World',
  resolution: { width: 640, height: 360 },
  palette: {
    ink: '#1b1a2e',
    graphite: '#3a3a4a',
    slate: '#5c5f73',
    pencil: '#8a8c99',
    paper: '#f3ecd9',
    cream: '#e6dbbf',
    tan: '#c9b48a',
    kraft: '#9c7f55',
    umber: '#5e4630',
    red: '#c8423a',
    coral: '#e88a6b',
    blue: '#2f5fa8',
    skyblue: '#8fb3d9',
    green: '#4f8a4b',
    mint: '#a8d1a0',
    yellow: '#e8c547',
  },
  tokens: {
    sky: 'paper',
    ground: 'cream',
    groundAlt: 'tan',
    hero: 'red',
    heroTrim: 'paper',
    accent1: 'blue',
    accent2: 'yellow',
    accent3: 'green',
    accent4: 'coral',
    keyLight: 'paper',
    fillLight: 'skyblue',
    shadow: 'ink',
    text: 'paper',
    textDim: 'cream',
    outline: 'graphite',
  },
  dither: { matrix: 'bayer4', spread: 0.05 },
} as const;

const testWorldPage = defineProp({
  name: 'testWorldPage',
  description: 'A flat test page (test world only).',
  params: z.object({ size: z.int().min(1).default(2).describe('Edge in voxels') }),
  build: (params, tools) =>
    tools.voxel.mesh(tools.voxel.box([params.size, params.size, 1], 'hero')),
});

export const testWorldLook = defineLook({
  id: 'test-world-page',
  label: 'Test world page',
  description: 'a page of the test world (exists only in tests)',
  rolls: ['A', 'B', 'C'],
  treatments: ['title-card'],
  docs: 'Build with kit.props.testWorldPage.',
  soundPalette: 'test-world',
  variationBudget: 'test-world',
  available: true,
  styles: [TEST_WORLD_ID],
  experimental: true,
  kit: { props: [testWorldPage] },
});

export const TEST_WORLD = defineWorld({
  id: TEST_WORLD_ID,
  label: 'Test world',
  description: 'A tiny experimental world for tests: one look, a 16-colour paper palette.',
  experimental: true,
  style: TEST_WORLD_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  soundPalette: 'test-world',
  looks: [testWorldLook],
});
