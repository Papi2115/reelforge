import { useEffect, useState, type JSX } from 'react';
import type { ShotsPerMinute } from '@reelforge/shared';
import type { AppInfo } from '../shared/ipc-contract.js';
import type { ProjectSummary } from '../shared/project-contract.js';
import { StatusBar } from './layout/StatusBar.js';
import { useAppShortcut } from './layout/use-app-shortcut.js';
import { Workspace } from './layout/Workspace.js';
import { errorMessage, rendererLog } from './log.js';
import { PreviewPanel } from './preview/PreviewPanel.js';
import { usePlayer } from './preview/use-player.js';
import { GuidedTour } from './onboarding/GuidedTour.js';
import { HelpDialogs, type HelpDialogKind } from './onboarding/HelpDialogs.js';
import { HelpMenu } from './onboarding/HelpMenu.js';
import { WelcomeScreen } from './onboarding/WelcomeScreen.js';
import { HistoryDrawer } from './project/HistoryDrawer.js';
import { OpenRecovery } from './project/OpenRecovery.js';
import { ProjectSettingsDialog } from './project/ProjectSettingsDialog.js';
import { StartScreen } from './project/StartScreen.js';
import { FirstRunGate } from './settings/FirstRunGate.js';
import { SettingsDialog, type SettingsTab } from './settings/SettingsDialog.js';
import { useClaudeStatus } from './settings/use-claude-status.js';
import { useSettings } from './settings/use-settings.js';

const log = rendererLog('app');
const DEMO_SOURCE = { kind: 'demo' } as const;

/** Start screen: projects on the left, the demo video in the preview. */
function StartLayout({
  onOpened,
  defaultLanguage,
  defaultShotsPerMinute,
  defaultFasterChecks,
}: {
  readonly onOpened: (project: ProjectSummary) => void;
  readonly defaultLanguage: ProjectSummary['language'] | undefined;
  readonly defaultShotsPerMinute: ShotsPerMinute | null | undefined;
  readonly defaultFasterChecks: boolean | undefined;
}): JSX.Element {
  // The demo has no audio: the player runs on the system clock.
  const player = usePlayer(undefined);
  return (
    <div className="start-layout">
      <div className="start-column">
        <OpenRecovery onOpened={onOpened} />
        <StartScreen
          onOpened={onOpened}
          defaultLanguage={defaultLanguage}
          defaultShotsPerMinute={defaultShotsPerMinute}
          defaultFasterChecks={defaultFasterChecks}
        />
      </div>
      <PreviewPanel source={DEMO_SOURCE} player={player} snapshots={false} />
    </div>
  );
}

export function App(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | undefined>(undefined);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const settings = useSettings();
  const claude = useClaudeStatus();
  const appSettings = settings.state?.settings;
  const firstRun = appSettings !== undefined && !appSettings.onboarding.connectClaudeDone;
  const [helpDialog, setHelpDialog] = useState<HelpDialogKind | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  /** Closed in this session without "Don't show again": it comes back after a restart. */
  const [tourClosed, setTourClosed] = useState(false);
  const onboarding = appSettings?.onboarding;
  const welcome = onboarding?.connectClaudeDone === true && !onboarding.welcomeDone;
  const autoTour = project !== null && onboarding?.welcomeDone === true && !onboarding.tourDone;
  useAppShortcut('shortcuts', () => {
    setHelpDialog('shortcuts');
  });

  useEffect(() => {
    if (autoTour && !tourClosed) setTourOpen(true);
  }, [autoTour, tourClosed]);

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
    setProjectSettingsOpen(false);
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
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setProjectSettingsOpen(true);
              }}
            >
              Project settings
            </button>
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
        <HelpMenu
          onTour={
            project === null
              ? null
              : () => {
                  setTourOpen(true);
                }
          }
          onDialog={setHelpDialog}
        />
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setSettingsTab('claude');
          }}
        >
          Settings
        </button>
      </header>
      <main className="app-main">
        {project === null && welcome ? (
          <WelcomeScreen
            defaultLanguage={appSettings?.language}
            onDone={() => {
              settings.update({ onboarding: { welcomeDone: true } });
            }}
            onOpened={(opened) => {
              setProject(opened);
              setHistoryOpen(false);
            }}
          />
        ) : project === null ? (
          <StartLayout
            defaultLanguage={appSettings?.language}
            defaultShotsPerMinute={appSettings?.newProjectDefaults.shotsPerMinute}
            defaultFasterChecks={appSettings?.newProjectDefaults.fasterChecks}
            onOpened={(opened) => {
              setProject(opened);
              setHistoryOpen(false);
            }}
          />
        ) : (
          <Workspace
            key={project.dir}
            project={project}
            onOpenToolsSettings={() => {
              setSettingsTab('tools');
            }}
          />
        )}
        {project !== null && historyOpen && (
          <HistoryDrawer
            onClose={() => {
              setHistoryOpen(false);
            }}
            onReverted={refreshProject}
          />
        )}
        {project !== null && projectSettingsOpen && (
          <ProjectSettingsDialog
            key={project.dir}
            projectTitle={project.title}
            onClose={() => {
              setProjectSettingsOpen(false);
            }}
          />
        )}
        {settingsTab !== null && (
          <SettingsDialog
            tab={settingsTab}
            onTab={setSettingsTab}
            settings={settings}
            claude={claude}
            onClose={() => {
              setSettingsTab(null);
            }}
          />
        )}
        {tourOpen && project !== null && (
          <GuidedTour
            onClose={({ dontShowAgain }) => {
              setTourOpen(false);
              setTourClosed(true);
              if (dontShowAgain) settings.update({ onboarding: { tourDone: true } });
            }}
          />
        )}
        {helpDialog !== null && (
          <HelpDialogs
            kind={helpDialog}
            info={info}
            onClose={() => {
              setHelpDialog(null);
            }}
          />
        )}
        {firstRun && settingsTab === null && (
          <FirstRunGate
            claude={claude}
            onDone={() => {
              settings.update({ onboarding: { connectClaudeDone: true } });
            }}
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
        economy={appSettings?.economy}
        claude={claude.status}
        onOpenClaudeSettings={() => {
          setSettingsTab('claude');
        }}
      />
    </div>
  );
}
