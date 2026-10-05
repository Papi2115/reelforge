import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../kit.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import type { CharacterObject } from './character.js';
import { CLIPS, EXPRESSIONS, POSE_KEYS } from './clips.js';
import { FACE_EXPRESSIONS, SCREEN_FACES, screenPixels } from './expressions.js';
import { MASCOTS } from './mascots.js';
import { mascotFx, NO_MASCOT_FX } from './reaction-fx.js';
import {
  applyReactions,
  NO_CHANNELS,
  REACTION_INFO,
  REACTION_LENGTH,
  reactionAt,
  REACTIONS,
  type ReactionCue,
  type ReactionName,
} from './reactions.js';

const PERSONALITY = { energy: 1, lag: 0.15, phase: 0.7, longArms: false };
const CALM = CLIPS.calm(0, 1, 1).pose;
const BIG: readonly ReactionName[] = ['surprise', 'double-take', 'jaw-drop'];

function cue(name: ReactionName, at = 1): ReactionCue {
  return { at, name, toward: undefined };
}

function sample(name: ReactionName, step = 1 / 30): number[] {
  const values: number[] = [];
  for (let t = 0; t <= 4; t += step) {
    const reacted = applyReactions(CALM, [cue(name)], t, PERSONALITY);
    values.push(...POSE_KEYS.map((key) => reacted.pose[key]), reacted.glance);
  }
  return values;
}

describe('reactions (pure clips)', () => {
  it('names a face, a length and a doc line for every reaction', () => {
    for (const name of REACTIONS) {
      expect(REACTION_INFO[name], name).toMatch(/\(\d/);
      expect(REACTION_LENGTH[name], name).toBeGreaterThanOrEqual(1.5);
      const faces = new Set<string>();
      for (let l = 0; l < REACTION_LENGTH[name]; l += 0.05) {
        const face = reactionAt(name, l, 1).expression;
        if (face !== undefined) faces.add(face);
      }
      expect(faces.size, name).toBeGreaterThan(0);
      for (const face of faces) expect(EXPRESSIONS, name).toContain(face);
    }
  });

  it('are pure functions of t: same values in any evaluation order', () => {
    for (const name of REACTIONS) {
      const times = [0.9, 1.05, 1.3, 1.62, 2.4, 3.3, 1.12];
      const forward = times.map((t) => applyReactions(CALM, [cue(name)], t, PERSONALITY));
      const backward = [...times]
        .reverse()
        .map((t) => applyReactions(CALM, [cue(name)], t, PERSONALITY));
      expect(backward.reverse(), name).toEqual(forward);
      expect(sample(name), name).toEqual(sample(name));
    }
  });

  it('leave the pose untouched before the cue and settle back after their length', () => {
    for (const name of REACTIONS) {
      const before = applyReactions(CALM, [cue(name, 2)], 1.9, PERSONALITY);
      expect(before.pose, name).toEqual(CALM);
      expect(before.expression).toBeUndefined();
      const end = 2 + REACTION_LENGTH[name] + PERSONALITY.lag + 0.01;
      const after = applyReactions(CALM, [cue(name, 2)], end, PERSONALITY);
      for (const key of POSE_KEYS)
        expect(after.pose[key], `${name} ${key}`).toBeCloseTo(CALM[key], 9);
      expect(after.channels).toBe(NO_CHANNELS);
      // The spring has nearly settled 50 ms before the end (no pop when it lets go).
      const late = reactionAt(name, REACTION_LENGTH[name] - 0.05, 1);
      for (const value of Object.values(late.add)) expect(Math.abs(value), name).toBeLessThan(0.06);
      expect(Math.abs(late.hold), name).toBeLessThan(0.06);
    }
  });

  it('move the body clearly at their key beat, with spring overshoot on the big ones', () => {
    for (const name of REACTIONS) {
      let peak = 0;
      for (let l = 0; l < REACTION_LENGTH[name]; l += 1 / 60) {
        const reacted = applyReactions(CALM, [cue(name, 0)], l, PERSONALITY);
        for (const key of POSE_KEYS) peak = Math.max(peak, Math.abs(reacted.pose[key] - CALM[key]));
        peak = Math.max(peak, reacted.glance); // glance-camera turns the head to the camera
      }
      expect(peak, name).toBeGreaterThan(0.15);
    }
    for (const name of ['surprise', 'jaw-drop', 'shrug-grin', 'facepalm-lite'] as const) {
      const holds = Array.from({ length: 60 }, (_, i) => reactionAt(name, i / 60, 1).hold);
      expect(Math.max(...holds), name).toBeGreaterThan(1.02);
    }
  });

  it('turn the head late (it lags the body) and glance at the camera only in glance-camera', () => {
    const body = (t: number) => applyReactions(CALM, [cue('double-take', 0)], t, PERSONALITY);
    const lagged = body(0.4).pose.headY - CALM.headY;
    const direct = reactionAt('double-take', 0.4 - PERSONALITY.lag, 1).add.headY ?? 0;
    expect(lagged).toBeCloseTo(direct, 9);
    for (const name of REACTIONS) {
      const glances = Array.from(
        { length: 40 },
        (_, i) => applyReactions(CALM, [cue(name, 0)], i / 20, PERSONALITY).glance,
      );
      if (name === 'glance-camera') {
        expect(glances[1]).toBe(0); // a beat late
        expect(Math.max(...glances)).toBe(1);
      } else {
        expect(Math.max(...glances), name).toBe(0);
      }
    }
  });

  it('compose: a later reaction plays on top of an earlier one, the latest face wins', () => {
    const cues = [cue('surprise', 0), cue('brow-raise', 0.6)];
    const both = applyReactions(CALM, cues, 0.9, PERSONALITY);
    expect(both.expression).toBe('brow-raise');
    expect(both.expressionAt).toBe(0.6);
    const alone = applyReactions(CALM, [cue('brow-raise', 0.6)], 0.9, PERSONALITY);
    expect(both.pose.armLZ).not.toBeCloseTo(alone.pose.armLZ, 3);
  });
});

describe('reaction faces and mascot variants', () => {
  it('draws the four new faces on voxel and pixel faces', () => {
    for (const name of ['brow-raise', 'jaw-drop', 'wink', 'smug'] as const) {
      expect(FACE_EXPRESSIONS[name], name).toBeDefined();
      expect(SCREEN_FACES[name].eyes, name).toHaveLength(5);
    }
    expect(FACE_EXPRESSIONS.wink.wink).toBe(1);
    expect(FACE_EXPRESSIONS['jaw-drop'].mouth).toBe('gape');
    const neutral = screenPixels('neutral', 1, 1);
    const glitch = { eyeBoost: 0, squint: 0, glitch: 1, oo: false };
    expect(screenPixels('neutral', 1, 1, glitch)).not.toEqual(neutral);
    expect(screenPixels('neutral', 1, 1, glitch)).toEqual(screenPixels('neutral', 1, 1, glitch));
    expect(screenPixels('neutral', 1, 1, { ...glitch, glitch: 0, oo: true })).not.toEqual(neutral);
  });

  it('gives every mascot its own take on the big reactions', () => {
    const peak = (
      id: string,
      name: ReactionName,
      read: (fx: ReturnType<typeof mascotFx>) => number,
    ) => {
      let best = 0;
      for (let l = 0; l < REACTION_LENGTH[name]; l += 1 / 60) {
        best = Math.max(best, Math.abs(read(mascotFx(id, reactionAt(name, l, 1).channels))));
      }
      return best;
    };
    for (const name of BIG) {
      expect(
        peak('bulb', name, (fx) => fx.glow),
        `bulb ${name}`,
      ).toBeGreaterThan(0.5);
      expect(
        peak('screen', name, (fx) => fx.face.glitch),
        `screen ${name}`,
      ).toBeGreaterThan(0.5);
      expect(
        peak('screen', name, (fx) => (fx.face.oo ? 1 : 0)),
        `screen ${name}`,
      ).toBe(1);
      expect(
        peak('fox', name, (fx) => fx.tailPuff),
        `fox ${name}`,
      ).toBeGreaterThan(0.5);
      expect(
        peak('fox', name, (fx) => fx.earFlick),
        `fox ${name}`,
      ).toBeGreaterThan(0.1);
      expect(
        peak('bean', name, (fx) => fx.wobble),
        `bean ${name}`,
      ).toBeGreaterThan(0.05);
    }
    expect(peak('bean', 'brow-raise', (fx) => fx.face.squint)).toBeGreaterThan(0.4);
    expect(peak('bulb', 'nod-told-you', (fx) => fx.glow)).toBeGreaterThan(0.4);
    expect(mascotFx('bulb', NO_CHANNELS)).toBe(NO_MASCOT_FX);
    expect(peak('doctor', 'surprise', (fx) => fx.glow + fx.wobble + fx.face.glitch)).toBe(0);
  });
});

describe('character.reaction()', () => {
  function kit() {
    return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(5) }).api;
  }

  function state(character: CharacterObject): number[] {
    const values: number[] = [];
    character.traverse((node) => {
      values.push(node.rotation.x, node.rotation.y, node.rotation.z, node.position.y);
      values.push(node.scale.x, node.scale.y, node.visible ? 1 : 0);
    });
    return values;
  }

  it('reacts on every mascot and seeks deterministically in any order', () => {
    for (const id of MASCOTS) {
      const build = () =>
        kit()
          .cast.mascot(id, { seed: 3 })
          .reaction('surprise', { at: 1 })
          .reaction('glance-camera', { at: 3, toward: [2, 1.5, 8] })
          .reaction('nod-told-you', { at: 5 });
      const mascot = build();
      const times = [0.5, 1.15, 1.4, 3.6, 5.5, 6.9];
      const forward = times.map((t) => {
        mascot.update(t);
        return state(mascot);
      });
      const fresh = build();
      const backward = [...times].reverse().map((t) => {
        fresh.update(t);
        return state(fresh);
      });
      expect(backward.reverse(), id).toEqual(forward);
      const plain = kit().cast.mascot(id, { seed: 3 });
      plain.update(1.15);
      expect(state(plain), id).not.toEqual(forward[1]);
      plain.update(0.5);
      expect(state(plain), `${id} before the cue`).toEqual(forward[0]);
    }
  });

  it('moves the anchors with the reaction (annotations follow the hop and the lean)', () => {
    for (const id of MASCOTS) {
      const mascot = kit().cast.mascot(id, { seed: 2 }).reaction('surprise', { at: 1 });
      const plain = kit().cast.mascot(id, { seed: 2 });
      mascot.update(1.3);
      plain.update(1.3);
      expect(mascot.anchor('head').y, id).toBeGreaterThan(plain.anchor('head').y + 0.05);
      expect(mascot.anchor('handL').y, id).toBeGreaterThan(plain.anchor('handL').y);
      // The placement bounds stay the rest pose's (no jitter of on() placement).
      expect(mascot.bounds().max.y, id).toBeCloseTo(plain.bounds().max.y, 9);
    }
  });

  it('validates names and refuses cues after playback started', () => {
    const fox = kit().cast.mascot('fox');
    expect(() => fox.reaction('surprised')).toThrow(
      /did you mean "surprise"\?.*\.expression\('surprised'\)/,
    );
    expect(() => fox.reaction('wave')).toThrow(/unknown reaction "wave"/);
    expect(() => fox.reaction('glance-camera', { toward: 'camera' })).toThrow(
      /kit object or a point/,
    );
    fox.reaction('jaw-drop', { at: { t: 2 } });
    fox.update(0);
    expect(() => fox.reaction('surprise', { at: 3 })).toThrow(/after update\(\)/);
  });
});
