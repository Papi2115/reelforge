/**
 * Sound design (PLAN.md#8.2, #11.2), docked under the preview. On top: the main actions
 * ("Generate cues", "Render mix"; the deterministic default cues and the stems as secondary ones),
 * what the player monitors (full mix with the latest edits, or the voice only), the mix report as
 * a ✓/⚠ checklist and the cue summary. In sections that open and close (remembered): the levels,
 * the library (drag onto the timeline) and the music ducking. "All options" (open) under them: beat
 * sync, repetition control, the tension map and the sound palette per look (OptionsSection.tsx).
 */
import { type JSX } from 'react';
import { z } from 'zod';
import type { LibrarySound, SoundAction } from '../../shared/sound-contract.js';
import type { StagesState } from '../../shared/stages-contract.js';
import { Disclosure } from '../layout/Disclosure.js';
import { usePref } from '../layout/ui-prefs.js';
import { OptionsSection } from '../options/OptionsSection.js';
import { plural } from '../../shared/plural.js';
import { STAGE_LABELS } from '../stages/pipeline-view.js';
import { DuckingField, MonitorToggle } from './SoundControls.js';
import { SoundLibrary } from './SoundLibrary.js';
import {
  cueSummaryText,
  formatDb,
  GAIN_RANGE,
  GAIN_ROWS,
  gainPatch,
  loudnessReadout,
  QA_MARKS,
  topSoundsText,
} from './sound-view.js';
import type { MixPreviewControls } from './use-mix-preview.js';
import type { SoundControls } from './use-sound.js';

export interface SoundPanelProps {
  readonly sound: SoundControls;
  readonly preview: MixPreviewControls;
  readonly stages: StagesState | undefined;
  readonly onAdd: (sound: LibrarySound) => void;
  readonly onOpenStems: () => void;
  readonly onClose: () => void;
}

const SECTIONS_KEY = 'reelforge.layout.sound.v1';
const sectionsSchema = z.object({
  levels: z.boolean(),
  library: z.boolean(),
  ducking: z.boolean(),
});
const DEFAULT_SECTIONS = { levels: true, library: false, ducking: false };

const ACTIONS: readonly {
  readonly action: SoundAction;
  readonly label: string;
  readonly hint: string;
  readonly kind: 'primary' | 'main' | 'secondary';
}[] = [
  {
    action: 'generate-cues',
    label: 'Generate cues',
    hint: 'Claude places sound effects, ambience and music from the storyboard (cues.json)',
    kind: 'main',
  },
  {
    action: 'default-cues',
    label: 'Default cues (no Claude)',
    hint: 'Deterministic sound design: SFX on scene events and transitions, ambience, generated music per act',
    kind: 'secondary',
  },
  {
    action: 'mix',
    label: 'Render mix',
    hint: 'Mix everything into audio/mix.wav at −14 LUFS, true peak ≤ −1 dBTP',
    kind: 'primary',
  },
  {
    action: 'mix-stems',
    label: 'Render mix + stems',
    hint: 'Also vo/sfx/ambience/music stems in out/stems',
    kind: 'secondary',
  },
];

function busyText(stages: StagesState | undefined): string | null {
  const running = stages?.running;
  if (
    running !== undefined &&
    running !== null &&
    (running.stage === 'sound-cues' || running.stage === 'mix')
  ) {
    const percent = running.percent === null ? '' : ` (${String(Math.round(running.percent))} %)`;
    return `${STAGE_LABELS[running.stage]}: ${running.label ?? 'starting'}${percent}`;
  }
  const queued = stages?.queue.find((stage) => stage === 'sound-cues' || stage === 'mix');
  return queued === undefined ? null : `${STAGE_LABELS[queued]} is queued.`;
}

function MixReadout({
  sound,
  onOpenStems,
}: Pick<SoundPanelProps, 'sound' | 'onOpenStems'>): JSX.Element {
  const mix = sound.state?.mix;
  if (mix === undefined || !mix.exists) {
    return (
      <p className="muted mix-readout">
        No mix yet. Generate cues (or use the default ones), then Render mix.
      </p>
    );
  }
  const readout = mix.result === null ? null : loudnessReadout(mix.result);
  const stems = sound.state?.stems ?? [];
  return (
    <div className="mix-readout" data-testid="mix-readout">
      {readout === null ? (
        <span className="muted">audio/mix.wav (no loudness report)</span>
      ) : (
        <>
          <span className={readout.lufsOk ? 'qa-ok' : 'qa-failed'}>
            {readout.lufs} {readout.lufsOk ? '✓' : '✗'}
          </span>
          <span className="muted">{readout.lufsTarget}</span>
          <span className={readout.peakOk ? 'qa-ok' : 'qa-failed'}>
            {readout.peak} {readout.peakOk ? '✓' : '✗'}
          </span>
          <span className="muted">{readout.peakTarget}</span>
        </>
      )}
      {mix.stale && <span className="qa-warning">Cues changed since this render.</span>}
      {stems.length > 0 && (
        <button type="button" className="link-button" onClick={onOpenStems}>
          {plural(stems.length, 'stem')}
        </button>
      )}
    </div>
  );
}

function CueSummaryLine({ sound }: Pick<SoundPanelProps, 'sound'>): JSX.Element | null {
  const summary = sound.state?.cues;
  if (summary === null || summary === undefined) return null;
  return (
    <p className="cue-summary" data-testid="cue-summary">
      <span>{cueSummaryText(summary)}</span>
      {summary.sounds.length > 0 && <span className="muted"> — {topSoundsText(summary)}</span>}
    </p>
  );
}

function MixQaList({ sound }: Pick<SoundPanelProps, 'sound'>): JSX.Element | null {
  const checks = sound.state?.mix.qa;
  if (checks === null || checks === undefined || checks.length === 0) return null;
  return (
    <ul className="mix-qa" aria-label="Mix report">
      {checks.map((check) => {
        const mark = QA_MARKS[check.status];
        return (
          <li key={check.id} className={mark.className} title={`want ${check.limit}`}>
            <span aria-hidden="true">{mark.mark}</span> {check.label}: {check.value}
          </li>
        );
      })}
    </ul>
  );
}

function previewText(preview: MixPreviewControls): string | null {
  if (preview.busy) return 'Updating the preview mix…';
  if (preview.message !== null) return preview.message;
  const last = preview.last;
  if (last === null) return null;
  const end = last.startS + last.durationS;
  return `Preview mix ${last.startS.toFixed(1)}–${end.toFixed(1)} s updated (${(last.ms / 1000).toFixed(1)} s)`;
}

function LevelSliders({ sound }: Pick<SoundPanelProps, 'sound'>): JSX.Element {
  const state = sound.state;
  return (
    <div className="sound-levels">
      {GAIN_ROWS.map((row) => {
        const value = state?.gains[row.key] ?? 0;
        return (
          <label key={row.key} className="level-row">
            <span className="level-label">{row.label}</span>
            <input
              type="range"
              min={GAIN_RANGE.min}
              max={GAIN_RANGE.max}
              step={GAIN_RANGE.step}
              value={value}
              disabled={state === undefined}
              aria-label={`${row.label} level (dB)`}
              onChange={(event) => {
                sound.setMix(gainPatch(row.key, Number(event.target.value)));
              }}
            />
            <output className="mono">{formatDb(value)}</output>
          </label>
        );
      })}
    </div>
  );
}

export function SoundPanel(props: SoundPanelProps): JSX.Element {
  const { sound, preview } = props;
  const state = sound.state;
  const busy = busyText(props.stages);
  const status = previewText(preview);
  const [open, setOpen] = usePref(SECTIONS_KEY, sectionsSchema, DEFAULT_SECTIONS);
  const library = state?.library ?? [];
  return (
    <section className="doc-panel docked sound-panel" aria-label="Sound design">
      <div className="doc-header">
        <h2 className="doc-title">Sound design</h2>
        <MonitorToggle preview={preview} />
        <span className="sound-status muted" role="status">
          {status}
        </span>
        <button type="button" className="small-button" onClick={props.onClose}>
          Back to preview
        </button>
      </div>
      <div className="doc-body sound-body">
        <div className="sound-main">
          <div className="sound-actions" role="group" aria-label="Sound actions">
            {ACTIONS.map((entry) => (
              <button
                key={entry.action}
                type="button"
                className={`small-button sound-action-${entry.kind}${entry.kind === 'primary' ? ' primary' : ''}`}
                aria-disabled={busy !== null}
                title={busy ?? entry.hint}
                onClick={() => {
                  if (busy === null) sound.run(entry.action);
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {busy !== null && (
            <p className="sound-busy" aria-live="polite">
              {busy}
            </p>
          )}
          {sound.notice !== null && (
            <p className="panel-error" role="alert">
              {sound.notice}
            </p>
          )}
          {state?.cuesError !== null && state?.cuesError !== undefined && (
            <p className="panel-error" role="alert">
              {state.cuesError}
            </p>
          )}
          <h3 className="sound-heading">Mix report</h3>
          <MixReadout sound={sound} onOpenStems={props.onOpenStems} />
          <MixQaList sound={sound} />
          <CueSummaryLine sound={sound} />
        </div>
        <div className="sound-sections">
          <Disclosure
            title="Levels"
            open={open.levels}
            onToggle={(levels) => {
              setOpen((current) => ({ ...current, levels }));
            }}
          >
            <LevelSliders sound={sound} />
          </Disclosure>
          <Disclosure
            title="Sound library"
            summary={`${plural(library.length, 'sound')} · drag onto the timeline`}
            open={open.library}
            onToggle={(libraryOpen) => {
              setOpen((current) => ({ ...current, library: libraryOpen }));
            }}
          >
            <SoundLibrary
              library={library}
              preview={sound.preview}
              onAdd={props.onAdd}
              onImport={sound.importFiles}
            />
          </Disclosure>
          <Disclosure
            title="Music ducking"
            summary="music dips under your voice"
            open={open.ducking}
            onToggle={(ducking) => {
              setOpen((current) => ({ ...current, ducking }));
            }}
          >
            <DuckingField
              ducking={state?.ducking ?? null}
              onChange={(ducking) => {
                sound.setMix({ ducking });
              }}
            />
          </Disclosure>
          <OptionsSection step="sound" />
        </div>
      </div>
    </section>
  );
}
