/**
 * Project props of a manifest (`kitExtensions`, PLAN.md#7.4): imported in the sandbox before any
 * scene, checked against the prop contract and turned into kit registry definitions that every
 * shot's kit registers as `ctx.kit.props.<name>` (ADR-007).
 */
import {
  checkExtensionNames,
  KitError,
  PROP_DEFINITIONS,
  propDefinitionFromModule,
  type KitDefinition,
} from '@reelforge/kit';
import type { KitExtensionSource } from '@reelforge/shared';
import { EngineError } from './errors.js';

export type KitExtensionImporter = (extension: KitExtensionSource) => Promise<unknown>;

function asEngineError(error: unknown): unknown {
  return error instanceof KitError
    ? new EngineError('kit-extension', error.message, { cause: error })
    : error;
}

/** One definition per extension, in manifest order; throws a `kit-extension` EngineError. */
export function kitExtensionDefinitions(
  extensions: readonly KitExtensionSource[],
  namespaces: readonly unknown[],
): KitDefinition[] {
  try {
    const definitions = extensions.map((extension, index) => {
      const definition = propDefinitionFromModule(namespaces[index], extension.file);
      if (definition.name !== extension.name) {
        throw new KitError(
          'invalid-extension',
          `${extension.file}: prop.name is "${definition.name}" but the file registers kit.props.${extension.name}; make them equal`,
        );
      }
      return definition;
    });
    checkExtensionNames(
      PROP_DEFINITIONS.map((definition) => definition.name),
      definitions,
    );
    return definitions;
  } catch (error) {
    throw asEngineError(error);
  }
}

export async function loadKitExtensions(
  extensions: readonly KitExtensionSource[],
  importer: KitExtensionImporter,
): Promise<KitDefinition[]> {
  const namespaces = await Promise.all(extensions.map((extension) => importer(extension)));
  return kitExtensionDefinitions(extensions, namespaces);
}
