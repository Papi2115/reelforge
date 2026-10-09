import { useEffect, useRef, useState, type JSX } from 'react';
import type { HomeProject } from '../shared/home-contract.js';
import type { AppInfo } from '../shared/ipc-contract.js';
import type { ProjectSummary } from '../shared/project-contract.js';
import { ChannelDot } from './channels/ChannelBadge.js';
import { channelOf, showChannels } from './channels/channel-view.js';
import { useChannels } from './channels/use-channels.js';
import { HomeScreen } from './home/HomeScreen.js';
import type { OpenTarget } from './home/ProjectCard.js';
import { ProjectOverview } from './home/ProjectOverview.js';
import { projectMeta } from './layout/header-view.js';
import { ProjectMenu } from './layout/ProjectMenu.js';
import { StatusBar } from './layout/StatusBar.js';
import { useAppShortcut } from './layout/use-app-shortcut.js';
import { Workspace } from './layout/Workspace.js';
import { errorMessage, rendererLog } from './log.js';
import { GuidedTour } from './onboarding/GuidedTour.js';
import { HelpDialogs, type HelpDialogKind } from './onboarding/HelpDialogs.js';
import { HelpMenu } from './onboarding/HelpMenu.js';
import { WelcomeScreen } from './onboarding/WelcomeScreen.js';
import { HistoryDrawer } from './project/HistoryDrawer.js';
import { ProjectSettingsDialog } from './project/ProjectSettingsDialog.js';
import { FirstRunGate } from './settings/FirstRunGate.js';
import { OpenSettingsContext, type SettingsRequest } from './settings/open-settings.js';
import { useTitleFont } from './settings/PixelTitles.js';
import { SettingsDialog } from './settings/SettingsDialog.js';
import { useClaudeStatus } from './settings/use-claude-status.js';
import { useSettings } from './settings/use-settings.js';
import { LineButton } from './queue/LineButton.js';
import { lineAttentionItems } from './queue/line-attention.js';
import { ProductionLineDialog } from './queue/ProductionLineDialog.js';
import type { OpenRequest } from './queue/use-open-request.js';
import { useProductionLine } from './queue/use-production-line.js';
import type { QueueItemRef, QueueOpenPanel } from '../shared/queue-contract.js';

const log = rendererLog('app');

/**
 * The app window (PLAN.md#13.16): Home (no project open: projects, channels, the wizard), a
 * project's overview, or the editor (the workspace). "← Projects" closes the project and returns
 * Home, which lists the projects again.
 */
export function App(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | undefined>(undefined);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  /** What an open project shows: its overview or the editor. */
  const [screen, setScreen] = useState<OpenTarget>('editor');
  /** The Home card of the project in the overview (its steps and picture). */
  const [overviewCard, setOverviewCard] = useState<HomeProject | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Open Settings: the tab and (Channels) the channel selected first; null = closed. */
  const [settingsRequest, setSettingsRequest] = useState<SettingsRequest | null>(null);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  /** The header slot of the workspace's "Needs you" button (layout/NeedsYou.tsx). */
  const [needsYouSlot, setNeedsYouSlot] = useState<HTMLElement | null>(null);
  const settings = useSettings();
  const claude = useClaudeStatus();
  const channels = useChannels();
  /** The production line (PLAN.md#13.9): its dialog, its films in the inbox. */
  const line = useProductionLine();
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null);
  const openNonce = useRef(0);
  const projectChannel = project === null ? undefined : channelOf(channels.list, project.channelId);
  const appSettings = settings.state?.settings;
  const firstRun = appSettings !== undefined && !appSettings.onboarding.connectClaudeDone;
  useTitleFont(appSettings?.ui.pixelTitles);
  const [helpDialog, setHelpDialog] = useState<HelpDialogKind | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  /** Closed in this session without "Don't show again": it comes back after a restart. */
  const [tourClosed, setTourClosed] = useState(false);
  const onboarding = appSettings?.onboarding;
  const welcome = onboarding?.connectClaudeDone === true && !onboarding.welcomeDone;
  const editor = project !== null && screen === 'editor';
  /** Home shows Production line, Help and Settings in its rail; the other screens in the header. */
  const home = project === null && !welcome;
  const autoTour = editor && onboarding?.welcomeDone === true && !onboarding.tourDone;
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

  /** A project main just opened: its overview (with Home's card) or the editor. */
  const showProject = (opened: ProjectSummary, target: OpenTarget, card?: HomeProject): void => {
    setProject(opened);
    setScreen(target);
    setOverviewCard(card);
    setHistoryOpen(false);
  };

  const channelName = (channelId: string): string =>
    channels.list?.channels.find((channel) => channel.id === channelId)?.name ?? channelId;

  /** A film of the production line, opened at a panel; a problem in plain words, if any. */
  const openFilm = async (
    ref: QueueItemRef,
    panel: QueueOpenPanel,
  ): Promise<string | undefined> => {
    try {
      const result = await window.reelforge.openQueueProject(ref, panel);
      if (result.status === 'error') return result.error.message;
      if (result.status === 'cancelled') return undefined;
      showProject(result.project, 'editor');
      openNonce.current += 1;
      setOpenRequest({ panel, dir: result.project.dir, nonce: openNonce.current });
      line.close();
      return undefined;
    } catch (error) {
      log.error(`openQueueProject failed: ${errorMessage(error)}`);
      return 'The project could not be opened. See the log for details.';
    }
  };

  /** Another project of the Home list in its overview (a Short's film, a film's Short). */
  const openOverview = async (dir: string): Promise<string | undefined> => {
    try {
      const result = await window.reelforge.openHomeProject(dir);
      if (result.status === 'opened') showProject(result.project, 'overview');
      return result.status === 'error' ? result.error.message : undefined;
    } catch (error) {
      log.error(`openHomeProject failed: ${errorMessage(error)}`);
      return 'The project could not be opened. See the log for details.';
    }
  };

  const closeProject = (): void => {
    setHistoryOpen(false);
    setOpenRequest(null);
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

  const helpMenu = (
    <HelpMenu
      onTour={
        editor
          ? () => {
              setTourOpen(true);
            }
          : null
      }
      onDialog={setHelpDialog}
    />
  );

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">
          <span className="brand-mark" aria-hidden="true" />
          ReelForge
        </span>
        {project && (
          <>
            <button
              type="button"
              className="back-to-projects"
              title="Close this project and go back to all projects"
              onClick={closeProject}
            >
              ← Projects
            </button>
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
        {!home && <LineButton controller={line} />}
        {editor && <div className="needs-you-slot" ref={setNeedsYouSlot} />}
        {!home && helpMenu}
        {!home && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setSettingsRequest({ tab: 'claude' });
            }}
          >
            Settings
          </button>
        )}
      </header>
      <main className="app-main">
        {project === null && welcome ? (
          <WelcomeScreen
            defaultLanguage={appSettings?.language}
            onDone={() => {
              settings.update({ onboarding: { welcomeDone: true } });
            }}
            onOpened={(opened) => {
              showProject(opened, 'editor');
            }}
          />
        ) : project === null ? (
          <HomeScreen
            channels={channels}
            line={line}
            defaults={{
              language: appSettings?.language,
              shotsPerMinute: appSettings?.newProjectDefaults.shotsPerMinute,
              fasterChecks: appSettings?.newProjectDefaults.fasterChecks,
              style: appSettings?.defaultStyle,
              experimentalWorlds: appSettings?.experimental.worlds,
            }}
            onOpened={showProject}
            onCreated={(created) => {
              showProject(created, 'editor');
              openNonce.current += 1;
              setOpenRequest({ panel: 'brief', dir: created.dir, nonce: openNonce.current });
            }}
            onSettings={setSettingsRequest}
            help={helpMenu}
          />
        ) : screen === 'overview' ? (
          <ProjectOverview
            key={project.dir}
            project={project}
            card={overviewCard}
            channel={projectChannel}
            onOpenEditor={(panel) => {
              setScreen('editor');
              if (panel === undefined) return;
              openNonce.current += 1;
              setOpenRequest({ panel, dir: project.dir, nonce: openNonce.current });
            }}
            onOpenProject={openOverview}
          />
        ) : (
          <OpenSettingsContext value={setSettingsRequest}>
            <Workspace
              key={project.dir}
              project={project}
              headerSlot={needsYouSlot}
              line={{
                items: lineAttentionItems(line.state?.attention ?? [], channelName, project.dir),
                show: line.show,
                openRequest,
              }}
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
        {line.dialog.open && (
          <ProductionLineDialog controller={line} channels={channels.list} onOpenFilm={openFilm} />
        )}
        {tourOpen && editor && (
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
