/**
 * Pipeline steps with their real status (PLAN.md#6.8, #11.2): the next-step card, the steps (the
 * finished ones at the top folded, status words and legend in status-view.ts) and the selected
 * step's Open, Replace, Run (or Stop while it runs) and Redo, which asks first and names the later
 * steps it makes out of date. Disabled actions explain themselves in their tooltip and in the line
 * under the buttons. The whole list collapses to one summary line to give the Shots panel room.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { z } from 'zod';
import type { PipelineStageKey } from '../../shared/stages-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { useWhisperSetup } from '../settings/use-whisper-setup.js';
import {
  defaultRow,
  pipelineRows,
  type OpenTarget,
  type RowView,
} from '../stages/pipeline-view.js';
import { nextStep, type NextStep } from '../stages/next-step.js';
import { stations, type StationFacts } from '../stages/stations-view.js';
import { pipelineSummary } from '../stages/status-view.js';
import type { StagesControls } from '../stages/use-stages.js';
import { needsWhisper, wordsSetupView } from '../stages/words-setup.js';
import { ChevronIcon, InfoIcon, StopIcon } from './icons.js';
import { NextStepCard } from './NextStepCard.js';
import { ActionButton, RedoConfirm, StageDetail } from './StageActions.js';
import { StageList, StatusLegend } from './StageList.js';
import { usePref } from './ui-prefs.js';
import { WordsSetupNotice } from './WordsSetupNotice.js';

const log = rendererLog('pipeline');

export interface PipelineSidebarProps {
  readonly stages: StagesControls;
  /** Documents and panels of the window (artifacts are opened through main here). */
  readonly onOpen: (target: Exclude<OpenTarget, { kind: 'artifact' }>) => void;
  readonly onBrief: () => void;
  /** Settings → Tools (whisper.cpp install problems). */
  readonly onOpenSettings?: () => void;
  /** What the files and reports say about the output (scenes built / failed). */
  readonly facts?: StationFacts;
}

/** Re-renders every second while `active` (elapsed time of the running stage). */
function useSecondTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [active]);
  return now;
}

const PIPELINE_PREFS_KEY = 'reelforge.layout.pipeline.v1';
const pipelinePrefsSchema = z.object({ collapsed: z.boolean(), doneOpen: z.boolean() });
const DEFAULT_PIPELINE_PREFS = { collapsed: false, doneOpen: false };

export function PipelineSidebar({
  stages,
  onOpen,
  onBrief,
  onOpenSettings,
  facts,
}: PipelineSidebarProps): JSX.Element {
  const rows = pipelineRows(stages.state);
  const views = stations(rows, stages.state, facts);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [confirm, setConfirm] = useState<RowView | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const now = useSecondTick((stages.state?.running ?? null) !== null);
  const selected = rows.find((row) => row.spec.id === selectedId) ?? defaultRow(rows);
  const hint = nextStep(rows);
  const wordsRow = rows.find((row) => row.spec.id === 'words');
  const [prefs, setPrefs] = usePref(
    PIPELINE_PREFS_KEY,
    pipelinePrefsSchema,
    DEFAULT_PIPELINE_PREFS,
  );
  const [legendOpen, setLegendOpen] = useState(false);
  const [detailsNonce, setDetailsNonce] = useState(0);
  const select = (rowId: string): void => {
    setSelectedId(rowId);
    setNotice(undefined);
  };

  const report = (promise: Promise<{ status: string; message: string | null }>): void => {
    setNotice(undefined);
    void promise.then((result) => {
      if (result.status === 'error') setNotice(result.message ?? 'That did not work.');
    });
  };

  // Words timed without whisper.cpp: hold the run, offer "Download and continue" (words-setup.ts).
  const [held, setHeld] = useState<readonly PipelineStageKey[] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const heldRef = useRef(held);
  heldRef.current = held;
  const runRef = useRef(stages.run);
  runRef.current = stages.run;
  const whisper = useWhisperSetup(
    `${wordsRow?.status ?? ''}|${wordsRow?.error?.message ?? ''}`,
    (end) => {
      const waiting = heldRef.current;
      if (end.job.kind !== 'setup' || end.phase !== 'done' || waiting === null) return;
      setHeld(null);
      void runRef.current(waiting);
    },
  );
  const setupView = dismissed
    ? ({ kind: 'hidden' } as const)
    : wordsSetupView({
        readiness: whisper.view.state?.readiness,
        progress: whisper.view.progress,
        held,
        wordsError: wordsRow?.error ?? null,
      });
  const runChecked = (toRun: readonly PipelineStageKey[]): void => {
    if (!needsWhisper(toRun)) {
      report(stages.run(toRun));
      return;
    }
    window.reelforge.getWhisperState(false).then(
      (state) => {
        if (state.readiness.ready) {
          report(stages.run(toRun));
          return;
        }
        setNotice(undefined);
        setDismissed(false);
        setHeld(toRun);
        whisper.reload(false);
      },
      (reason: unknown) => {
        log.warn(`whisper readiness check failed: ${errorMessage(reason)}`);
        report(stages.run(toRun));
      },
    );
  };

  /** Open of a step: its document or panel (artifacts through main). */
  const openRow = (row: RowView): void => {
    const target = row.spec.open;
    if (target.kind === 'artifact') report(stages.open(target.artifact));
    else onOpen(target);
  };

  const runNext = (step: NextStep): void => {
    select(step.rowId);
    switch (step.action.kind) {
      case 'brief':
        onBrief();
        return;
      case 'open':
        onOpen(step.action.target);
        return;
      case 'run':
        runChecked(step.action.stages);
        return;
      case 'select':
        setDetailsNonce((nonce) => nonce + 1);
        if (prefs.collapsed) setPrefs({ ...prefs, collapsed: false });
        return;
    }
  };

  return (
    <section
      className={`panel pipeline-panel${prefs.collapsed ? ' collapsed' : ''}`}
      aria-label="Pipeline"
    >
      <h2 className="panel-heading">
        <span className="panel-heading-text">Pipeline</span>
        <button
          type="button"
          className="info-button"
          aria-label="What the statuses mean"
          aria-expanded={legendOpen}
          title="What the statuses mean"
          onClick={() => {
            setLegendOpen((open) => !open);
          }}
        >
          <InfoIcon />
        </button>
        <button
          type="button"
          className="small-button heading-action"
          title="Your files, downloaded photos and your asset library"
          onClick={() => {
            onOpen({ kind: 'assets' });
          }}
        >
          Assets
        </button>
        <button
          type="button"
          className="small-button heading-action"
          title="Topic, length, tone, audience and language of the video"
          onClick={onBrief}
        >
          Brief
        </button>
        <button
          type="button"
          className="icon-button pipeline-collapse"
          aria-label={prefs.collapsed ? 'Show the steps' : 'Hide the steps'}
          aria-expanded={!prefs.collapsed}
          title={prefs.collapsed ? 'Show the steps' : 'Hide the steps: more room for the shots'}
          onClick={() => {
            setPrefs({ ...prefs, collapsed: !prefs.collapsed });
          }}
        >
          <ChevronIcon direction={prefs.collapsed ? 'down' : 'up'} />
        </button>
      </h2>
      {legendOpen && <StatusLegend />}
      {hint !== null && (
        <NextStepCard
          step={hint}
          onAction={() => {
            runNext(hint);
          }}
        />
      )}
      {prefs.collapsed ? (
        <p className="pipeline-summary" data-testid="pipeline-summary">
          {pipelineSummary(rows, views)}
        </p>
      ) : (
        <StageList
          rows={rows}
          stations={views}
          selectedId={selected?.spec.id}
          onSelect={select}
          onOpen={openRow}
          doneOpen={prefs.doneOpen}
          onDoneOpen={(doneOpen) => {
            setPrefs({ ...prefs, doneOpen });
          }}
        />
      )}
      <WordsSetupNotice
        view={setupView}
        onDownload={() => {
          setDismissed(false);
          if (heldRef.current === null) setHeld(wordsRow?.redoStages ?? ['words']);
          whisper.start({ kind: 'setup' });
        }}
        onCancel={whisper.cancel}
        onDismiss={() => {
          setDismissed(true);
          setHeld(null);
        }}
        onOpenSettings={() => {
          onOpenSettings?.();
        }}
      />
      {selected && !prefs.collapsed && (
        <>
          <div className="stage-actions" role="group" aria-label={`${selected.spec.label} actions`}>
            <ActionButton
              label="Open"
              action={selected.open}
              onClick={() => {
                openRow(selected);
              }}
            />
            {selected.replace !== null && (
              <ActionButton
                label="Replace"
                action={selected.replace}
                onClick={() => {
                  if (selected.spec.replace !== null) report(stages.replace(selected.spec.replace));
                }}
              />
            )}
            {selected.busy ? (
              <button
                type="button"
                className="small-button"
                title={`Stop ${selected.spec.label}`}
                onClick={() => {
                  const stage = stages.state?.running?.stage;
                  const target =
                    stage !== undefined && selected.spec.stages.includes(stage)
                      ? stage
                      : stages.state?.queue.find((queued) => selected.spec.stages.includes(queued));
                  if (target !== undefined) stages.stop(target);
                }}
              >
                <StopIcon /> Stop
              </button>
            ) : (
              <ActionButton
                label={selected.run.label}
                action={selected.run}
                primary
                onClick={() => {
                  runChecked(selected.runStages);
                }}
              />
            )}
            <ActionButton
              label="Redo"
              action={selected.redo}
              onClick={() => {
                setConfirm(selected);
              }}
            />
          </div>
          <StageDetail
            key={`${selected.spec.id}:${String(detailsNonce)}`}
            row={selected}
            station={views.find((view) => view.rowId === selected.spec.id)}
            now={now}
            detailsOpen={detailsNonce > 0}
          />
          {notice !== undefined && (
            <p className="stage-notice panel-error" role="alert">
              {notice}
            </p>
          )}
        </>
      )}
      {confirm !== undefined && (
        <RedoConfirm
          row={confirm}
          onCancel={() => {
            setConfirm(undefined);
          }}
          onConfirm={() => {
            setConfirm(undefined);
            runChecked(confirm.redoStages);
          }}
        />
      )}
    </section>
  );
}
