/**
 * The film's own assets inside one `kit.fx.b2View` (PLAN.md#13.15): the packs given as
 * `assets` (loaded before the level is checked, so the level may use their ids), plus sprites and
 * icons defined later with `view.defineSprite` / `view.defineIcon` (for `place`, the hand and the
 * HUD). Textures must come with `assets`: the level compiles when the view is built.
 */
import { emptyAssets, type AssetSet } from '../assets/pack.js';
import { addPacks, defineOne } from '../assets/registry.js';
import type { KnownAssets } from '../level/schema.js';
import type { ItemArt } from '../ray/sprites-props.js';

export interface ViewAssets {
  readonly set: AssetSet;
  /** The ids the level checks accept (live: later definitions count too). */
  readonly known: KnownAssets;
}

/** Loads `assets` (one pack or a list); throws through `fail` with every error. */
export function loadViewAssets(input: unknown, fail: (message: string) => never): ViewAssets {
  const set = emptyAssets();
  if (input !== undefined) {
    const errors = addPacks(set, input);
    if (errors.length > 0) fail(`assets are invalid:\n- ${errors.join('\n- ')}`);
  }
  return { set, known: { sprites: set.sprites, textures: set.textures } };
}

/** `view.defineSprite` / `view.defineIcon`. */
export function defineAsset(
  assets: ViewAssets,
  section: 'sprites' | 'icons',
  id: string,
  spec: unknown,
  fail: (message: string) => never,
): void {
  const errors = defineOne(assets.set, section, id, spec);
  if (errors.length > 0) fail(`define ${section.slice(0, -1)}: ${errors.join('; ')}`);
}

function contentHash(bytes: Uint8Array): string {
  let h = 2166136261;
  for (const byte of bytes) h = Math.imul(h ^ byte, 16777619);
  return (h >>> 0).toString(36);
}

/** A project icon as an item look's art (key = id + pixels, so caches never mix two films). */
export function artOf(assets: AssetSet, id: string): ItemArt | undefined {
  const bmp = assets.icons.get(id);
  return bmp === undefined ? undefined : { key: `${id}:${contentHash(bmp.d)}`, bmp };
}

/** A sprite `view.act` can drive: the clerk or a generated / 4-frame person. */
export function isPerson(assets: ViewAssets, sprite: string): boolean {
  return sprite === 'clerk' || assets.set.sprites.get(sprite)?.person === true;
}
