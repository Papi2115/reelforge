/**
 * Where a `page.panelBreak` panel is at shot time t, as a pure function: its shape from the
 * current box (hand-ruled, leaning, wedge, shard or exact corners), the moves applied in time
 * order (each blends from the state before it, so moves chain and overlap), the scene's `drive`
 * offsets, its entrance (slide, slam, pop, drop, swing on a hinge, grow from a side, unroll), and
 * the camera inside it. The frame may tilt; its content stays level (keep tilts small).
 */
import { lerp, rndRange, seg, track, type EaseName } from '../draw/math.js';
import type { PageSize } from '../style.js';
import type {
  BreakBox,
  BreakDrive,
  BreakEnter,
  BreakPanelSpec,
  BreakSide,
} from './break-schema.js';

export interface ResolvedMove {
  readonly targets: readonly string[];
  readonly at: number;
  readonly dur: number;
  readonly ease: EaseName;
  readonly lag: number;
  readonly to: {
    readonly x?: number | undefined;
    readonly y?: number | undefined;
    readonly rotate?: number | undefined;
    readonly scale?: number | undefined;
    readonly box?: BreakBox | undefined;
    readonly border?: number | undefined;
  };
}

export interface ResolvedCameraKey {
  readonly at: number;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly ease: EaseName;
}

export interface PanelPlan {
  readonly id: string;
  readonly key: string;
  readonly spec: BreakPanelSpec;
  readonly box: BreakBox;
  readonly at: number;
  readonly until: number;
  readonly enter: BreakEnter;
  readonly from: BreakSide;
  readonly dur: number;
  readonly camera: readonly ResolvedCameraKey[];
  /** The page (a slide starts just off it). */
  readonly page: PageSize;
}

export interface PanelState {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  box: BreakBox;
  border: number;
}

export interface PanelPose {
  /** The frame in page px. */
  readonly quad: number[];
  /** Page px of the content's (0, 0) and its scale. */
  readonly origin: readonly [number, number];
  readonly k: number;
  /** The content box size (panel-local px). */
  readonly size: readonly [number, number];
  readonly border: number;
}

/** Default entrance seconds. */
export const ENTER_DUR: Readonly<Record<BreakEnter, number>> = {
  cut: 0,
  slide: 0.45,
  slam: 0.22,
  pop: 0.19,
  drop: 0.5,
  swing: 0.55,
  grow: 0.4,
  unroll: 0.6,
};

/** The largest tilt a swinging entrance starts from (degrees). */
const SWING_DEG = 9;

function rectOf([x, y, w, h]: BreakBox): number[] {
  return [x, y, x + w, y, x + w, y + h, x, y + h];
}

/** The panel's corners for its current box. */
export function shapeQuad(spec: BreakPanelSpec, box: BreakBox, key: string): number[] {
  const [x, y, w, h] = box;
  if (spec.quad !== undefined) {
    const xs = spec.quad.filter((_, i) => i % 2 === 0);
    const ys = spec.quad.filter((_, i) => i % 2 === 1);
    const [qx, qy] = [Math.min(...xs), Math.min(...ys)];
    const [qw, qh] = [Math.max(...xs) - qx || 1, Math.max(...ys) - qy || 1];
    return spec.quad.map((value, i) =>
      i % 2 === 0 ? x + ((value - qx) * w) / qw : y + ((value - qy) * h) / qh,
    );
  }
  const l = spec.lean;
  if (spec.shape === 'lean') {
    return [x + l / 2, y, x + w + l / 2, y, x + w - l / 2, y + h, x - l / 2, y + h];
  }
  if (spec.shape === 'wedge') {
    const [left, right] = l >= 0 ? [0, l] : [-l, 0];
    return [x, y + left, x + w, y + right, x + w, y + h - right, x, y + h - left];
  }
  const amp = spec.shape === 'shard' ? Math.abs(l) * 0.6 : 1.5;
  const inward = [1, 1, -1, 1, -1, -1, 1, -1];
  return rectOf(box).map((value, i) => {
    const d = rndRange(key, i, spec.shape === 'shard' ? 0 : -amp, amp);
    return value + (spec.shape === 'shard' ? d * (inward[i] ?? 1) : d);
  });
}

/** Moves and drive applied in time order to the panel's rest state. */
export function stateAt(
  plan: PanelPlan,
  moves: readonly ResolvedMove[],
  drive: BreakDrive | undefined,
  t: number,
): PanelState {
  const state: PanelState = {
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    box: plan.box,
    border: plan.spec.border,
  };
  for (const move of moves) {
    const index = move.targets.indexOf(plan.id);
    if (index < 0) continue;
    const start = move.at + move.lag * index;
    const p = seg(t, start, start + move.dur, move.ease);
    if (p <= 0) continue;
    const { to } = move;
    if (to.x !== undefined) state.x = lerp(state.x, to.x, p);
    if (to.y !== undefined) state.y = lerp(state.y, to.y, p);
    if (to.rotate !== undefined) state.rotate = lerp(state.rotate, to.rotate, p);
    if (to.scale !== undefined) state.scale = lerp(state.scale, to.scale, p);
    if (to.border !== undefined) state.border = lerp(state.border, to.border, p);
    const box = to.box;
    if (box !== undefined) {
      const from = state.box;
      state.box = [
        lerp(from[0], box[0], p),
        lerp(from[1], box[1], p),
        lerp(from[2], box[2], p),
        lerp(from[3], box[3], p),
      ];
    }
  }
  const offset = drive?.(t)[plan.id];
  if (offset !== undefined) {
    state.x += offset.x ?? 0;
    state.y += offset.y ?? 0;
    state.rotate += offset.rotate ?? 0;
    state.scale *= offset.scale ?? 1;
  }
  return state;
}

type Op =
  | { readonly kind: 'scale'; readonly cx: number; readonly cy: number; readonly k: number }
  | { readonly kind: 'rotate'; readonly cx: number; readonly cy: number; readonly deg: number }
  | { readonly kind: 'move'; readonly dx: number; readonly dy: number };

function apply(ops: readonly Op[], x0: number, y0: number, rotate: boolean): [number, number] {
  let [x, y] = [x0, y0];
  for (const op of ops) {
    if (op.kind === 'scale') [x, y] = [op.cx + (x - op.cx) * op.k, op.cy + (y - op.cy) * op.k];
    else if (op.kind === 'move') [x, y] = [x + op.dx, y + op.dy];
    else if (rotate) {
      const a = (op.deg * Math.PI) / 180;
      const [dx, dy] = [x - op.cx, y - op.cy];
      [x, y] = [
        op.cx + dx * Math.cos(a) - dy * Math.sin(a),
        op.cy + dx * Math.sin(a) + dy * Math.cos(a),
      ];
    }
  }
  return [x, y];
}

/** The midpoint of a box side (a hinge, the point a panel grows from). */
function sidePoint([x, y, w, h]: BreakBox, side: BreakSide): [number, number] {
  const points = {
    left: [x, y + h / 2],
    right: [x + w, y + h / 2],
    top: [x + w / 2, y],
    bottom: [x + w / 2, y + h],
  } as const;
  return [...points[side]];
}

/** Entrance ops (after the panel's own state) and the unroll reveal share. */
function entrance(plan: PanelPlan, box: BreakBox, t: number): { ops: Op[]; reveal: number } {
  const { at, dur, from } = plan;
  if (t < at || plan.enter === 'cut') return { ops: [], reveal: 1 };
  const [x, y, w, h] = box;
  const [cx, cy] = [x + w / 2, y + h / 2];
  const p = (ease: EaseName) => seg(t, at, at + dur, ease);
  switch (plan.enter) {
    case 'slide': {
      const off = {
        left: [-(x + w + 6), 0],
        right: [plan.page.width - x + 6, 0],
        top: [0, -(y + h + 6)],
        bottom: [0, plan.page.height - y + 6],
      }[from];
      const rest = 1 - p('outBack');
      return {
        ops: [{ kind: 'move', dx: (off[0] ?? 0) * rest, dy: (off[1] ?? 0) * rest }],
        reveal: 1,
      };
    }
    case 'slam':
      return { ops: [{ kind: 'scale', cx, cy, k: lerp(1.14, 1, p('outBack')) }], reveal: 1 };
    case 'pop': {
      const keys = [
        [at, 1.25],
        [at + dur * 0.5, 0.97, 'outQuad'],
        [at + dur, 1, 'inOutSine'],
      ] as const;
      return { ops: [{ kind: 'scale', cx, cy, k: track(keys, t) }], reveal: 1 };
    }
    case 'drop': {
      const keys = [
        [at, -(y + h + 30)],
        [at + dur * 0.65, 0, 'inQuad'],
        [at + dur * 0.82, -5, 'outQuad'],
        [at + dur, 0, 'inQuad'],
      ] as const;
      return { ops: [{ kind: 'move', dx: 0, dy: track(keys, t) }], reveal: 1 };
    }
    case 'swing': {
      const [hx, hy] = sidePoint(box, from);
      const sign = from === 'left' || from === 'bottom' ? 1 : -1;
      const deg = sign * SWING_DEG * (1 - p('outBack'));
      return { ops: [{ kind: 'rotate', cx: hx, cy: hy, deg }], reveal: 1 };
    }
    case 'grow': {
      const [px, py] = sidePoint(box, from);
      return {
        ops: [{ kind: 'scale', cx: px, cy: py, k: Math.max(0.04, p('outBack')) }],
        reveal: 1,
      };
    }
    case 'unroll':
      return { ops: [], reveal: Math.max(0.02, p('outCubic')) };
  }
}

/** An unrolling panel: its far side runs out from the `from` side. */
function unroll(quad: number[], box: BreakBox, side: BreakSide, r: number): number[] {
  if (r >= 1) return quad;
  const [x, y, w, h] = box;
  return quad.map((value, i) => {
    const horizontal = i % 2 === 0;
    if (side === 'left' && horizontal) return x + (value - x) * r;
    if (side === 'right' && horizontal) return x + w - (x + w - value) * r;
    if (side === 'top' && !horizontal) return y + (value - y) * r;
    if (side === 'bottom' && !horizontal) return y + h - (y + h - value) * r;
    return value;
  });
}

/** The panel's frame, content placement and border at t. */
export function poseAt(
  plan: PanelPlan,
  moves: readonly ResolvedMove[],
  drive: BreakDrive | undefined,
  t: number,
): PanelPose {
  const state = stateAt(plan, moves, drive, t);
  const { box } = state;
  const [x, y, w, h] = box;
  const [cx, cy] = [x + w / 2, y + h / 2];
  const enter = entrance(plan, box, t);
  const ops: Op[] = [
    ...enter.ops,
    { kind: 'rotate', cx, cy, deg: state.rotate },
    { kind: 'scale', cx, cy, k: state.scale },
    { kind: 'move', dx: state.x, dy: state.y },
  ];
  const shaped = unroll(shapeQuad(plan.spec, box, plan.key), box, plan.from, enter.reveal);
  const quad: number[] = [];
  for (let i = 0; i < shaped.length; i += 2) {
    quad.push(...apply(ops, shaped[i] ?? 0, shaped[i + 1] ?? 0, true));
  }
  const k = ops.reduce((product, op) => (op.kind === 'scale' ? product * op.k : product), 1);
  let origin = apply(ops, x, y, false);
  let scale = k;
  if (plan.camera.length > 0) {
    const keys = plan.camera;
    const at = (pick: (key: ResolvedCameraKey) => number) =>
      track(
        keys.map((key) => [key.at, pick(key), key.ease] as const),
        t,
      );
    const zoom = at((key) => key.zoom);
    const centre = apply(ops, cx, cy, false);
    scale = k * zoom;
    origin = [centre[0] - at((key) => key.x) * scale, centre[1] - at((key) => key.y) * scale];
  }
  return { quad, origin, k: scale, size: [w, h], border: state.border };
}
