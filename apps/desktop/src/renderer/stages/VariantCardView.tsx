/**
 * One card of the Variants view (PLAN.md#11.3): number key, title, ✓/⚠ badge (Building…,
 * Dropped), the creative direction, the looping clip and the first critic note (all notes in the
 * tooltip), and the card's actions: Play in preview, Use this one, Regenerate this variant.
 */
import type { JSX } from 'react';
import type { VariantCard } from '../../shared/variants-contract.js';
import { VariantClipLoop } from './VariantClipLoop.js';
import { cardBadge, pickable } from './variants-view.js';

export interface VariantCardViewProps {
  readonly shotId: string;
  readonly card: VariantCard;
  readonly selected: boolean;
  readonly previewing: boolean;
  /** Why picking / regenerating is not possible now (null = possible). */
  readonly blocked: string | null;
  readonly onSelect: () => void;
  readonly onPreview: () => void;
  readonly onPick: () => void;
  readonly onRegenerate: () => void;
}

function Media({ shotId, card }: { readonly shotId: string; readonly card: VariantCard }) {
  if (card.status === 'building') return <div className="variant-clip pending">Building…</div>;
  if (card.status === 'dropped') {
    return (
      <div className="variant-clip failed" title={card.reason ?? undefined}>
        {card.reason ?? 'Failed QA'}
      </div>
    );
  }
  return <VariantClipLoop shotId={shotId} cardKey={card.key} label={card.title} />;
}

export function VariantCardView(props: VariantCardViewProps): JSX.Element {
  const { card, blocked } = props;
  const variant = card.key !== 'current';
  const tone = card.status === 'dropped' ? 'failed' : (card.qa ?? 'none');
  const usable = card.status !== 'building' && card.status !== 'dropped';
  return (
    <li
      className={`variant-card${props.selected ? ' selected' : ''}${card.status === 'dropped' ? ' dropped' : ''}`}
      aria-current={props.selected}
      data-testid={`variant-card-${card.key}`}
      title={card.notes.join('\n') || undefined}
      onClick={props.onSelect}
    >
      <div className="variant-card-head">
        {variant && <kbd>{card.key.slice(1)}</kbd>}
        <span className="variant-title">{card.title}</span>
        <span className={`variant-badge qa-${tone}`} data-testid={`variant-badge-${card.key}`}>
          {cardBadge(card)}
        </span>
      </div>
      <p className="variant-direction">{card.direction ?? 'What the shot shows now'}</p>
      <Media shotId={props.shotId} card={card} />
      <p className="variant-note-line">{card.notes[0] ?? ' '}</p>
      <div className="variant-actions">
        {usable && (
          <button
            type="button"
            className="small-button"
            aria-pressed={props.previewing}
            aria-label={props.previewing ? 'Playing in preview' : 'Play in preview'}
            title={
              props.previewing
                ? 'Stop playing this version in the preview'
                : 'Play this version in the preview with the voice-over'
            }
            onClick={props.onPreview}
          >
            {props.previewing ? '■ Stop' : '▶ Play'}
          </button>
        )}
        {pickable(card) && (
          <button
            type="button"
            className="small-button primary"
            aria-disabled={blocked !== null}
            title={blocked ?? 'Make this the shot’s scene (Enter)'}
            onClick={(event) => {
              event.stopPropagation();
              if (blocked === null) props.onPick();
            }}
          >
            Use this one
          </button>
        )}
        {variant && card.status !== 'building' && (
          <button
            type="button"
            className="small-button"
            aria-label="Regenerate this variant"
            aria-disabled={blocked !== null}
            title={blocked ?? 'Build this variant again with the same direction'}
            onClick={(event) => {
              event.stopPropagation();
              if (blocked === null) props.onRegenerate();
            }}
          >
            ↻
          </button>
        )}
      </div>
    </li>
  );
}
