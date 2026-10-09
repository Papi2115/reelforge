/**
 * The Home screen's left rail (PLAN.md#13.16): Projects, Channels, Production line (the dialog,
 * Ctrl+Shift+L), Shorts (all Shorts and "New short from a film"), then Settings and Help at the bottom.
 */
import type { JSX, ReactNode } from 'react';
import { LineButton } from '../queue/LineButton.js';
import type { ProductionLineController } from '../queue/use-production-line.js';

export type HomeView = 'projects' | 'channels' | 'shorts';

export interface HomeNavProps {
  readonly view: HomeView;
  readonly onView: (view: HomeView) => void;
  /** Projects waiting for the user (a count chip on "Projects"). */
  readonly needsYou: number;
  readonly line: ProductionLineController;
  readonly onSettings: () => void;
  /** The Help menu (built by App: it opens App's dialogs). */
  readonly help: ReactNode;
}

function NavItem(props: {
  readonly view: HomeView;
  readonly current: HomeView;
  readonly onView: (view: HomeView) => void;
  readonly children: ReactNode;
}): JSX.Element {
  const current = props.view === props.current;
  return (
    <button
      type="button"
      className="home-nav-item"
      aria-current={current ? 'page' : undefined}
      onClick={() => {
        props.onView(props.view);
      }}
    >
      {props.children}
    </button>
  );
}

export function HomeNav(props: HomeNavProps): JSX.Element {
  return (
    <nav className="home-nav" aria-label="Home">
      <NavItem view="projects" current={props.view} onView={props.onView}>
        <span className="home-nav-mark mark-projects" aria-hidden="true" />
        Projects
        {props.needsYou > 0 && (
          <span className="needs-you-count has-items" title="Projects that need you">
            {props.needsYou}
            <span className="visually-hidden"> need you</span>
          </span>
        )}
      </NavItem>
      <NavItem view="channels" current={props.view} onView={props.onView}>
        <span className="home-nav-mark mark-channels" aria-hidden="true" />
        Channels
      </NavItem>
      <div className="home-nav-line">
        <LineButton controller={props.line} />
      </div>
      <NavItem view="shorts" current={props.view} onView={props.onView}>
        <span className="home-nav-mark mark-shorts" aria-hidden="true" />
        Shorts
      </NavItem>
      <span className="home-nav-spacer" />
      <button type="button" className="home-nav-item" onClick={props.onSettings}>
        <span className="home-nav-mark mark-settings" aria-hidden="true" />
        Settings
      </button>
      <div className="home-nav-help">{props.help}</div>
    </nav>
  );
}
