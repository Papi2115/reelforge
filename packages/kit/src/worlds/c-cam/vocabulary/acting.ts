/**
 * Grim Ink acting (PLAN.md#14.20): the registry of `env.ink.acting.*` (and `ink.acting.*` in
 * modules) — two-body physical gags and choreography from the films, each `({ a, b, t, t0, dur, …
 * })` with `a` / `b` = `{ who: kit.people.<id>, x, y, s, view, pose?, bow?, lean? }`, returning
 * `{ u, a, b, contact?, item?, impact?, gripA?, gripB?, rotA?, rotB? }`: `a` and `b` spread into
 * `person.draw(g, cam.env, { …res.a, t: env.t })`, the item / grips are where the scene draws the
 * thing, the impact feeds `fx.impact`. Nothing is drawn by these functions.
 */
import { checkedRuns } from './common.js';
import {
  clink,
  clinkSchema,
  dropCatch,
  dropCatchSchema,
  handOver,
  handOverSchema,
  handshake,
  handshakeSchema,
  push,
  pushSchema,
} from './acting-gags.js';
import {
  bow,
  bowSchema,
  doubleTake,
  doubleTakeSchema,
  flinch,
  flinchSchema,
  handOn,
  handOnSchema,
  headShake,
  headShakeSchema,
  pointTurn,
  pointTurnSchema,
  stumble,
  stumbleSchema,
  tug,
  tugSchema,
} from './acting-more.js';

const AB = 'a, b = { who, x, y, s, view, pose?, bow?, lean? }; t, t0';
const CUES = 'a, b (person.draw options), u';

export const ACTING_ITEMS = {
  clink: {
    doc: 'two held things (blades, cups, tools) swing into each other by accident: both hands travel, meet, recoil; both heads jolt',
    params: `${AB}; dur = 1.2; handA, handB L|R; at [x, y] (where they meet; default between the palms); gap (px from palm to the end that meets: a blade's length)`,
    returns: `${CUES}, contact, impact (from the hit), gripA / gripB + rotA / rotB (draw props.weapon there)`,
    schema: clinkSchema,
    run: clink,
  },
  handshake: {
    doc: 'right palms meet between them and pump on twos, then let go',
    params: `${AB}; dur = 1.6; pumps = 3`,
    returns: `${CUES}, contact`,
    schema: handshakeSchema,
    run: handshake,
  },
  handOver: {
    doc: "a thing travels from a's palms to b's (or to a surface point) on an arc; the receiver sags and leans under its weight",
    params:
      'a, b? = figures; to [x, y] (instead of b); t, t0; dur = 1.2; hands one|both; weight 0-1; arc px',
    returns: `${CUES}, item { x, y, held } (draw the thing there), contact`,
    schema: handOverSchema,
    run: handOver,
  },
  dropCatch: {
    doc: "a drops it; it falls with a spin and b's palm lunges to catch it, or (catch: false) it lands, bounces and rolls to b's feet",
    params: 'a, b? = figures; t, t0; dur = 1.0; hand L|R; catch; floor (y); rollTo (x)',
    returns: `${CUES}, item { x, y, rot, held }, contact`,
    schema: dropCatchSchema,
    run: dropCatch,
  },
  push: {
    doc: "a's palms land on b's chest and shove: b steps back and tips, a follows through",
    params: `${AB}; dur = 0.9; force 0-2`,
    returns: `${CUES} (x moves), contact`,
    schema: pushSchema,
    run: push,
  },
  stumble: {
    doc: "a trips (lurch, arms out, a foot up) and recovers; with b and catch, b's palms land on a's chest and stop the fall",
    params: 'a, b? = figures; t, t0; dur = 1.0; dir 1|-1 (default toward b); catch',
    returns: `${CUES}, contact`,
    schema: stumbleSchema,
    run: stumble,
  },
  flinch: {
    doc: 'a raises a hand at b; b jerks back, hands up, with a jolt',
    params: `${AB}; dur = 0.8; hand L|R`,
    returns: CUES,
    schema: flinchSchema,
    run: flinch,
  },
  bow: {
    doc: 'a bows; b answers lower (outdo > 0) or shallower, palms flat on the thighs; rank in one gesture',
    params: `${AB}; dur = 1.6; depth = 30 (deg); outdo = 12; hold`,
    returns: CUES,
    schema: bowSchema,
    run: bow,
  },
  pointTurn: {
    doc: "a points at b's head; b turns round on the view ring to face a, with a jolt and a confused face",
    params: `${AB}; dur = 1.2; hand L|R`,
    returns: `${CUES} (b.view walks the ring), contact (b's head)`,
    schema: pointTurnSchema,
    run: pointTurn,
  },
  tug: {
    doc: 'both grip one thing between them and pull on twos; it jerks back and forth, both lean away',
    params: `${AB}; dur = 2.0; pull 0-2; len (the thing's length px); y`,
    returns: `${CUES}, item (its centre: draw it there, len wide), contact`,
    schema: tugSchema,
    run: tug,
  },
  doubleTake: {
    doc: 'a glances at b (or a point), looks away, then snaps back with a jolt and a shocked face',
    params: 'a, b? = figures; at [x, y]; t, t0; dur = 1.0',
    returns: `${CUES} (headYaw)`,
    schema: doubleTakeSchema,
    run: doubleTake,
  },
  headShake: {
    doc: 'the slow "no": the head swings three-quarter left, front, three-quarter right on twos (one person)',
    params: 'a = figure; t, t0; dur = 1.5; period = 0.25',
    returns: 'a (headYaw), u',
    schema: headShakeSchema,
    run: headShake,
  },
  handOn: {
    doc: 'a puts a palm ON b (shoulder, neck, hip, a hand) and holds or squeezes on twos; b reacts',
    params: `${AB}; dur = 0.8; hand L|R; on shoulder (the nearer one)|shoulderNear|shoulderFar|neck|hipNear|hipFar|palm.L|palm.R; squeeze`,
    returns: `${CUES}, contact`,
    schema: handOnSchema,
    run: handOn,
  },
} as const;

/** `env.ink.acting`: `(opts)` per gag, options checked. */
export const ACTING = checkedRuns('acting', ACTING_ITEMS);
