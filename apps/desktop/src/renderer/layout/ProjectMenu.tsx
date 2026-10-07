/**
 * The project menu of the header (docs/ux/redesign-2.4.md U4): the project title opens Project
 * settings, Open folder (the project folder in the system's file manager; main resolves it) and
 * Close project.
 */
import type { JSX } from 'react';
import { errorMessage, rendererLog } from '../log.js';
import { MenuButton, type MenuItem } from './MenuButton.js';

const log = rendererLog('project-menu');

export interface ProjectMenuProps {
  readonly title: string;
  readonly dir: string;
  readonly onSettings: () => void;
  readonly onClose: () => void;
}

function openFolder(): void {
  window.reelforge.openStageArtifact('project').then(
    (result) => {
      if (result.status === 'error') log.error(`open folder failed: ${result.message ?? ''}`);
    },
    (error: unknown) => {
      log.error(`open folder failed: ${errorMessage(error)}`);
    },
  );
}

export function ProjectMenu(props: ProjectMenuProps): JSX.Element {
  const items: MenuItem[] = [
    { label: 'Project settings', run: props.onSettings },
    { label: 'Open folder', run: openFolder },
    { label: 'Close project', run: props.onClose },
  ];
  return (
    <MenuButton
      label={
        <>
          <span className="project-title-text">{props.title}</span>
          <span className="project-menu-caret" aria-hidden="true">
            ▾
          </span>
        </>
      }
      menuLabel="Project"
      items={items}
      className="project-menu"
      buttonClassName="project-title"
      title={props.dir}
    />
  );
}
