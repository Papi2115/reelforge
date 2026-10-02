// Kit stress scene (PLAN.md#3.1): a procedural voxel city of >= 100k voxels (128x24x128 grid,
// 8x8 blocks of varying height with glowing windows) generated with ctx.kit.voxel.generate and
// meshed once in build(). Used by the render perf test (preview must hold >= 60 fps).
export const meta = { id: 'k02', title: '100k voxel stress test', treatment: '3d-reconstruction' };

// Renderer under test; the perf test swaps this line to measure 'instanced' as well.
const MODE = 'auto';
const SIZE = [128, 24, 128];
const MIN_VOXELS = 100000;
const PALETTE = ['groundAlt', 'ground', 'accent3', 'heroTrim', { color: 'keyLight', glow: true }];

function blockHeight(blockX, blockZ) {
  return 4 + ((blockX * 3 + blockZ * 5) % 7) + ((blockX * blockZ) % 3) * 3;
}

/** Palette index of cell (x, y, z): ground slab, streets, block towers with window rows. */
function cityCell(x, y, z) {
  if (y === 0) return 1;
  const blockX = Math.floor(x / 8);
  const blockZ = Math.floor(z / 8);
  const street = x % 8 === 0 || z % 8 === 0;
  if (street) return y === 1 ? 2 : 0;
  const height = blockHeight(blockX, blockZ);
  if (y >= height) return 0;
  if (y === height - 1) return (blockX + blockZ) % 2 === 0 ? 3 : 4;
  const facade = x % 8 === 1 || x % 8 === 7 || z % 8 === 1 || z % 8 === 7;
  const window = facade && y % 3 === 1 && (x + z) % 2 === 0;
  return window ? 5 : 2;
}

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.fog = new three.Fog(palette.sky, 14, 34);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.0));
  const sun = new three.DirectionalLight(palette.keyLight, 2.4);
  sun.position.set(-6, 10, 4);
  scene.add(sun);

  const model = kit.voxel.generate(SIZE, cityCell, PALETTE);
  const count = kit.voxel.count(model);
  if (count < MIN_VOXELS) throw new Error(`stress scene has ${count} voxels, needs ${MIN_VOXELS}`);
  const city = kit.voxel.mesh(model, { voxelSize: 0.1, mode: MODE });
  scene.add(city);
  return { count };
}

export function update(t, state, ctx) {
  ctx.camera.orbit({
    target: [0, 0.6, 0],
    radius: 11,
    height: 5.5,
    degrees: [0, 90],
    to: 6,
    ease: 'linear',
  })(t);
  ctx.text.title(`${Math.round(state.count / 1000)}k voxels`, { id: 'count', pos: [0.5, 0.14] });
}
