// Writes the SFX / music audition WAVs and spectrograms to out/audio-demos/ (for listening, see
// packages/pipeline/src/mix/audio-demos.test.ts). Usage: pnpm --filter @reelforge/pipeline audio:demos
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', '--project', 'unit', 'packages/pipeline/src/mix/audio-demos.test.ts'],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, REELFORGE_AUDIO_DEMOS: '1' },
    // pnpm is a .cmd shim on Windows.
    shell: process.platform === 'win32',
  },
);
process.exit(result.status ?? 1);
