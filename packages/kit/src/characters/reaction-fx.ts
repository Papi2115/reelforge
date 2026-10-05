/**
 * Reactions in each mascot's anatomy (2.3.7, reactions.ts): the shared channels (startle pop,
 * glow, squint, wag) become Bulb's flicker and glow pop, Screen's glitch then O_O and antenna
 * boing, Fox's ear flick, ears back and puffed tail, Bean's wobble, squint and sprout boing. Pure
 * functions of the channels (seeded flicker), so any frame renders the same in any order.
 */
import { NO_FACE_FX, type FaceFx } from './expressions.js';
import { bump, hash } from './math.js';
import { NO_CHANNELS, type ReactionChannels } from './reactions.js';

export interface MascotFx {
  readonly face: FaceFx;
  /** Bulb: glass glow 0..1 (the larger of this and the pose's glow) and rays 0..1. */
  readonly glow: number;
  readonly rays: number;
  /** Fox: ear flick (radians), ears laid back 0..1, tail puffed 0..1, fast wag 0..1. */
  readonly earFlick: number;
  readonly earsBack: number;
  readonly tailPuff: number;
  readonly wag: number;
  /** Bean: body roll from the feet (radians). */
  readonly wobble: number;
  /** Screen's antenna / Bean's sprout: extra swing (radians). */
  readonly boing: number;
}

export const NO_MASCOT_FX: MascotFx = {
  face: NO_FACE_FX,
  glow: 0,
  rays: 0,
  earFlick: 0,
  earsBack: 0,
  tailPuff: 0,
  wag: 0,
  wobble: 0,
  boing: 0,
};

/** Damped oscillation after the beat: amplitude 1, `hz`, decaying by `decay` per second. */
function ring(since: number, hz: number, decay: number): number {
  return since < 0 ? 0 : Math.exp(-decay * since) * Math.sin(2 * Math.PI * hz * since);
}

/** The glass flickers like the eureka ignition while the pop is on, then glows steadily. */
function bulbGlow(c: ReactionChannels): number {
  const flicker = c.pop > 0.05 ? (hash(Math.floor(c.since * 22) + 7) > 0.38 ? 1 : 0.2) : 0;
  return Math.max(flicker * Math.min(1, c.pop * 1.4), c.glow);
}

/** The effects of a reaction's channels on the character `id` (people: the face only). */
export function mascotFx(id: string, c: ReactionChannels): MascotFx {
  if (c === NO_CHANNELS) return NO_MASCOT_FX;
  const face: FaceFx = { ...NO_FACE_FX, eyeBoost: c.eyeBoost, squint: c.squint };
  const base: MascotFx = { ...NO_MASCOT_FX, face };
  switch (id) {
    case 'bulb': {
      const glow = bulbGlow(c);
      // Rays only for a real startle or a warm glow (a raised brow just flickers).
      const rays = Math.max(c.pop > 0.5 ? c.pop : 0, c.glow > 0.2 ? c.glow : 0);
      return { ...base, glow, rays };
    }
    case 'screen': {
      // Every reaction starts with a short glitch; a big one (the beat's) then shows O_O.
      const start = 0.5 * bump(0, 0.02, 0.1, 0.16, c.local);
      const beat = c.pop > 0.05 ? bump(0, 0.02, 0.18, 0.26, c.since) : 0;
      return {
        ...base,
        face: { ...face, glitch: Math.max(start, beat), oo: c.startle > 0.3 && c.since > 0.22 },
        boing: 0.35 * c.pop * ring(c.since, 3.2, 3),
      };
    }
    case 'fox':
      return {
        ...base,
        earFlick: 0.45 * ring(c.since, 6, 5),
        earsBack: c.startle,
        tailPuff: Math.min(1, c.startle * 0.8 + c.pop * 0.4),
        wag: c.wag,
      };
    case 'bean':
      return {
        ...base,
        face: { ...face, squint: Math.min(1, c.squint * 1.5) },
        wobble: (0.2 * Math.max(c.pop, c.startle) + 0.08 * c.wag) * ring(c.since, 2.6, 3),
        boing: 0.6 * Math.max(c.pop, 0.4 * c.wag) * ring(c.since, 3.5, 3.5),
      };
    default:
      return base;
  }
}
