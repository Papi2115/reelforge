/**
 * `reelforge fetch-asset`: downloads one asset into the project (bytes in `.reelforge/assets/`,
 * metadata in `assets.json`) under the research-mode guard (PLAN.md#12.9, ADR-012).
 */
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command } from '../command.js';
import { fetchAsset } from '../assets/fetch.js';
import { asProjectError, recordLines } from '../assets/format.js';
import { defaultAssetRuntime } from '../assets/runtime.js';
import { untrustedBlock } from '../assets/untrusted.js';
import { parseKind } from './assets.js';

export const FETCH_ASSET_USAGE = `usage: reelforge fetch-asset --source <id> --id <candidate id> [--as <name>] [--json]
       reelforge fetch-asset --url <https url> [--kind image|video] [--as <name>]   (mode "full-auto" only)
Downloads one image/video into the project (.reelforge/assets/<name>.<ext>, git-ignored) and
records source, author, licence and links in assets.json. --source/--id come from
\`reelforge assets search\`; in research mode "ask" only candidates the user approved are fetched.
Limits: https only, images ≤ 25 MB, videos ≤ 120 MB, png/jpeg/webp/gif/mp4/webm by content.
Never YouTube or other video platforms, in any mode. --as: asset id (lower-case, digits, dashes).
Exit code: 0 ok, 1 refused/failed (the message says why), 2 usage error.`;

const OPTIONS = {
  ...COMMON_OPTIONS,
  source: { type: 'string' },
  id: { type: 'string' },
  url: { type: 'string' },
  as: { type: 'string' },
  kind: { type: 'string' },
} as const;

export const fetchAssetCommand: Command = {
  name: 'fetch-asset',
  summary: 'download one open-licence image/video into the project (research mode decides)',
  usage: FETCH_ASSET_USAGE,
  async run(argv, context) {
    const { values } = parseCommandArgs(argv, OPTIONS, false);
    try {
      const outcome = await fetchAsset(context.root, context.assets ?? defaultAssetRuntime(), {
        source: values.source,
        id: values.id,
        url: values.url,
        as: values.as,
        kind: parseKind(values.kind),
      });
      const { record } = outcome;
      const lines = [
        outcome.existing
          ? `already in the catalogue: ${record.id} -> ${record.file} (nothing downloaded)`
          : `fetched: ${record.id} -> ${record.file}`,
        ...untrustedBlock(recordLines(record)),
        ...(record.licence.verified
          ? []
          : [
              'warning: the licence is UNVERIFIED; the credits flag this asset and the user must check it before publishing',
            ]),
        `use it by its id "${record.id}"; \`reelforge assets credits\` lists it once a scene uses it`,
        'result: ok',
      ];
      return result(0, lines, { ok: true, existing: outcome.existing, asset: record });
    } catch (error) {
      throw asProjectError(error);
    }
  },
};
