/**
 * Project-local kit extensions (PLAN.md#7.4, ADR-007): props the runtime Claude builds inside a
 * video project as `kit-ext/props/<name>.js` when the kit lacks one. The engine loads them in the
 * sandbox before the scenes and registers them as `ctx.kit.props.<name>`; the project keeps a
 * record of every prop build in `.reelforge/props-report.json`.
 */
import { z } from 'zod';

/** Project-relative folder of the prop modules (forward slashes). */
export const KIT_EXT_PROPS_DIR = 'kit-ext/props';

/** camelCase, starts with a letter, at most 40 characters: `kit.props.<name>`. */
export const PROP_NAME_PATTERN = /^[a-z][A-Za-z0-9]{0,39}$/;

export const propNameSchema = z
  .string()
  .regex(PROP_NAME_PATTERN, 'prop names are camelCase identifiers, e.g. "fridge" or "fileIcon"');

/** `kit-ext/props/<name>.js`. */
export function propExtensionFile(name: string): string {
  return `${KIT_EXT_PROPS_DIR}/${name}.js`;
}

/** The prop name of a project-relative path `kit-ext/props/<name>.js`, else undefined. */
export function propNameOfFile(file: string): string | undefined {
  const match = /^kit-ext\/props\/([^/]+)\.js$/.exec(file.replaceAll('\\', '/'));
  const name = match?.[1];
  return name !== undefined && PROP_NAME_PATTERN.test(name) ? name : undefined;
}

/**
 * A free-form prop name (`file-icon`, `Z80 chip`, `lodówka`, `USB hub`) as a camelCase kit name
 * (`fileIcon`, `z80Chip`, `lodowka`, `usbHub`); undefined when nothing usable is left.
 */
export function normalizePropName(raw: string): string | undefined {
  const words = raw
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll('ł', 'l')
    .replaceAll('Ł', 'L')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase());
  // A leading number moves to the end: "3d printer" -> "printer3d".
  const start = words.findIndex((word) => /^[a-z]/.test(word));
  if (start === -1) return undefined;
  const ordered = [...words.slice(start), ...words.slice(0, start)];
  const name = ordered
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
  return PROP_NAME_PATTERN.test(name) ? name : undefined;
}

/**
 * Kinds of project modules (PLAN.md#14.8): `props` (`kit.props.<name>`, every style), `people`
 * and `places` (`kit.people.<id>` / `kit.places.<id>`, the Grim Ink world's hand-built people and
 * places, see ink-modules.ts) and `lib` (`kit.lib.<name>`, PLAN.md#14.19: the Grim Ink film's
 * shared code, pure functions used by its scenes, people and places). Each kind has its own
 * folder under `kit-ext/`.
 */
export const KIT_EXTENSION_KINDS = ['props', 'people', 'places', 'lib'] as const;
export const kitExtensionKindSchema = z.enum(KIT_EXTENSION_KINDS);
export type KitExtensionKind = z.infer<typeof kitExtensionKindSchema>;

/** Project-relative folders of the people / place modules (forward slashes). */
export const KIT_EXT_PEOPLE_DIR = 'kit-ext/people';
export const KIT_EXT_PLACES_DIR = 'kit-ext/places';
export const KIT_EXT_LIB_DIR = 'kit-ext/lib';

export const KIT_EXTENSION_DIRS: Readonly<Record<KitExtensionKind, string>> = Object.freeze({
  props: KIT_EXT_PROPS_DIR,
  people: KIT_EXT_PEOPLE_DIR,
  places: KIT_EXT_PLACES_DIR,
  lib: KIT_EXT_LIB_DIR,
});

/** `kit-ext/<kind>/<name>.js`. */
export function kitExtensionFile(kind: KitExtensionKind, name: string): string {
  return `${KIT_EXTENSION_DIRS[kind]}/${name}.js`;
}

/** Kind and name of a project-relative module path `kit-ext/<kind>/<name>.js`, else undefined. */
export function kitExtensionOfFile(
  file: string,
): { readonly kind: KitExtensionKind; readonly name: string } | undefined {
  const match = /^kit-ext\/(props|people|places|lib)\/([^/]+)\.js$/.exec(
    file.replaceAll('\\', '/'),
  );
  const kind = kitExtensionKindSchema.safeParse(match?.[1]);
  const name = match?.[2];
  return kind.success && name !== undefined && PROP_NAME_PATTERN.test(name)
    ? { kind: kind.data, name }
    : undefined;
}

/** One project module inlined into a render manifest (the engine never reads the disk). */
export const kitExtensionSchema = z.object({
  name: propNameSchema,
  /** Project-relative path, e.g. `kit-ext/props/fridge.js` (messages, stack traces). */
  file: z.string().min(1),
  /** ES module source text. */
  source: z.string().min(1),
  /** Module kind; absent = `props` (every manifest made before PLAN.md#14.8). */
  kind: kitExtensionKindSchema.optional(),
});
export type KitExtensionSource = z.infer<typeof kitExtensionSchema>;

/** The kind of a manifest module (absent = `props`). */
export function kitExtensionKind(extension: {
  readonly kind?: KitExtensionKind | undefined;
}): KitExtensionKind {
  return extension.kind ?? 'props';
}

export const PROPS_REPORT_VERSION = 1;

/** `built`: passed QA and is used by scenes; `failed`: QA failed (the file was moved aside). */
export const propBuildStatusSchema = z.enum(['built', 'failed']);
export type PropBuildStatus = z.infer<typeof propBuildStatusSchema>;

export const propBuildRecordSchema = z.object({
  name: propNameSchema,
  status: propBuildStatusSchema,
  /** Project-relative module path (`kit-ext/props/<name>.js`). */
  file: z.string().min(1),
  /** What the prop must look like (from the storyboard / the request). */
  description: z.string(),
  /** Shots that asked for it (storyboard ids). */
  shots: z.array(z.string().min(1)),
  /** prop-build turns run (build + fixes). */
  attempts: z.int().nonnegative(),
  /** Project-relative turntable contact sheet of the last QA round. */
  sheet: z.string().optional(),
  /** Problems left after the last QA round (empty when built). */
  findings: z.array(z.string()),
  notes: z.array(z.string()),
  updatedAt: z.iso.datetime(),
});
export type PropBuildRecord = z.infer<typeof propBuildRecordSchema>;

/** `.reelforge/props-report.json`: every prop built (or attempted) for this project. */
export const propsReportSchema = z.object({
  version: z.literal(PROPS_REPORT_VERSION),
  updatedAt: z.iso.datetime(),
  props: z.array(propBuildRecordSchema),
});
export type PropsReport = z.infer<typeof propsReportSchema>;
