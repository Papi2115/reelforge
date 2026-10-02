import { useEffect, useState, type JSX } from 'react';
import type { AppInfo } from '../shared/ipc-contract.js';
import type { ProjectSummary } from '../shared/project-contract.js';
import { StatusBar } from './layout/StatusBar.js';
import { Workspace } from './layout/Workspace.js';
import { errorMessage, rendererLog } from './log.js';
import { PreviewPanel } from './preview/PreviewPanel.js';
import { usePlayer } from './preview/use-player.js';
import { HistoryDrawer } from './project/HistoryDrawer.js';
import { StartScreen } from './project/StartScreen.js';

const log = rendererLog('app');
const DEMO_SOURCE = { kind: 'demo' } as const;

/** Start screen: projects on the left, the demo video in the preview. */
function StartLayout({
  onOpened,
}: {
  readonly onOpened: (project: ProjectSummary) => void;
}): JSX.Element {
  // The demo has no audio: the player runs on the system clock.
  const player = usePlayer(undefined);
  return (
    <div className="start-layout">
      <StartScreen onOpened={onOpened} />
      <PreviewPanel source={DEMO_SOURCE} player={player} snapshots={false} />
    </div>
  );
}

export function App(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | undefined>(undefined);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    window.reelforge.getAppInfo().then(setInfo, (error: unknown) => {
      log.error(`getAppInfo failed: ${errorMessage(error)}`);
    });
    // After a renderer reload main may still have a project open.
    window.reelforge.getCurrentProject().then(setProject, (error: unknown) => {
      log.error(`getCurrentProject failed: ${errorMessage(error)}`);
    });
  }, []);

  const refreshProject = (): void => {
    window.reelforge.getCurrentProject().then(setProject, (error: unknown) => {
      log.error(`getCurrentProject failed: ${errorMessage(error)}`);
    });
  };

  const closeProject = (): void => {
    setHistoryOpen(false);
    window.reelforge.closeProject().then(
      () => {
        setProject(null);
      },
      (error: unknown) => {
        log.error(`closeProject failed: ${errorMessage(error)}`);
      },
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">
          <span className="brand-mark" aria-hidden="true" />
          ReelForge
        </span>
        {project && (
          <>
            <span className="project-title" title={project.dir}>
              {project.title}
            </span>
            <span className="project-meta">
              {project.language.toUpperCase()} · {project.style} · {project.fps} fps
            </span>
            <button type="button" className="link-button" onClick={closeProject}>
              Close project
            </button>
          </>
        )}
        {info && (
          <span className="app-meta">
            Electron {info.electron} · Chrome {info.chrome}
            {info.dev ? ' · dev' : ''}
          </span>
        )}
      </header>
      <main className="app-main">
        {project === null ? (
          <StartLayout
            onOpened={(opened) => {
              setProject(opened);
              setHistoryOpen(false);
            }}
          />
        ) : (
          <Workspace key={project.dir} project={project} />
        )}
        {project !== null && historyOpen && (
          <HistoryDrawer
            onClose={() => {
              setHistoryOpen(false);
            }}
            onReverted={refreshProject}
          />
        )}
      </main>
      <StatusBar
        projectOpen={project !== null}
        historyOpen={historyOpen}
        onToggleHistory={() => {
          setHistoryOpen((open) => !open);
        }}
        version={info?.version}
      />
    </div>
  );
}
