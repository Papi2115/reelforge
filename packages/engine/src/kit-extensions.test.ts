import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_ANCHORS } from './anchors.js';
import type { SceneContext } from './contract.js';
import { EngineError } from './errors.js';
import { kitExtensionDefinitions, loadKitExtensions } from './kit-extensions.js';
import { buildShot } from './shot.js';
import { resolveStyle } from './style.js';

const FRIDGE_FILE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'kit',
  'examples',
  'kit-ext',
  'fridge.js',
);
const FRIDGE = { name: 'fridge', file: 'kit-ext/props/fridge.js', source: 'unused in node' };

async function fridgeNamespace(): Promise<unknown> {
  const namespace: unknown = await import(pathToFileURL(FRIDGE_FILE).href);
  return namespace;
}

describe('kit extensions in the engine', () => {
  it('registers project props in every shot kit', async () => {
    const definitions = await loadKitExtensions([FRIDGE], () => fridgeNamespace());
    let seen: unknown;
    buildShot({
      shot: { id: 's01', t0: 0, duration: 2, width: 640, height: 360, fps: 30 },
      module: {
        meta: { id: 's01' },
        build: (ctx: SceneContext) => {
          const props = ctx.kit.props as unknown as Record<string, (() => unknown) | undefined>;
          seen = props['fridge']?.();
          return {};
        },
        update: () => undefined,
      },
      projectSeed: 1,
      palette: resolveStyle({}).palette,
      resolveAnchor: NO_ANCHORS,
      kitExtensions: definitions,
    });
    expect(seen).toMatchObject({ kitType: 'group' });
  });

  it('turns contract problems into kit-extension engine errors', async () => {
    const namespace = await fridgeNamespace();
    expect(() => kitExtensionDefinitions([{ ...FRIDGE, name: 'cooler' }], [namespace])).toThrow(
      /prop\.name is "fridge" but the file registers kit\.props\.cooler/,
    );
    try {
      kitExtensionDefinitions([FRIDGE], [{}]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).code).toBe('kit-extension');
    }
  });
});
