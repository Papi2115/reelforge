/**
 * Brief -> Script view over the preview (PLAN.md#7.1): the brief form, the script (live progress
 * with Claude's steps while the Script stage runs, else the editor with the acceptance gate),
 * research.md and beats.md read-only, and the research sources.
 */
import type { JSX } from 'react';
import type { ProjectSummary } from '../../shared/project-contract.js';
import type { ScriptDocument, StageInfo } from '../../shared/stages-contract.js';
import { BriefForm } from './BriefForm.js';
import { ScriptEditor } from './ScriptEditor.js';
import { StageProgress } from './StageProgress.js';
import { useScriptDocument } from './use-script-document.js';
import type { StagesControls } from './use-stages.js';

export const SCRIPT_TABS = ['brief', 'script', 'research', 'beats', 'sources'] as const;
export type ScriptTab = (typeof SCRIPT_TABS)[number];

const TAB_LABELS: Readonly<Record<ScriptTab, string>> = {
  brief: 'Brief',
  script: 'Script',
  research: 'Research',
  beats: 'Beats',
  sources: 'Sources',
};

export interface ScriptPanelProps {
  readonly project: ProjectSummary;
  readonly stages: StagesControls;
  readonly tab: ScriptTab;
  readonly onTab: (tab: ScriptTab) => void;
  readonly onClose: () => void;
}

function ReadOnlyText({
  text,
  missing,
}: {
  readonly text: string | null;
  readonly missing: string;
}): JSX.Element {
  return text === null ? (
    <p className="panel-empty">{missing}</p>
  ) : (
    <pre className="doc-text mono" tabIndex={0}>
      {text}
    </pre>
  );
}

function Sources({ document }: { readonly document: ScriptDocument }): JSX.Element {
  if (document.sources.length === 0) {
    return (
      <p className="panel-empty">
        {document.research === null ? 'No research yet.' : 'research.md lists no links.'}
      </p>
    );
  }
  return (
    <ol className="source-list">
      {document.sources.map((source) => (
        <li key={source.url}>
          {source.claim !== '' && <span>{source.claim}</span>}
          <span className="mono muted source-url">{source.url}</span>
        </li>
      ))}
    </ol>
  );
}

function ScriptTabView(props: {
  readonly info: StageInfo | undefined;
  readonly document: ScriptDocument;
  readonly stages: StagesControls;
}): JSX.Element {
  const state = props.stages.state;
  const running = state?.running?.stage === 'script' ? state.running : null;
  const queued = state?.queue.includes('script') === true;
  if (running !== null || queued) {
    return (
      <StageProgress
        title="Writing the script"
        run={running}
        onStop={() => {
          props.stages.stop('script');
        }}
      />
    );
  }
  const error = props.info?.error ?? null;
  return (
    <>
      {error !== null && (
        <div className="doc-banner panel-error" role="alert">
          <p>{error.message}</p>
          {error.issues.length > 0 && (
            <ul>
              {error.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ScriptEditor
        script={props.document.script}
        targetMinutes={props.document.targetMinutes}
        approvedAt={props.info?.approvedAt ?? null}
        readOnly={false}
        onApprove={async () => {
          const result = await window.reelforge.approveScript();
          return result.status === 'error' ? (result.message ?? 'Not approved.') : null;
        }}
      />
    </>
  );
}

export function ScriptPanel(props: ScriptPanelProps): JSX.Element {
  const info = props.stages.state?.stages.find((candidate) => candidate.stage === 'script');
  const busy =
    props.stages.state?.running?.stage === 'script' ||
    props.stages.state?.queue.includes('script') === true;
  const stageKey = `${info?.status ?? ''}|${info?.updatedAt ?? ''}|${String(busy)}`;
  const { document } = useScriptDocument(props.project.dir, stageKey);

  const body = (): JSX.Element => {
    if (props.tab === 'brief') {
      return (
        <BriefForm
          project={props.project}
          busy={busy}
          hasScript={(document?.script ?? null) !== null}
          onWriteScript={() => props.stages.run(['script'])}
          onStarted={() => {
            props.onTab('script');
          }}
        />
      );
    }
    if (document === undefined) return <p className="panel-empty">Reading the project…</p>;
    switch (props.tab) {
      case 'script':
        return <ScriptTabView info={info} document={document} stages={props.stages} />;
      case 'research':
        return <ReadOnlyText text={document.research} missing="No research.md yet." />;
      case 'beats':
        return <ReadOnlyText text={document.beats} missing="No beats.md yet." />;
      case 'sources':
        return <Sources document={document} />;
    }
  };

  return (
    <section className="doc-panel" aria-label="Script">
      <div className="doc-header">
        <div className="tabs" role="tablist" aria-label="Script views">
          {SCRIPT_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`script-tab-${tab}`}
              aria-selected={props.tab === tab}
              aria-controls="script-tab-view"
              className="tab"
              onClick={() => {
                props.onTab(tab);
              }}
            >
              {TAB_LABELS[tab]}
              {tab === 'sources' && document !== undefined && document.sources.length > 0 && (
                <span className="count">{document.sources.length}</span>
              )}
            </button>
          ))}
        </div>
        <button type="button" className="small-button" onClick={props.onClose}>
          Back to preview
        </button>
      </div>
      <div
        className="doc-body"
        role="tabpanel"
        id="script-tab-view"
        aria-labelledby={`script-tab-${props.tab}`}
      >
        {body()}
      </div>
    </section>
  );
}
