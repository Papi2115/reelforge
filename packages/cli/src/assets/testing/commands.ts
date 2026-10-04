/**
 * Tests only: runs `reelforge assets …` / `reelforge fetch-asset …` in-process with an injected
 * runtime, as the runtime Claude would through its Bash tool (refusals come back as exit 1).
 */
import { assetsCommand } from '../../commands/assets.js';
import { fetchAssetCommand } from '../../commands/fetch-asset.js';
import { describeUnknown } from '../../errors.js';
import type { AssetRuntime } from '../runtime.js';

export interface AssetCommandRun {
  readonly argv: readonly string[];
  readonly code: number;
  readonly text: string;
}

export async function runAssetCommand(
  root: string,
  runtime: AssetRuntime,
  argv: readonly string[],
): Promise<AssetCommandRun> {
  const [name, ...rest] = argv;
  const command =
    name === 'assets' ? assetsCommand : name === 'fetch-asset' ? fetchAssetCommand : undefined;
  if (command === undefined) throw new Error(`not an asset command: ${argv.join(' ')}`);
  try {
    const outcome = await command.run(rest, { root, assets: runtime });
    return { argv, code: outcome.code, text: outcome.text };
  } catch (error) {
    return { argv, code: 1, text: describeUnknown(error) };
  }
}
