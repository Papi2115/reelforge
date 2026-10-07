/**
 * Storyboard step, docked under the preview (Open of the Storyboard row; the Shots panel is focused
 * too): the Hook lab entry, where the shots are, and "All options" — scenes per minute, dramaturgy,
 * continuity links and the tension map, the switches that steer the next Storyboard run.
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { JSX } from 'react';
import { plural } from '../../shared/plural.js';
import { HookLabButton } from '../hook-lab/HookLab.js';
import { OptionsSection } from '../options/OptionsSection.js';

export interface StoryboardPanelProps {
  readonly shots: readonly StoryboardShot[];
  /** The project listing: the Hook lab needs a script. */
  readonly files: readonly string[];
  readonly onClose: () => void;
}

function storyboardSummary(shotCount: number): string {
  return shotCount === 0
    ? 'No shots yet. Run the Storyboard step: the shots appear in the Shots panel.'
    : `${plural(shotCount, 'shot')} planned. They are listed in the Shots panel: select one to see it in the preview.`;
}

export function StoryboardPanel(props: StoryboardPanelProps): JSX.Element {
  return (
    <section className="doc-panel docked storyboard-panel" aria-label="Storyboard">
      <div className="doc-header">
        <h2 className="doc-title">Storyboard</h2>
        <HookLabButton disabled={!props.files.includes('script.txt')} />
        <button type="button" className="small-button" onClick={props.onClose}>
          Back to preview
        </button>
      </div>
      <div className="doc-body">
        <p className="muted">{storyboardSummary(props.shots.length)}</p>
        <OptionsSection step="storyboard" />
      </div>
    </section>
  );
}
