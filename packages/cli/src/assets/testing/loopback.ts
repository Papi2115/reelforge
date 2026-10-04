/**
 * Tests and unpackaged-app test hooks only: an asset runtime whose five sources live on a local
 * http server at `base` (the path layout of `startAssetServer`). It is the only way to reach
 * `http://127.0.0.1`: the `allowLoopbackHttpForTests` transport option, never a setting or flag.
 */
import type { AllowlistSourceId } from '../sources/index.js';
import { createSourceRegistry } from '../sources/index.js';
import type { SourceEndpoints } from '../sources/types.js';
import type { AssetRuntime } from '../runtime.js';

export function loopbackEndpoints(base: string): Record<AllowlistSourceId, SourceEndpoints> {
  const endpoint = (prefix: string, files?: string): SourceEndpoints => ({
    api: `${base}${prefix}`,
    files,
    hosts: ['127.0.0.1'],
  });
  return {
    wikimedia: endpoint('/wikimedia/w/api.php'),
    openverse: endpoint('/openverse'),
    'internet-archive': endpoint('/ia', `${base}/ia`),
    nasa: endpoint('/nasa'),
    loc: endpoint('/loc'),
  };
}

export function loopbackAssetRuntime(
  base: string,
  now: () => Date = () => new Date('2026-10-04T12:00:00.000Z'),
): AssetRuntime {
  return {
    sources: createSourceRegistry({ endpoints: loopbackEndpoints(base) }),
    transport: { allowLoopbackHttpForTests: true, idleTimeoutMs: 2000 },
    now,
  };
}
