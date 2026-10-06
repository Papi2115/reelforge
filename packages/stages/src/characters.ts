/**
 * Characters and mascot plumbing (PLAN.md#12.20, ADR-025): what the storyboard prompt, its
 * validator, the scene-build prompt and the critic get from the project's `characters` / `mascot`
 * and from the roles already built for it (`characters/roles/<id>.json`, built by the roles step,
 * ADR-026; `kit.cast.person('<id>')` resolves them). The classic hero without a mascot (every
 * project made before 2.3.5) gets no variables, so its prompts stay exactly as they were.
 */
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { isWorldStyle } from '@reelforge/kit';
import type { CharacterCheckOptions, CharacterSettings } from '@reelforge/prompts';
import {
  CAST_FILE_ID_PATTERN,
  CAST_ROLES_DIR,
  projectCharacters,
  projectMascot,
  type ProjectFile,
} from '@reelforge/shared';

/** Ids of the roles built for the project (`characters/roles/<id>.json`, sorted). */
export async function builtRoleIds(projectDir: string): Promise<string[]> {
  const directory = path.join(projectDir, ...CAST_ROLES_DIR.split('/'));
  if (!existsSync(directory)) return [];
  return (await readdir(directory))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .filter((id) => CAST_FILE_ID_PATTERN.test(id))
    .sort();
}

/**
 * The project's characters, mascot in effect and built roles (read once per run). A world's style
 * (PLAN.md#13.6) draws its own heroes: no character pack and no mascot, whatever project.json says.
 */
export async function loadCharacterSettings(
  projectDir: string,
  project: Pick<ProjectFile, 'characters' | 'mascot'> & { readonly style?: string | undefined },
): Promise<CharacterSettings> {
  if (isWorldStyle(project.style)) return { characters: 'classic', mascot: 'none', builtRoles: [] };
  const characters = projectCharacters(project);
  return {
    characters,
    mascot: projectMascot(project),
    builtRoles: characters === 'pack' ? await builtRoleIds(projectDir) : [],
  };
}

/** Storyboard validator options: the mascot and role checks of these settings. */
export function storyboardCharacterOptions(settings: CharacterSettings): CharacterCheckOptions {
  return {
    characters: settings.characters,
    mascot: settings.mascot,
    ...(settings.builtRoles === undefined ? {} : { builtRoles: settings.builtRoles }),
  };
}
