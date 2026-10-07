/**
 * The Director tab next to Chat (docs/ux/redesign-2.4.md §2.4, U9): every direction feature of
 * the film in one place, each section as switch · status · result · action. Tension curve (summary,
 * mini curve, Edit curve), Story beats (DramaturgySection: surprise moments, questions & answers,
 * wow moments with Accept / Reject / Preview), Editing (EditingSection: cut on the beat, too much
 * of the same), Opening (Hook lab) and this session's Directions (Undo / Redo). The switches are
 * the Project settings rows (option-registry.ts) on one controller, so a toggle writes project.json
 * once with the same commit as Project settings. Without a shot plan: one line with the next step.
 */
import { useEffect, type JSX } from 'react';
import { DramaturgySection } from '../dramaturgy/DramaturgySection.js';
import type { DirectionControls } from '../direction/use-direction.js';
import { EditingSection } from '../editing/EditingSection.js';
import { OPTION_ROWS } from '../project/option-registry.js';
import type { OptionRowId } from '../project/project-settings-view.js';
import {
  useProjectSettings,
  type ProjectSettingsController,
} from '../project/use-project-settings.js';
import type { TensionController } from '../tension/use-tension.js';
import { DIRECTOR_FOOTER, directorEmptyLine, directorSectionId } from './director-view.js';
import {
  DirectionsHistory,
  DirectorBlock,
  OpeningSummary,
  TensionSummary,
} from './DirectorSections.js';
import type { DirectorFocus } from './use-director-tab.js';

export interface DirectorTabProps {
  /** A shot plan exists (else the tab is one empty-state line). */
  readonly hasShots: boolean;
  /** The next step's sentence (stations-view.ts emptyStageHint). */
  readonly nextStep: string | undefined;
  readonly hasScript: boolean;
  /** Changes when reports, the shot plan or project.json change (sections read again). */
  readonly refreshKey: string;
  readonly tension: TensionController;
  readonly durationS: number;
  /** Timed words exist: the curve editor can open. */
  readonly canEditCurve: boolean;
  readonly onEditCurve: () => void;
  readonly direction: DirectionControls;
  readonly onSeekShot: (shotId: string, t: number) => void;
  readonly focus: DirectorFocus | null;
}

/** The shared option row `id` (Loading… until the settings are read). */
function Switch(props: {
  readonly id: OptionRowId;
  readonly controller: ProjectSettingsController;
}): JSX.Element {
  const { settings, looks, update } = props.controller;
  if (settings === undefined) return <p className="muted">Loading…</p>;
  const Row = OPTION_ROWS[props.id];
  return (
    <div className="director-switch">
      <Row settings={settings} looks={looks} update={update} />
    </div>
  );
}

export function DirectorTab(props: DirectorTabProps): JSX.Element {
  return (
    <div className="director" role="region" aria-label="Director">
      {props.hasShots ? (
        <DirectorBody {...props} />
      ) : (
        <p className="director-empty" data-testid="director-empty">
          {directorEmptyLine(props.nextStep)}
        </p>
      )}
    </div>
  );
}

function DirectorBody(props: DirectorTabProps): JSX.Element {
  const controller = useProjectSettings();
  const focusNonce = props.focus?.nonce;
  const focusSection = props.focus?.section;
  useEffect(() => {
    if (focusSection === undefined) return;
    document
      .getElementById(directorSectionId(focusSection))
      ?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [focusSection, focusNonce]);

  return (
    <>
      <DirectorBlock section="tension">
        <Switch id="tension-map" controller={controller} />
        <TensionSummary
          tension={props.tension}
          durationS={props.durationS}
          canEdit={props.canEditCurve}
          onEdit={props.onEditCurve}
        />
      </DirectorBlock>
      <DirectorBlock section="beats">
        <Switch id="dramaturgy" controller={controller} />
        <DramaturgySection refreshKey={props.refreshKey} onSeekShot={props.onSeekShot} />
      </DirectorBlock>
      <DirectorBlock section="editing">
        <Switch id="editing" controller={controller} />
        <EditingSection refreshKey={props.refreshKey} onSeekShot={props.onSeekShot} />
      </DirectorBlock>
      <DirectorBlock section="opening">
        <OpeningSummary hasScript={props.hasScript} refresh={props.refreshKey} />
      </DirectorBlock>
      <DirectorBlock section="directions">
        <DirectionsHistory controls={props.direction} />
      </DirectorBlock>
      {controller.error !== undefined && (
        <p className="connect-error" role="alert">
          {controller.error}
        </p>
      )}
      <p className="director-footer muted">{DIRECTOR_FOOTER}</p>
    </>
  );
}
