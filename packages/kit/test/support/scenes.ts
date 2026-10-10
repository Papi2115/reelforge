/** Render manifests of the kit example scenes (single shot each, no words needed). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { HarnessPage } from '../../../engine/src/cli/index.js';

export type RenderManifest = Parameters<HarnessPage['load']>[0];

const kitRoot = path.resolve(import.meta.dirname, '..', '..');

/** Kit goldens live next to the kit, rendered by the engine harness (SwiftShader). */
export const KIT_GOLDEN_DIR = path.join(kitRoot, 'test', 'goldens', 'swiftshader');
/** Generated, git-ignored output of the kit tests (perf numbers). */
export const KIT_OUT_DIR = path.join(kitRoot, 'out');

export const DEMO_FILE = 'examples/k01_voxel_demo.js';
export const STRESS_FILE = 'examples/k02_voxel_stress.js';
export const ENVS_FILE = 'examples/k03_envs.js';

/** Setups of the environments example, in contact-sheet order (keys of its SETUPS table). */
export const ENV_SETUPS = [
  'neonGridViolet',
  'neonGridTeal',
  'neonGridNavy',
  'skyDawn',
  'desk',
  'bench',
  'room',
  'blockCity',
  'floatingCubes',
  'void',
] as const;

export type EnvSetup = (typeof ENV_SETUPS)[number];

/** Absolute path of a kit file (examples/...). */
export function kitFile(file: string): string {
  return path.join(kitRoot, file);
}

export function sceneSource(file: string): string {
  return readFileSync(path.join(kitRoot, file), 'utf8');
}

export function sceneManifest(
  file: string,
  options: {
    readonly source?: string;
    readonly duration?: number;
    readonly style?: string;
    /** A portrait short (9:16, PLAN.md#13.18); absent = landscape. */
    readonly format?: RenderManifest['format'];
    /** Frame rate of the manifest (default 30; Grim Ink films run at 24). */
    readonly fps?: number | undefined;
    /** Project modules inlined into the manifest (Grim Ink people and places). */
    readonly kitExtensions?: RenderManifest['kitExtensions'];
  } = {},
): RenderManifest {
  const id = path.basename(file, '.js').slice(0, 3);
  return {
    version: 1,
    ...(options.style === undefined ? { width: 640, height: 360 } : { style: options.style }),
    ...(options.format === undefined ? {} : { format: options.format }),
    fps: options.fps ?? 30,
    seed: 2115,
    ...(options.kitExtensions === undefined ? {} : { kitExtensions: options.kitExtensions }),
    shots: [
      {
        id,
        t0: 0,
        t1: options.duration ?? 6,
        scene: { file, source: options.source ?? sceneSource(file) },
      },
    ],
  };
}

/** The stress scene with its renderer switched (the scene declares `const MODE = 'auto';`). */
export function stressSource(mode: 'auto' | 'greedy' | 'instanced'): string {
  const source = sceneSource(STRESS_FILE);
  const declaration = "const MODE = 'auto';";
  if (!source.includes(declaration))
    throw new Error(`${STRESS_FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const MODE = '${mode}';`);
}

/** The environments scene with another setup selected (it declares `const ENV = '...';`). */
export function envSource(setup: EnvSetup): string {
  const source = sceneSource(ENVS_FILE);
  const declaration = "const ENV = 'neonGridViolet';";
  if (!source.includes(declaration))
    throw new Error(`${ENVS_FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const ENV = '${setup}';`);
}

export const PROPS_FILE = 'examples/k04_props.js';

/** Props of the props example, in catalog order (keys of its SETUPS table). */
export const PROP_SETUPS = [
  'calculator',
  'bench',
  'paper',
  'laptop',
  'monitor',
  'server',
  'phone',
  'folder',
  'documentStack',
  'cash',
  'suitcase',
  'lock',
  'key',
  'clock',
  'globe',
  'mapTable',
  'usbStick',
  'character',
  'crowd',
  'car',
  'van',
  'truck',
  'container',
  'warehouse',
  'building',
  'tower',
  'house',
  'drone',
] as const;

export type PropSetup = (typeof PROP_SETUPS)[number] | 'gallery';

/** The props scene with another prop selected (it declares `const PROP = 'calculator';`). */
export function propSource(setup: PropSetup): string {
  const source = sceneSource(PROPS_FILE);
  const declaration = "const PROP = 'calculator';";
  if (!source.includes(declaration))
    throw new Error(`${PROPS_FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const PROP = '${setup}';`);
}

export const WORLD_FILE = 'examples/k06_world.js';

/** Setups of the world-props example (keys of its SETUPS table, in contact-sheet order). */
export const WORLD_SETUPS = ['poses', 'seated', 'variants', 'street', 'city'] as const;

export type WorldSetup = (typeof WORLD_SETUPS)[number];

/** The world scene with another setup selected (it declares `const WORLD = 'poses';`). */
export function worldSource(setup: WorldSetup): string {
  const source = sceneSource(WORLD_FILE);
  const declaration = "const WORLD = 'poses';";
  if (!source.includes(declaration))
    throw new Error(`${WORLD_FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const WORLD = '${setup}';`);
}
