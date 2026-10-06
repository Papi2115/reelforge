/**
 * The workspace's modal dialogs: the Assets dialog and the export dialog with its pre-flight of the
 * ⚠ / ✗ shots (final-review-view.ts; a shot there closes the dialog and goes to the shot).
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { JSX } from 'react';
import type { StageReports } from '../../shared/voiceover-contract.js';
import { AssetsDialog } from '../assets/AssetsDialog.js';
import type { AssetsController } from '../assets/use-assets.js';
import { ExportDialog } from '../export/ExportDialog.js';
import { exportPreflight, type Preflight } from '../stages/final-review-view.js';

/** What the export pre-flight reads. */
export interface PreflightSources {
  readonly reports: StageReports | undefined;
  readonly shots: readonly StoryboardShot[];
  /** Shots with a scene file on disk (scenes-view.ts builtShotIds). */
  readonly built: ReadonlySet<string>;
}

export interface WorkspaceDialogsProps {
  readonly dir: string;
  readonly playhead: number;
  /** The Assets dialog is open. */
  readonly assets: AssetsController | null;
  readonly onCloseAssets: (open: false) => void;
  readonly exportOpen: boolean;
  readonly onCloseExport: (open: false) => void;
  readonly project: PreflightSources;
  readonly onSeekShot: (shotId: string, t: number) => void;
}

/** The ⚠ / ✗ shots before the export (also the "Needs you" shot items). */
export function shotsPreflight({ reports, shots, built }: PreflightSources): Preflight {
  return exportPreflight(reports?.finalReview ?? null, reports?.scenes ?? null, shots, built);
}

export function WorkspaceDialogs(props: WorkspaceDialogsProps): JSX.Element {
  return (
    <>
      {props.assets !== null && (
        <AssetsDialog
          assets={props.assets}
          onClose={() => {
            props.onCloseAssets(false);
          }}
        />
      )}
      {props.exportOpen && (
        <ExportDialog
          dir={props.dir}
          playhead={props.playhead}
          preflight={shotsPreflight(props.project)}
          onSeekShot={(shotId, t) => {
            props.onCloseExport(false);
            props.onSeekShot(shotId, t);
          }}
          onClose={() => {
            props.onCloseExport(false);
          }}
        />
      )}
    </>
  );
}
