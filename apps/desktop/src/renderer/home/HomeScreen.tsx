/**
 * The Home screen (PLAN.md#13.16): the whole window when no project is open, no preview. A left
 * rail (Projects, Channels, Production line, Shorts, Settings, Help) and the chosen view; New
 * project opens the wizard in place. Ctrl+N = new project, / = search. Opening a card shows the
 * project's overview (double-click or "Open editor": the editor).
 */
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import type { ShotsPerMinute } from '@reelforge/shared';
import type { HomeProject } from '../../shared/home-contract.js';
import type { ProjectOpenResult, ProjectSummary } from '../../shared/project-contract.js';
import type { ChannelsController } from '../channels/use-channels.js';
import { errorMessage, rendererLog } from '../log.js';
import { keyTargetOf } from '../preview/transport-keys.js';
import { OpenRecovery } from '../project/OpenRecovery.js';
import type { ProductionLineController } from '../queue/use-production-line.js';
import type { SettingsRequest } from '../settings/open-settings.js';
import { NewProjectWizard } from '../wizard/NewProjectWizard.js';
import { homeKeyAction } from './home-keys.js';
import { lastChannelId, needsYouCount } from './home-view.js';
import { ChannelsView } from './HomeSideViews.js';
import { HomeNav, type HomeView } from './HomeNav.js';
import type { CardActions, OpenTarget } from './ProjectCard.js';
import { ProjectsView } from './ProjectsView.js';
import { ShortsView } from './ShortsView.js';
import { useHomeProjects } from './use-home-projects.js';

const log = rendererLog('home');

/** App settings the wizard starts from (undefined until loaded). */
export interface NewProjectDefaults {
  readonly language: ProjectSummary['language'] | undefined;
  readonly shotsPerMinute: ShotsPerMinute | null | undefined;
  readonly fasterChecks: boolean | undefined;
  readonly style: string | undefined;
  readonly experimentalWorlds: boolean | undefined;
}

export interface HomeScreenProps {
  readonly channels: ChannelsController;
  readonly line: ProductionLineController;
  readonly defaults: NewProjectDefaults;
  /** A project was opened: show its overview or the editor (`card`: what Home knew of it). */
  readonly onOpened: (project: ProjectSummary, target: OpenTarget, card?: HomeProject) => void;
  /** The wizard made a project (and saved its brief): the editor opens on the brief. */
  readonly onCreated: (project: ProjectSummary) => void;
  readonly onSettings: (request: SettingsRequest) => void;
  readonly help: ReactNode;
}

export function HomeScreen(props: HomeScreenProps): JSX.Element {
  const { channels } = props;
  const home = useHomeProjects();
  const [view, setView] = useState<HomeView>('projects');
  /** The wizard is open (with the channel it starts in; undefined = the last used one). */
  const [wizard, setWizard] = useState<{ readonly channelId: string | undefined } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const projects = home.projects ?? [];

  const startNew = (channelId: string | undefined): void => {
    setError(undefined);
    setWizard({ channelId: channelId ?? lastChannelId(projects, channels.list) });
  };
  const latestStartNew = useRef(startNew);
  latestStartNew.current = startNew;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const action = homeKeyAction({
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
        target: keyTargetOf(event.target),
      });
      if (action === undefined || event.defaultPrevented) return;
      event.preventDefault();
      if (action === 'new-project') {
        latestStartNew.current(undefined);
        return;
      }
      setWizard(null);
      setView('projects');
      // The search exists once the view rendered.
      window.requestAnimationFrame(() => searchRef.current?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const run = (
    action: () => Promise<ProjectOpenResult>,
    target: OpenTarget,
    card?: HomeProject,
  ): void => {
    setBusy(true);
    setError(undefined);
    action()
      .then((result) => {
        if (result.status === 'opened') props.onOpened(result.project, target, card);
        if (result.status === 'error') setError(result.error.message);
      })
      .catch((reason: unknown) => {
        log.error(`project action failed: ${errorMessage(reason)}`);
        setError(errorMessage(reason));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const actions: CardActions = {
    open: (project, target) => {
      run(() => window.reelforge.openHomeProject(project.dir), target, project);
    },
    showFolder: (project) => {
      window.reelforge.showProjectFolder(project.dir).then(
        (result) => {
          setError(result.status === 'error' ? result.message : undefined);
        },
        (reason: unknown) => {
          log.error(`showProjectFolder failed: ${errorMessage(reason)}`);
        },
      );
    },
    rename: async (project, title) => {
      try {
        const result = await window.reelforge.renameProject(project.dir, title);
        if (result.status === 'error') return result.message;
        home.reload();
        return undefined;
      } catch (reason) {
        log.error(`renameProject failed: ${errorMessage(reason)}`);
        return 'The title could not be saved. See the log for details.';
      }
    },
  };

  const main = (): JSX.Element => {
    if (wizard !== null) {
      return (
        <NewProjectWizard
          channels={channels}
          initialChannelId={wizard.channelId}
          defaults={props.defaults}
          onCancel={() => {
            setWizard(null);
          }}
          onCreated={props.onCreated}
        />
      );
    }
    switch (view) {
      case 'projects':
        return (
          <ProjectsView
            projects={home.projects}
            loadError={home.error}
            channels={channels.list}
            busy={busy}
            actions={actions}
            onNew={startNew}
            onOpenFolder={() => {
              run(() => window.reelforge.openProject(), 'editor');
            }}
            onOpenExample={() => {
              run(() => window.reelforge.openExampleProject(), 'editor');
            }}
            searchRef={searchRef}
          />
        );
      case 'channels':
        return (
          <ChannelsView
            channels={channels.list}
            loadError={channels.loadError}
            projects={projects}
            busy={busy}
            onNew={startNew}
            onEdit={(channelId) => {
              props.onSettings({ tab: 'channels', channelId });
            }}
          />
        );
      case 'shorts':
        return (
          <ShortsView
            projects={home.projects}
            loadError={home.error}
            channels={channels.list}
            busy={busy}
            actions={actions}
            onCreated={(dir) => {
              home.reload();
              run(() => window.reelforge.openHomeProject(dir), 'overview');
            }}
          />
        );
    }
  };

  return (
    <section className="home" aria-label="Start">
      <HomeNav
        view={view}
        onView={(next) => {
          setWizard(null);
          setView(next);
        }}
        needsYou={needsYouCount(projects)}
        line={props.line}
        onSettings={() => {
          props.onSettings({ tab: 'claude' });
        }}
        help={props.help}
      />
      <div className="home-main">
        <OpenRecovery
          onOpened={(project) => {
            props.onOpened(project, 'editor');
          }}
        />
        {error !== undefined && (
          <p className="home-error" role="alert">
            {error}
          </p>
        )}
        {main()}
      </div>
    </section>
  );
}
