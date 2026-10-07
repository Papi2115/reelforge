/**
 * Loads one or more Game B2 asset packs (a film-wide `assets/b2/*.json` plus the shot's own) into
 * the set a view renders with: ids checked (kebab case, unique, never a built-in name), caps
 * (48 sprites, 24 textures, 24 icons), every entry compiled. All errors at once, each naming
 * the pack, the section and the id.
 */
import { ICONS } from '../hud/inventory.js';
import { CEILING_TEXTURES, FLOOR_TEXTURES, SPRITE_KINDS, WALL_TEXTURES } from '../level/schema.js';
import {
  ASSET_ID,
  compileIcon,
  compileSprite,
  compileTexture,
  emptyAssets,
  MAX_PACK_ICONS,
  MAX_PACK_SPRITES,
  MAX_PACK_TEXTURES,
  packSchema,
  type AssetSet,
  type Compiled,
} from './pack.js';

const BUILT_IN = {
  sprites: new Set<string>(SPRITE_KINDS),
  textures: new Set<string>([...WALL_TEXTURES, ...FLOOR_TEXTURES, ...CEILING_TEXTURES, 'none']),
  icons: new Set<string>(ICONS),
} as const;

const CAPS = {
  sprites: MAX_PACK_SPRITES,
  textures: MAX_PACK_TEXTURES,
  icons: MAX_PACK_ICONS,
} as const;
type Section = keyof typeof CAPS;
const SECTIONS: readonly Section[] = ['sprites', 'textures', 'icons'];

function idProblem(section: Section, id: string): string | undefined {
  if (!ASSET_ID.test(id)) return `"${id}" is not a kebab-case id (e.g. oak, river-water, coin-bag)`;
  if (BUILT_IN[section].has(id))
    return `"${id}" is a built-in ${section.slice(0, -1)} name; pick another id`;
  return undefined;
}

function add(
  set: AssetSet,
  section: Section,
  id: string,
  where: string,
  value: unknown,
  errors: string[],
): void {
  const report = <T>(compiled: Compiled<T>, store: (value: T) => void): void => {
    if (compiled.ok) store(compiled.value);
    else errors.push(...compiled.errors);
  };
  if (section === 'sprites')
    report(compileSprite(where, value), (sprite) => set.sprites.set(id, sprite));
  else if (section === 'textures')
    report(compileTexture(where, value), (tex) => set.textures.set(id, tex));
  else report(compileIcon(where, value), (icon) => set.icons.set(id, icon));
}

/** Adds packs to `set` (in order); returns the errors (empty = all loaded). */
export function addPacks(set: AssetSet, input: unknown): string[] {
  const packs = Array.isArray(input) ? input : [input];
  const errors: string[] = [];
  packs.forEach((raw, index) => {
    const name = Array.isArray(input) ? `assets[${String(index)}]` : 'assets';
    const parsed = packSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      errors.push(
        ...parsed.error.issues.map(
          (issue) => `${name}.${issue.path.map(String).join('.')}: ${issue.message}`,
        ),
      );
      return;
    }
    for (const section of SECTIONS)
      for (const [id, value] of Object.entries(parsed.data[section])) {
        const where = `${name}.${section}.${id}`;
        const problem = idProblem(section, id);
        if (problem !== undefined) errors.push(`${where}: ${problem}`);
        else if (set[section].has(id))
          errors.push(`${where}: "${id}" is already defined (ids are unique across packs)`);
        else add(set, section, id, where, value, errors);
      }
  });
  for (const section of SECTIONS)
    if (set[section].size > CAPS[section])
      errors.push(
        `assets: ${String(set[section].size)} ${section}, at most ${String(CAPS[section])} per view`,
      );
  return errors;
}

export type AssetsResult =
  | { readonly ok: true; readonly assets: AssetSet }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Loads packs into a fresh set (`checkAssets` for tools and the CLI). */
export function checkAssets(input: unknown): AssetsResult {
  const set = emptyAssets();
  const errors = addPacks(set, input);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, assets: set };
}

/** Defines one more entry in an existing set (view.defineSprite / defineIcon after build). */
export function defineOne(set: AssetSet, section: Section, id: string, value: unknown): string[] {
  const errors: string[] = [];
  const where = `${section}.${id}`;
  const problem = idProblem(section, id);
  if (problem !== undefined) return [`${where}: ${problem}`];
  if (set[section].has(id)) return [`${where}: "${id}" is already defined`];
  add(set, section, id, where, value, errors);
  if (set[section].size > CAPS[section])
    errors.push(`${where}: at most ${String(CAPS[section])} ${section} per view`);
  return errors;
}
