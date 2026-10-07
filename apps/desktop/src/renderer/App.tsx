import { useEffect, useState, type JSX } from 'react';
import type { ShotsPerMinute } from '@reelforge/shared';
import type { AppInfo } from '../shared/ipc-contract.js';
import type { ProjectSummary } from '../shared/project-contract.js';
import { ChannelDot } from './channels/ChannelBadge.js';
import { channelOf, showChannels, type ChannelList } from './channels/channel-view.js';
import { useChannels } from './channels/use-channels.js';
import { projectMeta } from './layout/header-view.js';
import { ProjectMenu } from './layout/ProjectMenu.js';
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
import { OpenSettingsContext, type SettingsRequest } from './settings/open-settings.js';
import { SettingsDialog } from './settings/SettingsDialog.js';
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
  defaultStyle,
  experimentalWorlds,
  channels,
}: {
  readonly onOpened: (project: ProjectSummary) => void;
  readonly defaultLanguage: ProjectSummary['language'] | undefined;
  readonly defaultShotsPerMinute: ShotsPerMinute | null | undefined;
  readonly defaultFasterChecks: boolean | undefined;
  readonly defaultStyle: string | undefined;
  readonly experimentalWorlds: boolean | undefined;
  readonly channels: ChannelList | undefined;
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
          defaultStyle={defaultStyle}
          experimentalWorlds={experimentalWorlds}
          channels={channels}
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
  /** Open Settings: the tab and (Channels) the channel selected first; null = closed. */
  const [settingsRequest, setSettingsRequest] = useState<SettingsRequest | null>(null);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  /** The header slot of the workspace's "Needs you" button (layout/NeedsYou.tsx). */
  const [needsYouSlot, setNeedsYouSlot] = useState<HTMLElement | null>(null);
  const settings = useSettings();
  const claude = useClaudeStatus();
  const channels = useChannels();
  const projectChannel = project === null ? undefined : channelOf(channels.list, project.channelId);
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
            <ProjectMenu
              title={project.title}
              dir={project.dir}
              onSettings={() => {
                setProjectSettingsOpen(true);
              }}
              onClose={closeProject}
            />
            {showChannels(channels.list) && projectChannel !== undefined && (
              <span className="project-channel">
                <ChannelDot channel={projectChannel} />
                <span className="project-channel-name">{projectChannel.name}</span>
              </span>
            )}
            <span className="project-meta">{projectMeta(project)}</span>
          </>
        )}
        <span className="header-spacer" />
        {project && <div className="needs-you-slot" ref={setNeedsYouSlot} />}
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
            setSettingsRequest({ tab: 'claude' });
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
            defaultStyle={appSettings?.defaultStyle}
            experimentalWorlds={appSettings?.experimental.worlds}
            channels={channels.list}
            onOpened={(opened) => {
              setProject(opened);
              setHistoryOpen(false);
            }}
          />
        ) : (
          <OpenSettingsContext value={setSettingsRequest}>
            <Workspace
              key={project.dir}
              project={project}
              headerSlot={needsYouSlot}
              onOpenToolsSettings={() => {
                setSettingsRequest({ tab: 'tools' });
              }}
            />
          </OpenSettingsContext>
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
            channel={projectChannel}
            onClose={() => {
              setProjectSettingsOpen(false);
            }}
          />
        )}
        {settingsRequest !== null && (
          <SettingsDialog
            tab={settingsRequest.tab}
            channelId={settingsRequest.channelId}
            onTab={(tab) => {
              setSettingsRequest({ ...settingsRequest, tab });
            }}
            settings={settings}
            claude={claude}
            channels={channels}
            onClose={() => {
              setSettingsRequest(null);
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
        {firstRun && settingsRequest === null && (
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
          setSettingsRequest({ tab: 'claude' });
        }}
      />
    </div>
  );
}
