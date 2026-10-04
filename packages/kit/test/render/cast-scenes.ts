/**
 * Scenes of the character-pack render tests (ADR-024): one scene module (plain JS, scene
 * contract) with a setup per stage of the concept page (mascots, faces close-up, cast on the
 * riser, mannequin, role-spec examples, a walking group), picked by `const SETUP`. The stage
 * copies the page: navy sky, indigo floor with a grid, purple pedestals, the page's four lights.
 */
import { EXAMPLE_ROLES } from '../../src/characters/cast-presets.js';
import type { RenderManifest } from '../support/scenes.js';

export const CAST_SETUPS = ['mascots', 'faces', 'cast', 'mannequin', 'roles', 'walk'] as const;
export type CastSetup = (typeof CAST_SETUPS)[number];

const FILE = 'kit-cast.js';

const SOURCE = String.raw`
// Character pack (ADR-024): the concept page's stages, one per SETUP.
export const meta = { id: 'c24', title: 'Character pack', treatment: 'character-scene' };

const SETUP = 'mascots';
const ROLES = __ROLES__;
const MASCOTS = ['bulb', 'screen', 'fox', 'bean'];
const CAST = ['scientist', 'doctor', 'engineer', 'finance', 'teacher', 'historian', 'kid', 'hacker', 'detective', 'astronaut'];
const FACES = ['neutral', 'joy', 'curious', 'surprised', 'thinking', 'sceptical', 'alarm'];

function stage(ctx, rig) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  if (rig) {
    scene.add(kit.env.lights({ preset: rig }));
  } else {
    // The page's lights (key front-right, teal and pink rims behind), with a warm fill.
    scene.add(new three.HemisphereLight(palette.fillLight, palette.groundAlt, 2.4));
    const key = new three.DirectionalLight(palette.heroTrim, 2.9);
    key.position.set(4, 9, 7);
    const rimA = new three.DirectionalLight(palette.accent1, 1.4);
    rimA.position.set(-7, 4, -6);
    const rimB = new three.DirectionalLight(palette.accent2, 0.9);
    rimB.position.set(7, 3, -5);
    scene.add(key, rimA, rimB);
  }
  const floor = kit.voxel.mesh(kit.voxel.box([90, 1, 90], 'groundAlt'), { voxelSize: 1, ao: 0 });
  floor.position.y = -1;
  const lines = palette.violet === undefined ? palette.ground : palette.violet;
  const grid = new three.GridHelper(90, 90, lines, palette.ground);
  grid.position.y = 0.004;
  scene.add(floor, grid);
}

/** The page's pedestal: a purple disc with a violet rim, 1 voxel (1/12) high. */
function pedestal(ctx, radius) {
  const { kit } = ctx;
  const r = radius * 12;
  const n = Math.ceil(r);
  const model = kit.voxel.generate([2 * n, 1, 2 * n], (x, y, z) => {
    const dx = x + 0.5 - n;
    const dz = z + 0.5 - n;
    const d = dx * dx + dz * dz;
    if (d > r * r) return 0;
    return d > (r - 1.3) * (r - 1.3) ? 2 : 1;
  }, ['ground', ctx.palette.violet === undefined ? 'groundAlt' : 'violet']);
  return kit.voxel.mesh(model, { voxelSize: 1 / 12, ao: 0 });
}

function place(ctx, character, x, z, y = 0, radius = 0.75) {
  const disc = pedestal(ctx, radius);
  disc.position.set(x, y, z);
  ctx.scene.add(disc);
  character.position.set(x, y + 1 / 12, z);
  ctx.scene.add(character);
  return character;
}

const SETUPS = {
  mascots(ctx) {
    const people = MASCOTS.map((id, index) => place(ctx, ctx.kit.cast.mascot(id, { seed: index + 1 }), -3.6 + index * 2.4, 0));
    for (const person of people) {
      person.pose('wave', { at: 2 }).pose('think', { at: 4 }).pose('eureka', { at: 6.5 });
    }
    return { people, camera: { position: [0, 1.65, 8.6], target: [0, 1, 0], fov: 34 } };
  },
  faces(ctx) {
    const people = MASCOTS.map((id, index) => {
      const mascot = place(ctx, ctx.kit.cast.mascot(id, { seed: index + 1, light: false, energy: 0.3 }), -2.1 + index * 1.4, 0, 0, 0.6);
      FACES.forEach((name, slot) => mascot.expression(name, { at: slot * 0.5 }));
      return mascot;
    });
    return { people, camera: { position: [0, 1.7, 6.2], target: [0, 1.25, 0], fov: 30 } };
  },
  cast(ctx) {
    const { kit, scene } = ctx;
    const riser = kit.voxel.mesh(kit.voxel.box([180, 18, 30], 'ground'), { voxelSize: 1 / 12, pivot: 'corner', ao: 0 });
    riser.position.set(-7, 0, -3.5);
    scene.add(riser);
    const later = ['think', 'wave', 'point', 'shrug', 'point', 'think', 'joy', 'shrug', 'think', 'wave'];
    const people = CAST.map((id, index) => {
      const back = index >= 5;
      const person = place(ctx, kit.cast.person(id, { seed: index + 1 }), (back ? -3.3 : -4.4) + (index % 5) * 2.2, back ? -2.2 : 0.8, back ? 18 / 12 : 0, 0.7);
      return person.pose(later[index], { at: 2 });
    });
    return { people, camera: { position: [0.55, 4.5, 12.4], target: [0.55, 1.55, -0.7], fov: 34 } };
  },
  mannequin(ctx) {
    const person = place(ctx, ctx.kit.cast.mannequin({ pose: 'wave', seed: 3 }), 0, 0);
    person.pose('think', { at: 3 }).pose('joy', { at: 6 });
    return { people: [person], camera: { position: [0, 1.7, 6.6], target: [0, 1, 0], fov: 34 } };
  },
  roles(ctx) {
    const { kit } = ctx;
    const people = [
      place(ctx, kit.cast.role(ROLES[0], { seed: 2 }), -2.2, 0),
      place(ctx, kit.cast.person('engineer', { seed: 5 }), 0, 0),
      place(ctx, kit.cast.role(ROLES[1], { seed: 7 }), 2.2, 0),
    ];
    people[0].rotation.y = -0.7;
    people[0].pose('point', { at: 2 });
    people[1].pose('wave', { at: 2 });
    people[2].pose('joy', { at: 2 });
    return { people, camera: { position: [0, 1.6, 6.8], target: [0, 0.95, 0], fov: 34 } };
  },
  walk(ctx) {
    const { kit, scene } = ctx;
    const bulb = kit.cast.mascot('bulb', { seed: 1 });
    bulb.position.set(-3, 0, 0);
    scene.add(bulb);
    bulb.walkTo([0.5, 0, 0.6], { at: 0.5, then: 'wave' }).expression('joy', { at: 5 });
    const fox = kit.cast.mascot('fox', { seed: 2 });
    fox.position.set(2.2, 0, -0.4);
    scene.add(fox);
    fox.lookAt(bulb, { at: 1 }).pose('point', { at: 4.6 });
    const engineer = kit.cast.person('engineer', { seed: 3 });
    engineer.position.set(3, 0, -1.6);
    scene.add(engineer);
    engineer.walkTo([1.2, 0, -1.6], { at: 1.5 }).walkTo([1.2, 0, -2.4]);
    const chef = kit.cast.role(ROLES[1], { seed: 4 });
    chef.position.set(-1.6, 0, -1.8);
    scene.add(chef);
    chef.pose('shrug', { at: 3 });
    return { people: [bulb, fox, engineer, chef], camera: { position: [0, 2.2, 7.4], target: [0, 0.9, -0.6], fov: 40 } };
  },
};

export function build(ctx) {
  stage(ctx, SETUP === 'walk' ? 'default' : undefined);
  return SETUPS[SETUP](ctx);
}

export function update(t, state, ctx) {
  ctx.camera.set(state.camera);
  state.people.forEach((person) => person.update(t));
}
`;

export function castSource(setup: CastSetup): string {
  const declaration = "const SETUP = 'mascots';";
  return SOURCE.replace('__ROLES__', JSON.stringify(EXAMPLE_ROLES)).replace(
    declaration,
    `const SETUP = '${setup}';`,
  );
}

export function castManifest(setup: CastSetup, style?: string, duration = 12): RenderManifest {
  return {
    version: 1,
    ...(style === undefined ? { width: 640, height: 360 } : { style }),
    fps: 30,
    seed: 2115,
    shots: [{ id: 'c24', t0: 0, t1: duration, scene: { file: FILE, source: castSource(setup) } }],
  };
}

export const CAST_FILE = FILE;
