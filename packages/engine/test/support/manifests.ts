/** Render manifests built from the example scene and test fixtures. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ManifestShot, RenderManifest, SceneSource, Transition } from '@reelforge/shared';

const engineRoot = path.resolve(import.meta.dirname, '..', '..');

function sceneFile(relativePath: string): SceneSource {
  return { file: relativePath, source: readFileSync(path.join(engineRoot, relativePath), 'utf8') };
}

export const HELLO_SCENE = sceneFile('examples/s00_hello.js');
export const STRIPES_SCENE = sceneFile('test/fixtures/s01_stripes.js');
export const TEXT_SCENE = sceneFile('examples/s01_text.js');
export const ANNOTATIONS_SCENE = sceneFile('examples/s02_annotations.js');

/** Words with the phrase anchored by s00_hello ("hello world" at 1.0–1.6 s). */
export const HELLO_WORDS: RenderManifest['words'] = {
  version: 1,
  words: [
    { text: 'Hello', t: 1, tEnd: 1.3 },
    { text: 'world.', t: 1.3, tEnd: 1.6 },
  ],
};

const DEFAULT_SEED = 2115;

export function manifest(shots: ManifestShot[], seed = DEFAULT_SEED): RenderManifest {
  return { version: 1, width: 640, height: 360, fps: 30, seed, words: HELLO_WORDS, shots };
}

/** The example scene alone; with a style id the size comes from the style preset. */
export function helloManifest(seed = DEFAULT_SEED, style?: string): RenderManifest {
  const shots = [{ id: 's00', t0: 0, t1: 5, scene: HELLO_SCENE }];
  if (style === undefined) return manifest(shots, seed);
  return { version: 1, style, fps: 30, seed, words: HELLO_WORDS, shots };
}

export interface TransitionCase {
  readonly type: Exclude<Transition['type'], 'cut'>;
  /** Global time of the transition midpoint. */
  readonly midpoint: number;
}

/** hello -> stripes (crossfade) -> hello (glitch) -> stripes (wipe), 1 s transitions. */
export const TRANSITION_CASES: readonly TransitionCase[] = [
  { type: 'crossfade', midpoint: 3.5 },
  { type: 'glitch', midpoint: 6.5 },
  { type: 'wipe', midpoint: 9.5 },
];

export function transitionsManifest(): RenderManifest {
  const transition = (type: TransitionCase['type']): Transition => ({ type, duration: 1 });
  return manifest([
    { id: 'a', t0: 0, t1: 3, scene: HELLO_SCENE },
    { id: 'b', t0: 3, t1: 6, transitionIn: transition('crossfade'), scene: STRIPES_SCENE },
    { id: 'c', t0: 6, t1: 9, transitionIn: transition('glitch'), scene: HELLO_SCENE },
    { id: 'd', t0: 9, t1: 12, transitionIn: transition('wipe'), scene: STRIPES_SCENE },
  ]);
}

/** The text example scene alone (title, lower third, kinetic text) in a style preset. */
export function textManifest(style: string): RenderManifest {
  const shots = [{ id: 's01', t0: 0, t1: 6, scene: TEXT_SCENE }];
  return { version: 1, style, fps: 30, seed: DEFAULT_SEED, shots };
}

/** The annotation example scene alone (every ctx.annotate type, 4 acts of 3 s) in a style preset. */
export function annotationsManifest(style: string): RenderManifest {
  const shots = [{ id: 's02', t0: 0, t1: 12, scene: ANNOTATIONS_SCENE }];
  return { version: 1, style, fps: 30, seed: DEFAULT_SEED, shots };
}
