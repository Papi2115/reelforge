/**
 * Reactions of the character pack (ReelForge 2.3.7, docs/characters.md): short, human beats a
 * character plays on top of its current pose (`reaction('surprise', { at })`): a surprise, a
 * double-take, a glance at the camera, a raised brow, a jaw drop, a light facepalm, a shrug and
 * grin, an "I told you so" nod. Each is a pure clip of the time since its cue (the page's
 * personality: anticipation, spring overshoot, a lagging head) that adds to the pose, blends the
 * arms of a gesture, picks the face and drives channels the mascots turn into their own anatomy
 * (reaction-fx.ts: Bulb's glow, Screen's glitch, Fox's ears and tail, Bean's wobble and squint).
 */
import { POSE_KEYS, type Expression, type Pose, type PoseKey } from './clips.js';
import { bump, smooth, spring, TAU } from './math.js';
import { cueIndex, type Personality } from './timeline.js';

export const REACTIONS = [
  'surprise',
  'double-take',
  'glance-camera',
  'brow-raise',
  'jaw-drop',
  'facepalm-lite',
  'shrug-grin',
  'nod-told-you',
] as const;
export type ReactionName = (typeof REACTIONS)[number];

/** One line per reaction (kit-docs characters). */
export const REACTION_INFO: Readonly<Record<ReactionName, string>> = {
  surprise: 'squash, pop up with arms out, eyes wide (1.6 s)',
  'double-take': 'glances away, snaps back with bigger eyes and a double blink (2.1 s)',
  'glance-camera': 'head turns to the viewer a beat late, deadpan eye contact, back (1.9 s)',
  'brow-raise': 'one brow up, head tilt, sceptical half-smile (1.8 s)',
  'jaw-drop': 'mouth falls wide open, body leans back on soft knees (2.3 s)',
  'facepalm-lite': 'hand up to the chin, eyes shut, a sigh and a slow head shake (2.2 s)',
  'shrug-grin': 'shoulders up, palms out, sheepish grin (2 s)',
  'nod-told-you': 'two smug nods, chin up, then a wink (2.2 s)',
};

/** Seconds a reaction lasts (it is back on the pose afterwards). */
export const REACTION_LENGTH: Readonly<Record<ReactionName, number>> = {
  surprise: 1.6,
  'double-take': 2.1,
  'glance-camera': 1.9,
  'brow-raise': 1.8,
  'jaw-drop': 2.3,
  'facepalm-lite': 2.2,
  'shrug-grin': 2,
  'nod-told-you': 2.2,
};

/** What a reaction asks of the face and the secondary motion (0 = nothing). */
export interface ReactionChannels {
  /** Startle impulse at the key beat (0..1). */
  readonly pop: number;
  /** A big reaction (surprise, double-take, jaw drop) is on, after its beat (0..1). */
  readonly startle: number;
  /** Seconds since the key beat (negative before it). */
  readonly since: number;
  /** Seconds since the cue. */
  readonly local: number;
  /** Warm "told you" / sheepish glow (0..1). */
  readonly glow: number;
  readonly squint: number;
  readonly eyeBoost: number;
  /** Forced lid closure (0..1): the double-take's double blink, the deadpan blink. */
  readonly blink: number;
  /** Head toward the camera (0..1). */
  readonly glance: number;
  /** Happy secondary motion (Fox's wag, Bean's wobble) 0..1. */
  readonly wag: number;
}

export const NO_CHANNELS: ReactionChannels = {
  pop: 0,
  startle: 0,
  since: -1,
  local: -1,
  glow: 0,
  squint: 0,
  eyeBoost: 0,
  blink: 0,
  glance: 0,
  wag: 0,
};

type Offsets = Partial<Record<PoseKey, number>>;

export interface ReactionFrame {
  /** Added to the pose. */
  readonly add: Offsets;
  /** Targets the pose blends toward by `hold` (a spring: may overshoot). */
  readonly set: Offsets;
  readonly hold: number;
  readonly expression: Expression | undefined;
  readonly channels: ReactionChannels;
}

/** On between `rise` and `fall` s, fading 0.45 s each way. */
function held(local: number, rise: number, fall: number): number {
  return smooth(rise, rise + 0.12, local) * (1 - smooth(fall - 0.45, fall, local));
}

function channels(local: number, beat: number, values: Partial<ReactionChannels>) {
  return { ...NO_CHANNELS, local, since: local - beat, ...values };
}

function surprise(l: number, e: number): ReactionFrame {
  const dip = bump(0, 0.08, 0.1, 0.2, l);
  const up = spring(l - 0.1, 1.5, 5) * (1 - smooth(1.05, 1.6, l));
  const hop = l > 0.12 && l < 0.42 ? Math.sin((Math.PI * (l - 0.12)) / 0.3) : 0;
  return {
    add: {
      hipY: -0.9 * dip * e + 1.6 * e * hop,
      squash: -0.1 * dip * e + 0.12 * e * bump(0.1, 0.16, 0.26, 0.42, l),
      spineX: -0.1 * up,
      headX: -0.18 * up,
      headZ: 0.06 * up * e,
      shrug: 0.7 * up,
    },
    set: { armLZ: 1.05, armRZ: -1.05, armLX: -0.45, armRX: -0.45, elbowL: -1.2, elbowR: -1.2 },
    hold: up,
    expression: l >= 0.08 && l < 1.35 ? 'surprised' : undefined,
    channels: channels(l, 0.1, {
      pop: bump(0.08, 0.12, 0.3, 0.75, l),
      startle: held(l, 0.1, 1.5),
      eyeBoost: 0.3 * bump(0.1, 0.16, 0.3, 0.7, l) + 0.08 * held(l, 0.1, 1.4),
    }),
  };
}

function doubleTake(l: number, e: number): ReactionFrame {
  const away = smooth(0, 0.25, l);
  const back = spring(l - 0.6, 2, 6);
  const look = away * (1 - back);
  const after = held(l, 0.6, 2.1);
  const hop = l > 0.62 && l < 0.86 ? Math.sin((Math.PI * (l - 0.62)) / 0.24) : 0;
  return {
    add: {
      headY: 0.55 * look,
      headX: 0.06 * look - 0.12 * after,
      spineY: 0.1 * look,
      spineX: -0.09 * after,
      hipY: -0.6 * e * bump(0.52, 0.58, 0.6, 0.66, l) + 0.9 * e * hop,
      squash: 0.08 * e * hop,
      shrug: 0.5 * after,
    },
    set: {},
    hold: 0,
    expression: l < 0.6 ? 'neutral' : l < 1.9 ? 'surprised' : undefined,
    channels: channels(l, 0.6, {
      pop: bump(0.58, 0.62, 0.8, 1.2, l),
      startle: after,
      eyeBoost: 0.35 * after,
      blink: bump(0.66, 0.69, 0.71, 0.75, l) + bump(0.8, 0.83, 0.85, 0.89, l),
    }),
  };
}

function glanceCamera(l: number): ReactionFrame {
  const glance = smooth(0.12, 0.4, l) * (1 - smooth(1.3, 1.7, l));
  return {
    add: { headZ: 0.07 * glance, headX: -0.03 * glance },
    set: {},
    hold: 0,
    expression: l >= 0.2 && l < 1.5 ? 'sceptical' : undefined,
    channels: channels(l, 0.12, {
      glance,
      squint: 0.25 * glance,
      blink: bump(0.8, 0.84, 0.88, 0.94, l),
    }),
  };
}

function browRaise(l: number, e: number): ReactionFrame {
  const k = spring(l - 0.05, 1.4, 6) * (1 - smooth(1.35, 1.8, l));
  return {
    add: {
      headZ: -0.16 * k * e,
      headX: -0.07 * k,
      spineX: -0.03 * k,
      pelvisZ: 0.03 * k,
      shrug: 0.25 * k,
    },
    set: {},
    hold: 0,
    expression: l >= 0.05 && l < 1.55 ? 'brow-raise' : undefined,
    channels: channels(l, 0.05, { pop: 0.4 * bump(0.03, 0.08, 0.2, 0.5, l), squint: 0.3 * k }),
  };
}

function jawDrop(l: number, e: number): ReactionFrame {
  const lean = bump(0, 0.1, 0.12, 0.22, l);
  const k = spring(l - 0.18, 1.2, 4.5) * (1 - smooth(1.75, 2.3, l));
  return {
    add: {
      spineX: 0.06 * lean - 0.22 * k,
      headX: 0.05 * lean + 0.06 * k, // the face stays to the camera while the body leans back
      hipY: -0.8 * k * e,
      kneeL: 0.35 * k,
      kneeR: 0.35 * k,
      legLX: -0.17 * k,
      legRX: -0.17 * k,
      shrug: -0.4 * k,
    },
    set: { armLZ: 0.2, armRZ: -0.2, armLX: 0.4, armRX: 0.4, elbowL: -0.05, elbowR: -0.05 },
    hold: k,
    expression: l >= 0.18 && l < 2.05 ? 'jaw-drop' : undefined,
    channels: channels(l, 0.18, {
      pop: bump(0.16, 0.2, 0.35, 0.8, l),
      startle: held(l, 0.18, 2.2),
      eyeBoost: 0.2 * held(l, 0.18, 2.1),
    }),
  };
}

/**
 * "Lite": the pack's short arms cannot reach the eyes, so the hand comes up in front of the chin,
 * the eyes shut, the shoulders sigh (up, then slump) and the head shakes slowly.
 */
function facepalm(l: number): ReactionFrame {
  const k = spring(l - 0.12, 1.2, 6) * (1 - smooth(1.6, 2.2, l));
  const sigh = bump(0.02, 0.16, 0.22, 0.45, l);
  const shake = Math.sin(TAU * 1.6 * (l - 0.55)) * bump(0.5, 0.65, 1.3, 1.55, l);
  return {
    add: {
      headX: 0.08 * k,
      headY: 0.16 * shake,
      headZ: 0.05 * k,
      spineX: 0.04 * k,
      shrug: 0.6 * sigh - 0.35 * k,
    },
    set: { armRX: -2.3, armRY: 0.3, armRZ: 0.65, elbowR: -1.35 },
    hold: k,
    expression: l >= 0.15 && l < 1.9 ? 'sceptical' : undefined,
    channels: channels(l, 0.12, { blink: 0.9 * held(l, 0.3, 1.75) }),
  };
}

function shrugGrin(l: number, e: number): ReactionFrame {
  const up = spring(l - 0.06, 1.5, 6) * (1 - smooth(1.4, 2, l));
  const dip = bump(0, 0.06, 0.08, 0.16, l);
  return {
    add: {
      shrug: 1.3 * up,
      headZ: 0.22 * up,
      headX: -0.04 * up,
      spineZ: -0.05 * up * e,
      hipY: -0.5 * dip * e,
      squash: -0.05 * e * up,
    },
    set: { armLX: -0.25, armRX: -0.25, armLZ: 0.6, armRZ: -0.6, elbowL: -1.4, elbowR: -1.4 },
    hold: up,
    expression: l >= 0.08 && l < 1.8 ? 'joy' : undefined,
    channels: channels(l, 0.06, { glow: 0.3 * held(l, 0.1, 1.9), wag: held(l, 0.1, 1.9) }),
  };
}

function nodToldYou(l: number, e: number): ReactionFrame {
  const k = held(l, 0, 2.2);
  const nod = l > 0.15 && l < 1.15 ? 0.5 * (1 - Math.cos(TAU * 2 * (l - 0.15))) : 0;
  return {
    add: {
      headX: 0.2 * nod * e - 0.09 * k,
      headZ: 0.08 * k,
      spineX: -0.06 * k,
      hipY: -0.2 * nod,
    },
    set: {},
    hold: 0,
    expression: l >= 0.1 && l < 1.3 ? 'smug' : l < 1.75 ? 'wink' : undefined,
    channels: channels(l, 0.15, { glow: 0.45 * k, squint: 0.4 * k, wag: 0.6 * k }),
  };
}

/** The reaction `name`, `local` s after its cue (energy 0..1 scales hops and tilts). */
export function reactionAt(name: ReactionName, local: number, energy: number): ReactionFrame {
  const e = 0.5 + 0.5 * energy;
  switch (name) {
    case 'surprise':
      return surprise(local, e);
    case 'double-take':
      return doubleTake(local, e);
    case 'glance-camera':
      return glanceCamera(local);
    case 'brow-raise':
      return browRaise(local, e);
    case 'jaw-drop':
      return jawDrop(local, e);
    case 'facepalm-lite':
      return facepalm(local);
    case 'shrug-grin':
      return shrugGrin(local, e);
    case 'nod-told-you':
      return nodToldYou(local, e);
  }
}

export function isReaction(value: unknown): value is ReactionName {
  return typeof value === 'string' && (REACTIONS as readonly string[]).includes(value);
}

export interface ReactionCue {
  readonly at: number;
  readonly name: ReactionName;
  /** glance-camera: a kit object or world point to look at (default: straight out along +z). */
  readonly toward: unknown;
}

export interface ReactedPose {
  readonly pose: Pose;
  /** The face of the latest reaction that sets one, and when that reaction started. */
  readonly expression: Expression | undefined;
  readonly expressionAt: number;
  /** Channels of the latest active reaction. */
  readonly channels: ReactionChannels;
  /** Weight 0..1 of the active glance-camera and its cue (undefined: none). */
  readonly glance: number;
  readonly glanceCue: ReactionCue | undefined;
  /** Vertical hip velocity added by the reactions (hops), like hipVelocity. */
  readonly velocity: number;
}

const HEAD_KEYS = new Set<PoseKey>(['headX', 'headY', 'headZ']);

/** Reactions active at t, oldest first (a later cue does not cut an earlier one short). */
function active(cues: readonly ReactionCue[], t: number): ReactionCue[] {
  const last = cueIndex(cues, t);
  return cues.slice(0, last + 1).filter((cue) => t - cue.at < REACTION_LENGTH[cue.name]);
}

function offsetsAt(cues: readonly ReactionCue[], t: number, energy: number, key: PoseKey): number {
  let sum = 0;
  for (const cue of active(cues, t)) sum += reactionAt(cue.name, t - cue.at, energy).add[key] ?? 0;
  return sum;
}

/**
 * The pose at t with every active reaction applied in cue order: offsets added (the head's
 * `lag` s late, so it follows the body), gesture targets blended; plus the face and channels of
 * the latest one. Without an active reaction the pose is returned unchanged.
 */
export function applyReactions(
  pose: Pose,
  cues: readonly ReactionCue[],
  t: number,
  personality: Personality,
): ReactedPose {
  const now = active(cues, t);
  const result = { ...pose } as Record<PoseKey, number>;
  let expression: Expression | undefined;
  let expressionAt = -Infinity;
  let latest: ReactionChannels = NO_CHANNELS;
  let glance = 0;
  let glanceCue: ReactionCue | undefined;
  for (const cue of now) {
    const frame = reactionAt(cue.name, t - cue.at, personality.energy);
    for (const key of POSE_KEYS) {
      const target = frame.set[key];
      if (target !== undefined) result[key] += (target - result[key]) * frame.hold;
      if (!HEAD_KEYS.has(key)) result[key] += frame.add[key] ?? 0;
    }
    if (frame.expression !== undefined) {
      expression = frame.expression;
      expressionAt = cue.at;
    }
    latest = frame.channels;
    if (frame.channels.glance > 0) {
      glance = frame.channels.glance;
      glanceCue = cue;
    }
  }
  const late = t - personality.lag;
  for (const key of HEAD_KEYS) {
    const offset = offsetsAt(cues, late, personality.energy, key);
    if (offset !== 0) result[key] += offset;
  }
  const hip = (time: number): number => offsetsAt(cues, time, personality.energy, 'hipY');
  return {
    pose: result,
    expression,
    expressionAt,
    channels: latest,
    glance,
    glanceCue,
    velocity: now.length === 0 ? 0 : (hip(t) - hip(t - 0.1)) * 0.5,
  };
}
