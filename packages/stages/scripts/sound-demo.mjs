// Renders the example film's sound design to out/audio-demos/ (for listening, see
// packages/stages/src/sound-demo.test.ts). Needs ffmpeg and a built CLI (pnpm build).
// Usage: pnpm --filter @reelforge/stages sound:demo
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', '--project', 'unit', 'packages/stages/src/sound-demo.test.ts'],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, REELFORGE_AUDIO_DEMOS: '1' },
    // pnpm is a .cmd shim on Windows.
    shell: process.platform === 'win32',
  },
);
process.exit(result.status ?? 1);
