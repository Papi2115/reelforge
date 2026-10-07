/**
 * Guided tour overlay (PLAN.md#10.3): non-blocking coach marks. The highlighted panel stays usable
 * (the layer lets clicks through); the card has Back / Next / Done, "Skip tour" and "Don't show
 * again". Escape closes it. Targets are re-measured while open (panels load and resize).
 */
import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import { placeTourCard, TOUR_STEPS, type CardPlacement, type Rect } from './tour.js';
import { useEscapeToClose } from '../layout/use-escape-to-close.js';

export interface TourClose {
  /** "Don't show again" was ticked, or the last step was finished. */
  readonly dontShowAgain: boolean;
}

export interface GuidedTourProps {
  readonly onClose: (close: TourClose) => void;
}

const MEASURE_INTERVAL_MS = 300;
const HIGHLIGHT_PAD = 4;

function measure(selector: string): Rect | null {
  const element = document.querySelector(selector);
  if (element === null) return null;
  const box = element.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

export function GuidedTour({ onClose }: GuidedTourProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [target, setTarget] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<CardPlacement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0];
  const last = index === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (step === undefined) return;
    const update = (): void => {
      const next = measure(step.target);
      setTarget((current) => (sameRect(current, next) ? current : next));
    };
    update();
    const timer = window.setInterval(update, MEASURE_INTERVAL_MS);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
    };
  }, [step]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card === null) return;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const size = { width: card.offsetWidth, height: card.offsetHeight };
    setPlacement(placeTourCard(target, viewport, size));
  }, [target, index]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  useEscapeToClose(() => {
    onClose({ dontShowAgain });
  });

  if (step === undefined) return <></>;
  return (
    <div className="tour-layer">
      {target !== null && (
        <div
          className="tour-highlight"
          aria-hidden="true"
          style={{
            left: target.left - HIGHLIGHT_PAD,
            top: target.top - HIGHLIGHT_PAD,
            width: target.width + 2 * HIGHLIGHT_PAD,
            height: target.height + 2 * HIGHLIGHT_PAD,
          }}
        />
      )}
      <div
        ref={cardRef}
        className={`tour-card side-${placement?.side ?? 'center'}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        style={{
          left: placement?.left ?? 0,
          top: placement?.top ?? 0,
          visibility: placement === null ? 'hidden' : 'visible',
        }}
      >
        <p className="tour-count mono">
          {index + 1} / {TOUR_STEPS.length}
        </p>
        <h2 id="tour-title" className="tour-title">
          {step.title}
        </h2>
        <p id="tour-body" className="tour-body">
          {step.body}
        </p>
        <label className="tour-dont-show">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => {
              setDontShowAgain(event.target.checked);
            }}
          />
          Don&apos;t show again
        </label>
        <div className="tour-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              onClose({ dontShowAgain });
            }}
          >
            Skip tour
          </button>
          <span className="tour-spacer" />
          <button
            type="button"
            disabled={index === 0}
            onClick={() => {
              setIndex((current) => Math.max(0, current - 1));
            }}
          >
            Back
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (last) onClose({ dontShowAgain: true });
              else setIndex((current) => current + 1);
            }}
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
