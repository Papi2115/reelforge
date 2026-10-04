/**
 * Project roles (PLAN.md#12.20, ADR-026) in the engine harness (SwiftShader): the firefighter and
 * the chef loaded as role files through the manifest (`castRoles`) render exactly the
 * `character-roles-*` goldens of the inline specs (no new goldens), an invalid role file next to
 * them breaks nothing, and the professions of the new vocabulary plus project accessories render
 * in palette (contact sheet packages/kit/out/contact/character-project-roles.png, viewed by hand).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  computeFrameStats,
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { EXAMPLE_ROLES } from '../../src/characters/cast-presets.js';
import { composeSheet } from '../support/contact-sheet.js';
import { downscale } from '../support/image.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, type RenderManifest } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';
import { CAST_FILE, castManifest, castSource } from './cast-scenes.js';

const SUITE_TIMEOUT = 600_000;

const roleFile = (spec: { readonly id: string }) => ({
  id: spec.id,
  file: `characters/roles/${spec.id}.json`,
  source: JSON.stringify(spec, null, 2),
});

const accessoryFile = (accessory: { readonly id: string }) => ({
  id: accessory.id,
  file: `characters/accessories/${accessory.id}.json`,
  source: JSON.stringify(accessory),
});

/** The `roles` setup of cast-scenes.ts with the two examples resolved by id. */
function projectRolesManifest(): RenderManifest {
  const inline = castSource('roles');
  const source = inline
    .replace('kit.cast.role(ROLES[0], { seed: 2 })', "kit.cast.role('firefighter', { seed: 2 })")
    .replace('kit.cast.role(ROLES[1], { seed: 7 })', "kit.cast.person('chef', { seed: 7 })");
  expect(source).toContain("kit.cast.person('chef', { seed: 7 })");
  expect(source).toContain("kit.cast.role('firefighter', { seed: 2 })");
  const manifest = castManifest('roles');
  return {
    ...manifest,
    castRoles: {
      roles: [
        ...EXAMPLE_ROLES.map(roleFile),
        { id: 'broken', file: 'characters/roles/broken.json', source: '{ "id": "broken"' },
      ],
      accessories: [],
    },
    shots: manifest.shots.map((shot) => ({ ...shot, scene: { file: CAST_FILE, source } })),
  };
}

const RADIO = {
  id: 'shoulderRadio',
  description: 'radio clipped to the shoulder with an antenna',
  slot: 'torso',
  colors: { color: 'black', trim: 'slateGrey' },
  boxes: [
    { color: 'color', at: [2, 5, 2], size: [1.4, 1.8, 0.8] },
    { color: 'trim', at: [2.4, 6.8, 2], size: [0.3, 1.6, 0.3] },
  ],
};
const BATON = {
  id: 'baton',
  description: 'short black baton',
  slot: 'hand',
  colors: { color: 'black' },
  boxes: [{ color: 'color', at: [0, -3.6, 0.5], size: [0.6, 3.8, 0.6] }],
};

/** Professions of the new vocabulary, and one with project accessories. */
const PROFESSIONS = [
  {
    id: 'pilot',
    label: 'Pilot',
    headgear: { id: 'peakedCap', trim: 'cream' },
    top: { color: 'navy' },
    layers: [
      { id: 'suit', color: 'navy' },
      { id: 'tie', color: 'navy' },
    ],
    legs: { color: 'navy' },
    shoes: { color: 'black' },
    accessories: ['badge'],
    held: 'briefcase',
  },
  {
    id: 'farmer',
    label: 'Farmer',
    skin: 'tan',
    headgear: 'strawHat',
    top: { color: 'pink' },
    layers: ['overalls'],
    legs: { color: 'teal' },
    shoes: { style: 'boots', color: 'rust' },
    held: 'pitchfork',
  },
  {
    id: 'judge',
    label: 'Judge',
    skin: 'brown',
    hair: { style: 'bald', color: 'cream' },
    top: { color: 'black' },
    layers: ['robe'],
    legs: { color: 'black' },
    shoes: { color: 'black' },
    accessories: ['glassesRound'],
    held: 'gavel',
  },
  {
    id: 'courier',
    label: 'Courier',
    headgear: 'capBack',
    top: { color: 'orange' },
    legs: { style: 'shorts', color: 'darkSlate' },
    shoes: { color: 'cream' },
    accessories: ['backpack'],
    held: 'parcel',
  },
  {
    id: 'policeOfficer',
    label: 'Police officer',
    skin: 'tan',
    hair: { style: 'cropped', color: 'black' },
    headgear: 'peakedCap',
    top: { color: 'slateBlue' },
    layers: [{ id: 'tie', color: 'navy' }],
    legs: { color: 'navy' },
    shoes: { color: 'black' },
    accessories: ['badge', 'shoulderRadio'],
    held: 'baton',
  },
];

const LINEUP_SOURCE = String.raw`
export const meta = { id: 'r26', title: 'Project roles', treatment: 'character-scene' };
const IDS = ${JSON.stringify(PROFESSIONS.map((spec) => spec.id))};
export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  // The page's lights with a warm fill (tan and cream keep their hue, cast-scenes.ts).
  scene.add(new three.HemisphereLight(palette.fillLight, palette.groundAlt, 2.4));
  const key = new three.DirectionalLight(palette.heroTrim, 2.9);
  key.position.set(4, 9, 7);
  const rim = new three.DirectionalLight(palette.accent1, 1.4);
  rim.position.set(-7, 4, -6);
  scene.add(key, rim);
  const floor = kit.voxel.mesh(kit.voxel.box([90, 1, 90], 'groundAlt'), { voxelSize: 1, ao: 0 });
  floor.position.y = -1;
  scene.add(floor);
  const people = IDS.map((id, index) => {
    const person = kit.cast.person(id, { seed: index + 1 });
    person.position.set(-4 + index * 2, 0, 0);
    person.rotation.y = index % 2 === 0 ? 0.35 : -0.35;
    scene.add(person);
    return person.pose(index % 2 === 0 ? 'point' : 'wave', { at: 2 });
  });
  return { people };
}
export function update(t, state, ctx) {
  // From 3.5 s a close-up of the police officer (project accessories: radio, baton).
  const close = t >= 3.5;
  ctx.camera.set(close
    ? { position: [3.2, 1.4, 3.2], target: [4, 0.9, 0], fov: 38 }
    : { position: [0, 1.7, 8.4], target: [0, 0.95, 0], fov: 38 });
  state.people.forEach((person) => person.update(t));
}
`;

function professionsManifest(): RenderManifest {
  return {
    version: 1,
    width: 640,
    height: 360,
    fps: 30,
    seed: 2026,
    castRoles: {
      roles: PROFESSIONS.map(roleFile),
      accessories: [RADIO, BATON].map(accessoryFile),
    },
    shots: [
      { id: 'r26', t0: 0, t1: 4, scene: { file: 'project-roles.js', source: LINEUP_SOURCE } },
    ],
  };
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('project roles (SwiftShader)', () => {
  it(
    'renders role files exactly like the inline specs (character-roles goldens)',
    async () => {
      const page = await browser.open({ lint: true });
      try {
        const info = await page.load(projectRolesManifest());
        for (const t of [1.5, 3.4]) {
          const frame = { width: info.width, height: info.height, data: await page.frameAt(t) };
          expectVibe(frame, `roles t=${String(t)}`);
          await compareWithGolden(`character-roles-t${String(t)}`, frame, undefined, {
            goldenDir: KIT_GOLDEN_DIR,
          });
        }
        expect(page.errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
    SUITE_TIMEOUT,
  );

  it(
    'renders the new-vocabulary professions and project accessories in palette',
    async () => {
      expect(lintScene(LINEUP_SOURCE, { filename: 'project-roles.js' })).toEqual([]);
      const tiles: RgbaImage[] = [];
      const page = await browser.open({ lint: true });
      try {
        const info = await page.load(professionsManifest());
        for (const t of [0.5, 3, 3.8]) {
          const data = await page.frameAt(t);
          const frame = { width: info.width, height: info.height, data };
          expectVibe(frame, `professions t=${String(t)}`);
          const stats = computeFrameStats(data);
          expect(stats.uniqueColors).toBeGreaterThanOrEqual(8);
          tiles.push(frame);
        }
        expect(page.errors).toEqual([]);
      } finally {
        await page.close();
      }
      const file = path.join(KIT_OUT_DIR, 'contact', 'character-project-roles.png');
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(
        file,
        encodePng(
          composeSheet(
            tiles.map((tile) => downscale(tile, 1, 'nearest')),
            1,
          ),
        ),
      );
    },
    SUITE_TIMEOUT,
  );
});
