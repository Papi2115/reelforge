/**
 * Project modules of a manifest (`kitExtensions`): imported in the sandbox before any scene and
 * checked against their contracts. Props (PLAN.md#7.4) become kit registry definitions that every
 * shot's kit registers as `ctx.kit.props.<name>` (ADR-007); the Grim Ink world's people and
 * places (PLAN.md#14.8, `kind` `people` / `places`) become the `kit.people` / `kit.places`
 * handles of that world's shots.
 */
import {
  C_CAM_ID,
  checkExtensionNames,
  KitError,
  personFromModule,
  placeFromModule,
  PROP_DEFINITIONS,
  propDefinitionFromModule,
  type InkModules,
  type KitDefinition,
} from '@reelforge/kit';
import { kitExtensionKind, type KitExtensionSource, type RenderManifest } from '@reelforge/shared';
import { EngineError } from './errors.js';

export type KitExtensionImporter = (extension: KitExtensionSource) => Promise<unknown>;

/** Everything a shot's kit registers from the project's modules. */
export interface ProjectKitModules {
  /** Project props (`kit.props.<name>`). */
  readonly kitExtensions: readonly KitDefinition[];
  /** People and places (`kit.people` / `kit.places`, c-cam shots only). */
  readonly inkModules: InkModules;
}

function asEngineError(error: unknown): unknown {
  return error instanceof KitError
    ? new EngineError('kit-extension', error.message, { cause: error })
    : error;
}

/** One definition per prop module, in manifest order; throws a `kit-extension` EngineError. */
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

function checkId(extension: KitExtensionSource, id: string, label: string): void {
  if (id !== extension.name) {
    throw new KitError(
      'invalid-extension',
      `${extension.file}: ${label}.id is "${id}" but the file registers kit.${extension.kind ?? 'props'}.${extension.name}; make them equal`,
    );
  }
}

/** People and places of `extensions` (any kinds, others skipped); throws `kit-extension`. */
export function inkModuleHandles(
  extensions: readonly KitExtensionSource[],
  namespaces: readonly unknown[],
): InkModules {
  try {
    const people = [];
    const places = [];
    for (const [index, extension] of extensions.entries()) {
      const kind = kitExtensionKind(extension);
      if (kind === 'people') {
        const person = personFromModule(namespaces[index], extension.file);
        checkId(extension, person.id, 'person');
        people.push(person);
      } else if (kind === 'places') {
        const place = placeFromModule(namespaces[index], extension.file);
        checkId(extension, place.id, 'place');
        places.push(place);
      }
    }
    return Object.freeze({ people, places });
  } catch (error) {
    throw asEngineError(error);
  }
}

/** Imports the prop modules of `extensions` (other kinds are skipped). */
export async function loadKitExtensions(
  extensions: readonly KitExtensionSource[],
  importer: KitExtensionImporter,
): Promise<KitDefinition[]> {
  const props = extensions.filter((extension) => kitExtensionKind(extension) === 'props');
  const namespaces = await Promise.all(props.map((extension) => importer(extension)));
  return kitExtensionDefinitions(props, namespaces);
}

/**
 * Imports every project module of the manifest once: the props always, the people and places
 * only for the Grim Ink style (`styleId` = the resolved style; elsewhere nothing reads them).
 */
export async function loadProjectModules(
  manifest: Pick<RenderManifest, 'kitExtensions'>,
  styleId: string,
  importer: KitExtensionImporter,
): Promise<ProjectKitModules> {
  const extensions = manifest.kitExtensions ?? [];
  const ink =
    styleId === C_CAM_ID
      ? extensions.filter((extension) => kitExtensionKind(extension) !== 'props')
      : [];
  const [kitExtensions, namespaces] = await Promise.all([
    loadKitExtensions(extensions, importer),
    Promise.all(ink.map((extension) => importer(extension))),
  ]);
  return { kitExtensions, inkModules: inkModuleHandles(ink, namespaces) };
}
