/**
 * Test support: the bundled example film (templates/examples/doom-on-a-calculator) and the sfx
 * its scenes schedule (as `reelforge anchors --json` reports them), for sound-design tests that
 * should not need a browser to build the scenes.
 */
import path from 'node:path';
import type { SceneSfxEvent } from '../types.js';
import { REPO_ROOT } from './project.js';

export const EXAMPLE_DIR = path.join(REPO_ROOT, 'templates', 'examples', 'doom-on-a-calculator');

export const EXAMPLE_SCENE_SFX: readonly SceneSfxEvent[] = [
  { t: 2.382, name: 'pop', shotId: 's02' },
  { t: 2.944, name: 'pop', shotId: 's02' },
  { t: 3.516, name: 'pop', shotId: 's02' },
  { t: 9.264, name: 'glitch', shotId: 's03' },
  { t: 12.856, name: 'tick', shotId: 's04' },
  { t: 15.781, name: 'hit', shotId: 's04' },
  { t: 18.446, name: 'click', shotId: 's05' },
  { t: 19.419, name: 'click', shotId: 's05' },
  { t: 21.284, name: 'click', shotId: 's05' },
  { t: 23.991, name: 'glitch', shotId: 's06' },
  { t: 24.497, name: 'glitch', shotId: 's06' },
  { t: 28.915, name: 'hit', shotId: 's07' },
];
