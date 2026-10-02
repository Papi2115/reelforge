/** The effect example scenes (PLAN.md#3.4): files, their setups and setup selection. */
import { sceneManifest, sceneSource, type RenderManifest } from './scenes.js';

/** Example file -> its setups (keys of the file's SETUPS table, in contact-sheet order). */
export const FX_EXAMPLES = {
  'examples/k05_fx_objects.js': ['shards', 'dissolve', 'glitch', 'flicker'],
  'examples/k05_fx_counter.js': ['counter', 'typewriter', 'ticker', 'screen'],
  'examples/k05_fx_charts.js': ['bars', 'graph', 'timeline'],
  'examples/k05_fx_map.js': ['europe', 'generic', 'islands'],
} as const;

export type FxFile = keyof typeof FX_EXAMPLES;
export type FxSetup = (typeof FX_EXAMPLES)[FxFile][number];

export const FX_FILES = Object.keys(FX_EXAMPLES) as FxFile[];

/** Every [file, setup] pair, in contact-sheet order. */
export const FX_SETUPS: readonly (readonly [FxFile, FxSetup])[] = FX_FILES.flatMap((file) =>
  FX_EXAMPLES[file].map((setup) => [file, setup] as const),
);

/** The example with another setup selected (each file declares `const FX = '<first>';`). */
export function fxSource(file: FxFile, setup: FxSetup): string {
  const source = sceneSource(file);
  const declaration = `const FX = '${FX_EXAMPLES[file][0]}';`;
  if (!source.includes(declaration)) throw new Error(`${file} no longer declares ${declaration}`);
  return source.replace(declaration, `const FX = '${setup}';`);
}

export function fxManifest(file: FxFile, setup: FxSetup, style?: string): RenderManifest {
  const options = style === undefined ? {} : { style };
  return sceneManifest(file, { ...options, source: fxSource(file, setup) });
}
