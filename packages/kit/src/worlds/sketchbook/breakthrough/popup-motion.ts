/**
 * The motion of a pop-up card's pieces: the pull progress p(t) of the tab (with its ease, an
 * overshoot for `back`), the state of every piece at p (its own values, then each bound motion
 * in order: a motion starts from where the earlier ones left the property, or from its explicit
 * `from`, and plays over its span of p, maybe along an arc; then the scene's `drive(p, t)`), and
 * the stand-up of pieces with their own `at` (a staggered rise with seeded variance). Pure.
 */
import { clamp01, ease, lerp, rnd, seg } from '../draw/math.js';
import type { PopupDrive, PopupElement, PopupOptions } from './popup-schema.js';
import { MOTION_PROPS } from './popup-schema.js';

/** The tab's travel when pulled (card px) and its little press-in first. */
export const TAB_TRAVEL = 52;
const PRESS_IN = 3;

/** Every value a piece can have (only the ones of its kind matter). */
export interface PieceState {
  rise: number;
  slide: number;
  angle: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  show: number;
  open: number;
  level: number;
  value: number;
  index: number;
}
export type PieceProp = keyof PieceState;

/** A piece before the pull. */
export function baseState(e: PopupElement): PieceState {
  return {
    rise: 1,
    slide: 0,
    angle: e.kind === 'arm' || e.kind === 'wheel' ? e.angle : 0,
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    show: 1,
    open: 0,
    level: e.kind === 'gauge' ? e.level : 0,
    value: e.kind === 'counter' ? e.from : e.kind === 'scale' ? e.value : 0,
    index: 0,
  };
}

/** Pull times (page s): the pen presses the tab, starts dragging, is done. */
export interface PullTimes {
  readonly press: number;
  readonly drag: number;
  readonly done: number;
}

/** How far the tab is pulled at t, as a share of TAB_TRAVEL (a small press-in first). */
export function pullAt(o: PopupOptions, times: PullTimes | undefined, t: number): number {
  if (!times || !o.pull) return 0;
  const name = o.pull.ease;
  const k = seg(t, times.drag, times.done);
  const travel = name === 'back' ? ease('back', k, 1.4) : ease(name, k);
  return (
    (-PRESS_IN * ease('out', seg(t, times.press, times.drag)) + (TAB_TRAVEL + PRESS_IN) * travel) /
    TAB_TRAVEL
  );
}

const idIndex = (o: PopupOptions): Map<string, number> => {
  const out = new Map<string, number>();
  o.elements.forEach((element, index) => {
    if ('id' in element && element.id !== undefined) out.set(element.id, index);
  });
  return out;
};

/** Applies `values` (by prop) to a state where the kind allows them and they are numbers. */
function assign(
  state: PieceState,
  e: PopupElement,
  values: Readonly<Record<string, number>>,
): void {
  for (const [prop, value] of Object.entries(values)) {
    if (MOTION_PROPS[e.kind].includes(prop) && Number.isFinite(value)) {
      state[prop as PieceProp] = value;
    }
  }
}

/** The state of every piece (by element index) at pull progress p and time t. */
export function statesAt(o: PopupOptions, seed: number, p: number, t: number): PieceState[] {
  const states = o.elements.map(baseState);
  const ids = idIndex(o);
  (o.pull?.motions ?? []).forEach((m, order) => {
    const index = ids.get(m.target);
    const state = index === undefined ? undefined : states[index];
    if (!state) return;
    const jitter = m.vary * (m.span[1] - m.span[0]);
    const s0 = m.span[0] + rnd(-jitter, jitter, seed, order, 811);
    const s1 = m.span[1] + rnd(-jitter, jitter, seed, order, 812);
    // A motion over the whole pull follows the tab's own press-in and overshoot.
    const raw = (p - s0) / Math.max(0.01, s1 - s0);
    const k = Math.min(s1 >= 1 ? Infinity : 1, Math.max(s0 <= 0 ? -Infinity : 0, raw));
    const e = m.ease === 'lin' ? k : ease(m.ease, k) + (k - clamp01(k));
    const from = { x: state.x, y: state.y };
    for (const [prop, to] of Object.entries(m.to)) {
      const key = prop as PieceProp;
      if (!(key in state)) continue;
      state[key] = lerp(m.from?.[prop] ?? state[key], to, e);
    }
    if (m.arc !== 0 && ('x' in m.to || 'y' in m.to)) {
      const [dx, dy] = [state.x - from.x, state.y - from.y];
      const length = Math.hypot(dx, dy) || 1;
      const bend = 4 * e * (1 - e) * m.arc;
      state.x += (-dy / length) * bend;
      state.y += (dx / length) * bend;
    }
  });
  const drive = o.pull?.drive;
  if (drive) {
    const out = drive(p, t);
    for (const [name, values] of Object.entries(out)) {
      const index = ids.get(name);
      const [state, e] = [states[index ?? -1], o.elements[index ?? -1]];
      if (state && e) assign(state, e, values);
    }
  }
  return states;
}

/**
 * How far a standing piece with its own `at` is up (0 = flat on the base, 1 = standing, a
 * little more in its overshoot); 1 for pieces that rise with the card.
 */
export function riseAt(e: PopupElement, index: number, at: number | undefined, seed: number) {
  if (at === undefined || (e.kind !== 'block' && e.kind !== 'cutout')) return () => 1;
  const dur = 0.42 + rnd(0, 0.2, seed, index, 821);
  const overshoot = 0.8 + rnd(0, 1.2, seed, index, 822);
  return (t: number): number => ease('back', seg(t, at, at + dur), overshoot);
}

/** Checks a drive callback on p = 0, 0.5, 1: known ids, props of their kind, numbers. */
export function driveProblem(o: PopupOptions, drive: PopupDrive, t: number): string | null {
  const ids = idIndex(o);
  for (const p of [0, 0.5, 1]) {
    const out: unknown = drive(p, t);
    if (typeof out !== 'object' || out === null) return `drive(${String(p)}) must return an object`;
    for (const [name, values] of Object.entries(out as Record<string, unknown>)) {
      const element = o.elements[ids.get(name) ?? -1];
      if (!element) return `drive moves "${name}", which is not a piece id of this card`;
      if (typeof values !== 'object' || values === null)
        return `drive: "${name}" needs { prop: n }`;
      for (const [prop, value] of Object.entries(values as Record<string, unknown>)) {
        if (!MOTION_PROPS[element.kind].includes(prop)) {
          return `drive: the ${element.kind} cannot move "${prop}" (it has ${MOTION_PROPS[element.kind].join(', ') || 'nothing'})`;
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return `drive: ${name}.${prop} must be a number`;
        }
      }
    }
  }
  return null;
}
