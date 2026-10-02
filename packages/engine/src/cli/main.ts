/** Node entry of the engine dev CLI; bundled and run by `packages/engine/scripts/run-cli.mjs`. */
import { runEngineCli } from './engine-cli.js';

process.exitCode = await runEngineCli(process.argv.slice(2));
