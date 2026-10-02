// Reproduces the whole audio spike end to end (Windows; needs ffmpeg/ffprobe on PATH,
// PowerShell with System.Speech voices, ~3 GB free disk, network for the first run).
//   node spikes/03-audio/run.mjs            # fetch -> prepare -> clean -> matrix -> report
//   node spikes/03-audio/run.mjs clean matrix report
import path from 'node:path';
import { SPIKE_DIR, log, run } from './lib/common.mjs';

const STEPS = ['fetch', 'prepare', 'clean', 'matrix', 'report'];
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const extra = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
const steps = requested.length > 0 ? requested : STEPS;

for (const step of steps) {
  if (!STEPS.includes(step)) {
    process.stderr.write(`unknown step "${step}" (expected: ${STEPS.join(', ')})\n`);
    process.exit(2);
  }
  log(`== ${step}`);
  const result = await run(process.execPath, [path.join(SPIKE_DIR, `${step}.mjs`), ...extra]);
  process.stdout.write(result.stdout);
  if (result.code !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.code);
  }
  log(`   ${step} done in ${(result.ms / 1000).toFixed(1)} s`);
}
