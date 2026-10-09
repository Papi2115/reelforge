/**
 * A Home card's picture (PLAN.md#13.16): the uploaded thumbnail or the export's frame when main
 * sent one, else a placeholder in the style's colours with the title's initials.
 */
import type { JSX } from 'react';
import type { HomeProject } from '../../shared/home-contract.js';
import { styleTint, titleInitials } from './card-view.js';

export function CardPicture({
  project,
}: {
  readonly project: Pick<HomeProject, 'title' | 'style' | 'thumbnail'>;
}): JSX.Element {
  if (project.thumbnail !== null) {
    return <img className="card-picture" src={project.thumbnail} alt="" draggable={false} />;
  }
  const tint = styleTint(project.style);
  return (
    <span
      className="card-picture card-placeholder"
      aria-hidden="true"
      style={{ background: tint.back, color: tint.ink }}
    >
      <span className="card-initials">{titleInitials(project.title)}</span>
    </span>
  );
}
