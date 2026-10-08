/**
 * The workspace's left column (Workspace.tsx): file problems, the pipeline sidebar, the shot
 * notice and the Shots panel with its badges, locks, variants, directions and the voice timing a
 * sentence redo left out of date ("Re-time").
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { JSX } from 'react';
import type { StageRunView } from '../../shared/stages-contract.js';
import type { StageReports } from '../../shared/voiceover-contract.js';
import { directionSummary } from '../direction/direction-view.js';
import type { DirectionControls } from '../direction/use-direction.js';
import { lockableOkShots, outOfSyncLocked } from '../stages/locks-view.js';
import {
  buildProgress,
  joinBanners,
  propsBanner,
  propsSummary,
  rolesBanner,
  type ShotBadge,
} from '../stages/scenes-view.js';
import { stationFacts } from '../stages/stations-view.js';
import type { ShotLocks } from '../stages/use-shot-locks.js';
import type { StagesControls } from '../stages/use-stages.js';
import type { VariantsDock } from '../stages/use-variants-dock.js';
import { voiceChangedShots } from '../stages/voice-timing-view.js';
import { VoiceTimingNotice } from '../stages/VoiceTimingNotice.js';
import { FileProblemsBanner } from './FileProblemsBanner.js';
import { openStageTarget, type StageOpeners } from './open-stage.js';
import { PipelineSidebar } from './PipelineSidebar.js';
import { ShotsPanel } from './ShotsPanel.js';
import type { ProjectData } from './use-project-snapshot.js';

export interface WorkspaceLeftProps {
  readonly dir: string;
  readonly error: string | undefined;
  readonly snapshot: ProjectData['snapshot'];
  readonly reload: ProjectData['reload'];
  readonly stages: StagesControls;
  readonly reports: StageReports | undefined;
  readonly shots: readonly StoryboardShot[];
  readonly built: ReadonlySet<string>;
  readonly badges: ReadonlyMap<string, ShotBadge>;
  readonly running: StageRunView | null;
  readonly scenesBusy: boolean;
  readonly openers: StageOpeners;
  readonly onOpenToolsSettings: (() => void) | undefined;
  readonly onBrief: () => void;
  /** Why the last shot action did not start (shown before a lock notice). */
  readonly notice: string | undefined;
  readonly locks: ShotLocks;
  readonly selectedShotId: string | undefined;
  readonly time: number;
  readonly onSelect: (shot: StoryboardShot) => void;
  readonly runScenes: (action: 'build' | 'sync-check', shotId: string) => void;
  readonly variants: VariantsDock;
  readonly direction: DirectionControls;
  readonly onFix: (shotId: string) => void;
}

export function WorkspaceLeft(props: WorkspaceLeftProps): JSX.Element {
  const { dir, error, snapshot, reload, stages, reports, shots, built, badges, running } = props;
  const { openers, onOpenToolsSettings, onBrief, notice, locks, variants, direction } = props;
  const { runScenes } = props;
  return (
    <div className="left-stack">
      {error !== undefined && (
        <p className="panel-error banner" role="alert">
          {error}
        </p>
      )}
      <FileProblemsBanner
        dir={dir}
        problems={snapshot?.problems ?? []}
        onRepaired={() => {
          void reload();
        }}
      />
      <PipelineSidebar
        stages={stages}
        facts={stationFacts(reports?.scenes ?? null, shots, built)}
        onOpen={(target) => {
          openStageTarget(target, openers);
        }}
        {...(onOpenToolsSettings === undefined ? {} : { onOpenSettings: onOpenToolsSettings })}
        onBrief={onBrief}
      />
      {(notice ?? locks.notice) !== undefined && (
        <p className="panel-error banner" role="alert">
          {notice ?? locks.notice}
        </p>
      )}
      <ShotsPanel
        storyboard={snapshot?.storyboard}
        selectedId={props.selectedShotId}
        time={props.time}
        onSelect={props.onSelect}
        badges={badges}
        built={built}
        progress={buildProgress(running, shots.length)}
        propsBanner={joinBanners(
          propsBanner(propsSummary(reports?.scenes ?? null, reports?.props ?? null)),
          rolesBanner(reports?.roles ?? null),
        )}
        actionsBlocked={props.scenesBusy ? 'Scenes built is running or queued.' : null}
        onRebuild={(shotId) => {
          runScenes('build', shotId);
        }}
        locked={locks.locked}
        outOfSync={outOfSyncLocked(
          locks.locked,
          reports?.sync ?? null,
          reports?.finalReview ?? null,
        )}
        lockable={lockableOkShots(shots, badges, locks.locked)}
        onLock={(shotIds, lock) => {
          void locks.setLocked(shotIds, lock);
        }}
        onVariants={variants.open}
        withVariants={variants.withVariants}
        directed={direction.directed}
        directionSummary={(shotId) => directionSummary(direction.directions?.shots[shotId])}
        voiceChanged={voiceChangedShots(reports?.voiceTiming)}
        voiceNotice={
          <VoiceTimingNotice
            timing={reports?.voiceTiming}
            stages={stages}
            className="shots-banner"
          />
        }
        onUnlockAndFix={(shotId) => {
          void locks.setLocked([shotId], false).then((unlocked) => {
            if (unlocked) runScenes('sync-check', shotId);
          });
        }}
        onFix={props.onFix}
      />
    </div>
  );
}
