/**
 * Asset ids a world scene refers to that nobody defines (PLAN.md#13.15 phase 2): read from the
 * scene source without running it, against the project's world assets, what the scene defines
 * itself and the world's built-ins. Sketchbook `use('id')` / `like:` / `holds:`, Comic
 * `art.draw(g, 'id')` and `{ shape: 'use', id }`, Game B1 `g.draw` / `g.box` / `g.field` /
 * `screen.interior`, Game B2 the level's sprites / walls / floors / ceilings (`checkLevel` with
 * the film's ids) and `icon: 'id'`. One message per id, the same in `reelforge validate`,
 * `reelforge world-assets check` and the scene QA.
 */
import { parse, type AnyNode } from 'acorn';
import type { WorldAssetSet } from '@reelforge/engine';
import {
  b1SceneRefs,
  checkLevel,
  GAME_B2_ICONS,
  sketchAssetFindings,
  unknownComicArtIds,
} from '@reelforge/kit';
import { worldAssetsDir, type WorldAssetWorld } from '@reelforge/shared';
import { levelsInScene } from './level-source.js';

export interface WorldAssetRef {
  readonly id: string;
  /** 1-based line of the first use (undefined: inside a level the scene builds). */
  readonly line: number | undefined;
  readonly message: string;
}

const BUILT_IN_HINT: Readonly<Record<WorldAssetWorld, string>> = {
  sketchbook: 'or draw a built-in with page.draw(kind, …) / page.person({ … })',
  comic: 'or use a built-in generator (art.person, art.tree, art.animal, …)',
  'game-b2': 'or a built-in name (reelforge validate level lists them)',
  'game-b1': 'or define it in the scene (screen.defineSprite / generate)',
};

function notDefined(world: WorldAssetWorld, id: string, line: number | undefined): WorldAssetRef {
  const where = line === undefined ? '' : `line ${String(line)}: `;
  return {
    id,
    line,
    message: `${where}asset "${id}" is not defined: define it in ${worldAssetsDir(world)}/<file>.json ${BUILT_IN_HINT[world]}`,
  };
}

/** Line of the first string literal `id` in the source. */
function lineOf(source: string, id: string): number | undefined {
  const match = new RegExp(`['"]${id.replace(/[-]/g, '\\-')}['"]`).exec(source);
  return match === null ? undefined : source.slice(0, match.index).split('\n').length;
}

function unique(refs: readonly WorldAssetRef[]): WorldAssetRef[] {
  const seen = new Set<string>();
  const out: WorldAssetRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    out.push(ref);
  }
  return out;
}

function nodeKey(node: AnyNode): string | undefined {
  if (node.type !== 'Property' || node.computed) return undefined;
  if (node.key.type === 'Identifier') return node.key.name;
  return node.key.type === 'Literal' ? String(node.key.value) : undefined;
}

/** Keys of every `sprites: { … }` / `textures: { … }` / `icons: { … }` object literal. */
function inlineB2Ids(source: string): Record<'sprites' | 'textures' | 'icons', Set<string>> {
  const found = {
    sprites: new Set<string>(),
    textures: new Set<string>(),
    icons: new Set<string>(),
  };
  let program: AnyNode;
  try {
    program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch (error) {
    if (error instanceof SyntaxError) return found;
    throw error;
  }
  const visit = (node: AnyNode): void => {
    const key = nodeKey(node);
    if (
      node.type === 'Property' &&
      (key === 'sprites' || key === 'textures' || key === 'icons') &&
      node.value.type === 'ObjectExpression'
    ) {
      for (const entry of node.value.properties) {
        const id = nodeKey(entry);
        if (id !== undefined) found[key].add(id);
      }
    }
    for (const value of Object.values(node)) {
      const children: unknown[] = Array.isArray(value) ? value : [value];
      for (const child of children) {
        if (typeof child === 'object' && child !== null && 'type' in child && 'start' in child) {
          visit(child as AnyNode);
        }
      }
    }
  };
  visit(program);
  for (const match of source.matchAll(/define(Sprite|Icon)\(\s*['"]([^'"]+)['"]/g)) {
    found[match[1] === 'Icon' ? 'icons' : 'sprites'].add(match[2] ?? '');
  }
  return found;
}

/**
 * Game B2 ids a level of `source` may name (`checkLevel(level, ids)`): the project's sprites and
 * textures plus the ones the scene defines itself (`source` empty for a level JSON file).
 */
export function b2LevelIds(
  source: string,
  set: WorldAssetSet | undefined,
): { sprites: Set<string>; textures: Set<string> } {
  const own = inlineB2Ids(source);
  const of = (kind: 'sprites' | 'textures'): Set<string> =>
    new Set([...(set?.world === 'game-b2' ? (set.ids.byKind[kind] ?? []) : []), ...own[kind]]);
  return { sprites: of('sprites'), textures: of('textures') };
}

function b2Refs(source: string, set: WorldAssetSet): WorldAssetRef[] {
  const own = inlineB2Ids(source);
  const ids = (kind: 'sprites' | 'textures' | 'icons'): Set<string> =>
    new Set([...(set.ids.byKind[kind] ?? []), ...own[kind]]);
  const icons = new Set<string>([...ids('icons'), ...GAME_B2_ICONS]);
  const refs: WorldAssetRef[] = [];
  for (const match of source.matchAll(/\bicon:\s*['"]([a-z][a-z0-9-]*)['"]/g)) {
    const id = match[1] ?? '';
    if (!icons.has(id))
      refs.push(notDefined('game-b2', id, source.slice(0, match.index).split('\n').length));
  }
  const levels = levelsInScene(source);
  if (!levels.ok) return refs;
  for (const level of levels.levels) {
    if (level.kind === 'object') {
      refs.push(...unknownLevelIds(level.value, level.line, ids('sprites'), ids('textures')));
    }
  }
  return refs;
}

/** `checkLevel` names one category at a time: assume each unknown id and check again. */
const UNKNOWN_NAME = /unknown (sprite|wall texture|floor texture|ceiling texture) "([^"]+)"/g;
const MAX_ROUNDS = 12;

function unknownLevelIds(
  level: unknown,
  line: number,
  sprites: Set<string>,
  textures: Set<string>,
): WorldAssetRef[] {
  const refs: WorldAssetRef[] = [];
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const check = checkLevel(level, { sprites, textures });
    const found = check.ok
      ? []
      : check.errors.flatMap((error) => [...error.matchAll(UNKNOWN_NAME)]);
    const fresh = found.filter(([, , id = '']) => !sprites.has(id) && !textures.has(id));
    if (fresh.length === 0) return refs;
    for (const [, kind = '', id = ''] of fresh) {
      (kind === 'sprite' ? sprites : textures).add(id);
      refs.push({
        id,
        line,
        message: `${notDefined('game-b2', id, line).message} (the level uses it as a ${kind})`,
      });
    }
  }
  return refs;
}

function b1Refs(source: string, set: WorldAssetSet): WorldAssetRef[] {
  const refs = b1SceneRefs(source);
  const defined = new Set(refs.defines);
  const known = (kind: string): Set<string> =>
    new Set([...(set.ids.byKind[kind] ?? []), ...defined]);
  const kinds = [
    ['sprites', refs.uses.sprites],
    ['playfields', refs.uses.playfields],
    ['rooms', refs.uses.rooms],
  ] as const;
  return kinds.flatMap(([kind, used]) => {
    const ids = known(kind);
    return used
      .filter((id) => !ids.has(id))
      .map((id) => notDefined('game-b1', id, lineOf(source, id)));
  });
}

/** Ids `source` uses that neither the project's world assets nor the scene define. */
export function unknownWorldAssetRefs(source: string, set: WorldAssetSet): WorldAssetRef[] {
  switch (set.world) {
    case 'sketchbook':
      return unique(
        sketchAssetFindings(source, [...set.ids.all]).map((finding) =>
          notDefined('sketchbook', finding.id, finding.line),
        ),
      );
    case 'comic':
      return unique(
        unknownComicArtIds(source, set.ids.all).map((entry) =>
          notDefined('comic', entry.id, entry.line),
        ),
      );
    case 'game-b2':
      return unique(b2Refs(source, set));
    case 'game-b1':
      return unique(b1Refs(source, set));
  }
}
