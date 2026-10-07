/**
 * An old entry point kept for one release (docs/ux/redesign-2.4.md §9 risks): one line saying the
 * feature moved, with a link that opens the Director tab on its section.
 */
import type { JSX } from 'react';
import { OPEN_DIRECTOR_LABEL, type DirectorSection } from './director-view.js';
import { useOpenDirector } from './use-director-tab.js';

export function DirectorPointer(props: {
  readonly text: string;
  readonly section: DirectorSection;
}): JSX.Element {
  const openDirector = useOpenDirector();
  return (
    <p className="director-pointer muted" data-testid="director-pointer">
      {props.text}{' '}
      {openDirector !== null && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            openDirector(props.section);
          }}
        >
          {OPEN_DIRECTOR_LABEL}
        </button>
      )}
    </p>
  );
}
