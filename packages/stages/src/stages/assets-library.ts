/**
 * Downloaded assets into the global asset library (PLAN.md#12.19, ADR-015): after the Assets stage
 * fetched something, the assets the user approved (ask mode) or with a verified licence are saved
 * to the library when the app setting "save downloaded assets" is on, so other projects can use
 * them without downloading again. Unverified automatic downloads stay out unless the user adds
 * them in the app. Failures only warn: the project keeps its assets either way.
 */
import { addToLibrary, describeUnknown } from '@reelforge/cli/assets';
import type { AssetRecord } from '@reelforge/shared';
import type { StageContext, StageSummary } from '../types.js';

export interface LibrarySave {
  readonly saved: number;
  readonly warnings: readonly string[];
}

/** Records the library takes automatically: approved by the user or with a verified licence. */
export function autoLibraryRecords(records: readonly AssetRecord[]): AssetRecord[] {
  return records.filter(
    (record) => record.source !== 'own' && (record.approved || record.licence.verified),
  );
}

export async function saveDownloadsToLibrary(
  ctx: StageContext,
  records: readonly AssetRecord[],
): Promise<LibrarySave> {
  const library = ctx.assets?.library;
  if (library === undefined || !library.saveDownloaded()) return { saved: 0, warnings: [] };
  let saved = 0;
  const warnings: string[] = [];
  for (const record of autoLibraryRecords(records)) {
    try {
      const outcome = await addToLibrary(library.dir, {
        projectRoot: ctx.projectDir,
        record,
        now: () => ctx.now(),
      });
      if (!outcome.existing) saved += 1;
    } catch (error) {
      warnings.push(`${record.id}: not saved to the asset library (${describeUnknown(error)})`);
    }
  }
  return { saved, warnings };
}

/** The summary with the library result (metric `savedToLibrary`, warnings appended). */
export function withLibrarySave(summary: StageSummary, save: LibrarySave): StageSummary {
  if (save.saved === 0 && save.warnings.length === 0) return summary;
  return {
    ...summary,
    warnings: [...summary.warnings, ...save.warnings],
    metrics: { ...summary.metrics, savedToLibrary: save.saved },
  };
}
