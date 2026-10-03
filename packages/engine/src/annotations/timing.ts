/**
 * Enter/exit phase of an annotation as a pure function of local time: visibility, draw-on share
 * (strokes), pop scale (labels), dissolve opacity and left-to-right wipe.
 */
import { EASINGS } from '../camera/easing.js';
import type { AnnotationAnimation } from './options.js';

export interface AnnotationTiming {
  readonly at: number;
  readonly until: number;
  readonly enter: AnnotationAnimation;
  readonly exit: AnnotationAnimation;
  readonly enterDuration: number;
  readonly exitDuration: number;
}

export interface AnnotationPhase {
  readonly visible: boolean;
  /** Seconds since `at`. */
  readonly age: number;
  /** Seconds since the enter animation finished (negative while entering). */
  readonly settledFor: number;
  /** Share of each stroke drawn (draw-on), 0..1. */
  readonly draw: number;
  /** Size multiplier of labels (pop, with overshoot), 0..~1.1. */
  readonly pop: number;
  readonly opacity: number;
  /** Share of the width uncovered from the left (wipe), 0..1. */
  readonly wipe: number;
}

interface AnnotationEffect {
  readonly draw: number;
  readonly pop: number;
  readonly opacity: number;
  readonly wipe: number;
}

const REST: AnnotationEffect = { draw: 1, pop: 1, opacity: 1, wipe: 1 };

const ENTER_DURATIONS: Readonly<Record<AnnotationAnimation, number>> = {
  none: 0.001,
  fade: 0.3,
  pop: 0.25,
  draw: 0.45,
  wipe: 0.35,
};

export function defaultEnterDuration(animation: AnnotationAnimation): number {
  return ENTER_DURATIONS[animation];
}

function effectAt(animation: AnnotationAnimation, k: number): AnnotationEffect {
  const progress = Math.min(1, Math.max(0, k));
  switch (animation) {
    case 'none':
      return REST;
    case 'fade':
      return { ...REST, opacity: progress };
    case 'pop':
      return { ...REST, pop: Math.max(0, EASINGS.easeOutBack(progress)) };
    case 'draw':
      return { ...REST, draw: EASINGS.easeOutCubic(progress) };
    case 'wipe':
      return { ...REST, wipe: EASINGS.easeOutCubic(progress) };
  }
}

export function annotationPhase(t: number, timing: AnnotationTiming): AnnotationPhase {
  const age = t - timing.at;
  const settledFor = age - timing.enterDuration;
  if (t < timing.at || t >= timing.until) {
    return { visible: false, age, settledFor, draw: 0, pop: 0, opacity: 0, wipe: 0 };
  }
  const entering = age / timing.enterDuration;
  if (entering < 1) return { visible: true, age, settledFor, ...effectAt(timing.enter, entering) };
  const leaving = (timing.until - t) / timing.exitDuration;
  if (leaving < 1) return { visible: true, age, settledFor, ...effectAt(timing.exit, leaving) };
  return { visible: true, age, settledFor, ...REST };
}

/** 0..1..0 breathing wave after the annotation settled (pulse, bounce); 0 before. */
export function wave(phase: AnnotationPhase, hertz: number): number {
  if (phase.settledFor < 0) return 0;
  return 0.5 - 0.5 * Math.cos(phase.settledFor * hertz * 2 * Math.PI);
}
