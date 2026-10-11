/**
 * Resuming the people-and-places step after it stopped before its report was saved (real run
 * Grim Ink 2: a limit guard stopped the step after 7 of 8 modules). Every module is committed alone
 * ("Person <id> built ✓", builder.ts), so a module file whose newest commit says it was built clean
 * is taken back as built (no new turn); anything else (a placeholder, ⚠, a file a stopped turn
 * left uncommitted) is built again as before.
 */
import { history, type GitOptions } from '@reelforge/project';
import { kitExtensionFile, type InkModuleRecord } from '@reelforge/shared';
import { nounOf } from './builder.js';
import { designBrief, type InkModuleDesign } from './design.js';

/** Enough for a film's module commits next to its scene and turn commits. */
const HISTORY_LIMIT = 500;

export const RECOVERED_NOTE =
  'recovered from the git history: the step stopped before its report was saved';

/**
 * Records for the designs without one in the report whose newest commit touching their file is
 * "<Noun> <id> built ✓". Git problems recover nothing (the modules are simply built again).
 */
export async function recoverBuiltModules(
  projectDir: string,
  designs: readonly InkModuleDesign[],
  reported: readonly InkModuleRecord[],
  git: GitOptions | undefined,
): Promise<InkModuleRecord[]> {
  const missing = designs.filter((design) => {
    const file = kitExtensionFile(design.kind, design.id);
    return !reported.some((entry) => entry.file === file);
  });
  if (missing.length === 0) return [];
  const log = await history(projectDir, {
    limit: HISTORY_LIMIT,
    ...(git === undefined ? {} : { git }),
  });
  if (!log.ok) return [];
  const recovered: InkModuleRecord[] = [];
  for (const design of missing) {
    const file = kitExtensionFile(design.kind, design.id);
    const newest = log.value.find((entry) => entry.files.some((change) => change.path === file));
    if (newest?.subject !== `${nounOf(design)} ${design.id} built ✓`) continue;
    recovered.push({
      kind: design.kind,
      id: design.id,
      status: 'built',
      file,
      brief: designBrief(design),
      shots: design.shots.map((shot) => shot.id),
      attempts: 0,
      findings: [],
      notes: [RECOVERED_NOTE],
      updatedAt: newest.time,
    });
  }
  return recovered;
}
