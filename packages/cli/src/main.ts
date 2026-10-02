/** Node entry of the `reelforge` CLI (bundled into dist/reelforge.mjs by scripts/build.mjs). */
import { runReelforgeCli } from './cli.js';

process.exitCode = await runReelforgeCli(
  process.argv.slice(2),
  {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
  process.cwd(),
);
