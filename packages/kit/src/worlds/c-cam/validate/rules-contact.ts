/**
 * Contact rule (c-plus `validate.js` `V.contact`, `CHARACTER_CONTRACT.md` §6) on the C-CAM
 * contact helpers (`reachPalmChecked`, `palmWorld`):
 *  - handshakes: the character and its partner (default: itself) at the c-plus set-ups (yaw pairs x
 *    scale pairs x distances, feet on one perspective floor); the meeting point is c-plus `ST.meet`
 *    'mid' (the two offered palms, weighted by reach, kept below both chins); both palms solved
 *    onto it must end <= `contactLimit` apart;
 *  - objects: a palm put on points round the offered hand (every view, three scales, with and
 *    without lean) must land <= `contactLimit` from the point.
 * C-CAM has no `ST.meet` slide: a goal out of reach (> `reachShare` arm + `reachHand` hands from
 * the shoulder) is REPORTED in the metrics, never failed and never faked (as c-plus does).
 * Limits (measured on the test character and the five Apollo people with `REACH_STEPS` = 6):
 * a palm on an object meets c-plus's flat 4 world px at every scale (worst 1.9 px at scale 1,
 * 2.7 px at 1.4); a handshake gap adds the residuals of two solved palms and keeps the 4 px grown
 * with the larger figure's scale (worst 0.1 px at scale 1, 4.8 px at 1.4 / 1.3 against 5.6).
 *
 * Public API: `contactLimit`, `objectContactLimit`, `contactMiss`.
 */
import type { Character } from '../draw/character.js';
import {
  bodyAt,
  figToWorld,
  palmWorld,
  reachPalmChecked,
  worldToFig,
  type HandSide,
  type PlacedFigure,
  type Placement,
  type Point2,
} from '../draw/contact.js';
import { handAt, pose, type Pose } from '../draw/poses.js';
import { VIEW_DEG, viewState } from '../draw/rig-views.js';
import { fmt, str, type RuleContext } from './context.js';
import { measureHead } from './measure.js';
import {
  HANDSHAKE_DISTANCES,
  HANDSHAKE_OFFER,
  HANDSHAKE_SCALES,
  HANDSHAKE_YAWS,
  THRESHOLDS,
} from './thresholds.js';

/** World px two handshake palms may be apart when the larger figure is drawn at scale s. */
export function contactLimit(s: number): number {
  return THRESHOLDS.contactPx * Math.max(1, s);
}

/** World px a palm may land from an object point, at any scale (c-plus's flat 4 px). */
export function objectContactLimit(): number {
  return THRESHOLDS.contactPx;
}

const offered = (ch: Character, side: HandSide): Pose => {
  const sgn = side === 'L' ? 1 : -1;
  const target = handAt(ch.D, sgn, HANDSHAKE_OFFER[0], HANDSHAKE_OFFER[1], HANDSHAKE_OFFER[2]);
  const P = pose('stand', ch.D);
  return side === 'L' ? { ...P, hL: target } : { ...P, hR: target };
};

const placed = (ch: Character, placement: Placement, side: HandSide): PlacedFigure => ({
  character: ch,
  placement,
  pose: offered(ch, side),
});

/**
 * Where the palm of the offered hand would be without the face guard: the goals are built round
 * it, so a guard box that covers it shows up as a miss instead of moving the goal along.
 */
function offeredPalm(fig: PlacedFigure, side: HandSide): Point2 {
  const D = fig.character.D;
  return palmWorld({ ...fig, character: { D: { ...D, head: undefined } } }, side);
}

/** Can the hand reach `goal` (world) without stretching past `reachShare` (c-plus `ST.meet`)? */
function reachable(
  fig: PlacedFigure & { character: Character },
  side: HandSide,
  goal: Point2,
): boolean {
  const ch = fig.character;
  const D = ch.D;
  const V = viewState(fig.placement.yaw ?? 0);
  const lean = (fig.placement.lean || 0) + (fig.pose.lean || 0);
  const q = worldToFig(fig.placement, V.mir, lean, goal);
  const own = side === 'L' ? fig.pose.hL : fig.pose.hR;
  const keep = Math.abs(Math.sin((VIEW_DEG[V.v] * Math.PI) / 180)) > 0.5 ? own[0] : own[2];
  const bob = (fig.pose.bob || 0) * (D.l1l + D.l2l);
  const T = bodyAt(V, q, bob, keep);
  const S = [side === 'L' ? D.sw : -D.sw, D.sy, D.sz || 0] as const;
  const need = Math.hypot(T[0] - S[0], T[1] - S[1], T[2] - S[2]);
  return need <= THRESHOLDS.reachShare * (D.l1a + D.l2a) + THRESHOLDS.reachHand * D.hsz;
}

/** World y of the chin line + a hand: a handshake point never sits higher (`contact.js:59-64`). */
function chinLimit(ctx: RuleContext, ch: Character, p: Placement): number {
  const V = viewState(p.yaw ?? 0);
  const box = ch === ctx.character ? ctx.head(V.v).box : measureHead(ch, V.v).box;
  const fig: Point2 = [(box.x0 + box.x1) / 2, box.y1 + ch.D.hsz * THRESHOLDS.handshakeBelowChin];
  return figToWorld(p, V.mir, p.lean || 0, fig)[1];
}

function handshakes(ctx: RuleContext): void {
  const A = ctx.character;
  const B = ctx.partner;
  let reported = 0;
  for (const [ya, yb] of HANDSHAKE_YAWS) {
    for (const [sa, sb] of HANDSHAKE_SCALES) {
      for (const dist of HANDSHAKE_DISTANCES) {
        const pa: Placement = { x: 800, y: 500 + 500 * sa, s: sa, yaw: ya };
        const pb: Placement = { x: 800 + dist, y: 500 + 500 * sb, s: sb, yaw: yb };
        const fa = placed(A, pa, 'R');
        const fb = placed(B, pb, 'R');
        const wa = offeredPalm(fa, 'R');
        const wb = offeredPalm(fb, 'R');
        const ra = (A.D.l1a + A.D.l2a) * sa;
        const k = ra / (ra + (B.D.l1a + B.D.l2a) * sb);
        const below = Math.max(chinLimit(ctx, A, pa), chinLimit(ctx, B, pb));
        const goal: Point2 = [
          wa[0] + (wb[0] - wa[0]) * k,
          Math.max(below, wa[1] + (wb[1] - wa[1]) * k),
        ];
        if (
          !reachable({ ...fa, character: A }, 'R', goal) ||
          !reachable({ ...fb, character: B }, 'R', goal)
        ) {
          reported += 1;
          continue;
        }
        ctx.check();
        const ma = reachPalmChecked(fa, 'R', goal);
        const mb = reachPalmChecked(fb, 'R', goal);
        const ga = palmWorld({ ...fa, pose: { ...fa.pose, hR: ma.target } }, 'R');
        const gb = palmWorld({ ...fb, pose: { ...fb.pose, hR: mb.target } }, 'R');
        const gap = Math.hypot(ga[0] - gb[0], ga[1] - gb[1]);
        ctx.metric('contact: max handshake gap px (reachable set-ups)', gap);
        const limit = contactLimit(Math.max(sa, sb));
        if (gap <= limit) continue;
        ctx.fail({
          view: ya,
          pose: `handshake ${A.id} x ${B.id} yaw ${str(ya)}/${str(yb)} s ${str(sa)}/${str(sb)} d ${str(dist)}`,
          message: `palms ${fmt(gap)} px apart (misses ${fmt(ma.miss)} / ${fmt(mb.miss)} px) although the point is within reach`,
          fix: 'the face guard or the IK clamp moves the hand: check D.head (its bottom must stay above the handshake height) and the arm lengths l1a / l2a',
          measured: gap,
          limit,
        });
      }
    }
  }
  ctx.metric('contact: handshake set-ups out of reach (reported)', reported);
}

const PROBE_SCALES = [1, 0.6, 1.4] as const;
const PROBE_LEANS = [0, 6] as const;
/** Offsets round the offered palm, in arm lengths x scale. */
const PROBE_OFFSETS: readonly Point2[] = [
  [0, 0],
  [0.12, 0],
  [0, 0.12],
  [-0.1, -0.1],
];

function objects(ctx: RuleContext): void {
  const ch = ctx.character;
  const len = ch.D.l1a + ch.D.l2a;
  let reported = 0;
  for (const yaw of ctx.views) {
    for (const s of PROBE_SCALES) {
      for (const lean of PROBE_LEANS) {
        const placement: Placement = { x: 600, y: 900, s, yaw, lean };
        for (const side of ['L', 'R'] as const) {
          const fig = placed(ch, placement, side);
          const base = offeredPalm(fig, side);
          for (const [ox, oy] of PROBE_OFFSETS) {
            const goal: Point2 = [base[0] + ox * len * s, base[1] + oy * len * s];
            if (!reachable({ ...fig, character: ch }, side, goal)) {
              reported += 1;
              continue;
            }
            ctx.check();
            const { miss } = reachPalmChecked(fig, side, goal);
            ctx.metric('contact: max palm-on-object miss px (reachable goals)', miss);
            if (miss <= objectContactLimit()) continue;
            ctx.fail({
              view: yaw,
              pose: `object ${side} s ${str(s)} lean ${str(lean)} offset ${str(ox)}/${str(oy)}`,
              message: `${side} palm lands ${fmt(miss)} px from a reachable point`,
              fix: 'the face guard or the IK clamp moves the hand: check D.head (it must not cover the chest) and the arm lengths l1a / l2a',
              measured: miss,
              limit: objectContactLimit(),
            });
          }
        }
      }
    }
  }
  ctx.metric('contact: object goals out of reach (reported)', reported);
}

/** Handshakes and palms on objects meet their point within `contactPx`. */
export function contactMiss(ctx: RuleContext): void {
  handshakes(ctx);
  objects(ctx);
}
