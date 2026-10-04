import { describe, expect, it } from 'vitest';
import {
  storyboardShotSchema,
  transitionSchema,
  type Roll,
  type StoryboardShot,
} from './storyboard.js';
import { assignTransitionStyles, transitionFor, transitionHash } from './transition-picker.js';
import {
  getTransitionStyle,
  TRANSITION_STYLE_IDS,
  TRANSITION_STYLE_LIST,
  TRANSITION_STYLES,
  transitionSuits,
} from './transitions.js';

const LOOKS = ['voxel', 'retro-ui', 'diorama', 'blueprint'] as const;
const ROLLS: readonly Roll[] = ['A', 'B', 'C'];

describe('transition styles', () => {
  it('are consistent: ids, duration ranges inside 0.2-0.8 s, plain types', () => {
    expect(TRANSITION_STYLE_LIST.map((style) => style.id)).toEqual([...TRANSITION_STYLE_IDS]);
    for (const style of TRANSITION_STYLE_LIST) {
      const { min, max } = style.duration;
      expect(min, style.id).toBeGreaterThanOrEqual(0.2);
      expect(max, style.id).toBeLessThanOrEqual(0.8);
      expect(style.duration.default, style.id).toBeGreaterThanOrEqual(min);
      expect(style.duration.default, style.id).toBeLessThanOrEqual(max);
      expect(['crossfade', 'glitch', 'wipe']).toContain(style.type);
      expect(style.pairs.length, style.id).toBeGreaterThan(0);
      expect(style.vibe.length, style.id).toBeGreaterThan(0);
    }
  });

  it('keep old transitions valid and accept a style', () => {
    expect(transitionSchema.parse({ type: 'wipe', duration: 0.4 })).toEqual({
      type: 'wipe',
      duration: 0.4,
    });
    expect(transitionSchema.parse({ type: 'wipe', duration: 0.4, style: 'draw-over' })).toEqual({
      type: 'wipe',
      duration: 0.4,
      style: 'draw-over',
    });
    expect(
      transitionSchema.safeParse({ type: 'wipe', duration: 0.4, style: 'Bad Id' }).success,
    ).toBe(false);
    expect(getTransitionStyle('nope')).toBeUndefined();
    expect(getTransitionStyle('iris')).toBe(TRANSITION_STYLES.iris);
  });

  it('match look pairs: specials only on look changes, melt only with a C-roll', () => {
    const {
      'crt-zoom': crt,
      'pixel-sort-melt': melt,
      'dither-dissolve': dissolve,
    } = TRANSITION_STYLES;
    expect(transitionSuits(crt, 'voxel', 'retro-ui')).toBe(true);
    expect(transitionSuits(crt, 'retro-ui', 'blueprint')).toBe(true);
    expect(transitionSuits(crt, 'retro-ui', 'retro-ui')).toBe(false);
    expect(transitionSuits(crt, 'voxel', 'diorama')).toBe(false);
    expect(transitionSuits(melt, 'voxel', 'diorama', { to: 'C' })).toBe(true);
    expect(transitionSuits(melt, 'voxel', 'diorama', { from: 'A', to: 'B' })).toBe(false);
    expect(transitionSuits(melt, 'voxel', 'voxel', { to: 'C' })).toBe(false);
    expect(transitionSuits(dissolve, 'voxel', 'voxel')).toBe(true);
  });
});

describe('transitionFor', () => {
  it('is deterministic and avoids the previous style', () => {
    const first = transitionFor('voxel', 'retro-ui', { to: 'B' }, 7);
    expect(transitionFor('voxel', 'retro-ui', { to: 'B' }, 7)).toEqual(first);
    const next = transitionFor('voxel', 'retro-ui', { to: 'B' }, 7, { recent: [first.style] });
    expect(next.style).not.toBe(first.style);
  });

  it('prefers the look-change specials where the look changes', () => {
    let specials = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const choice = transitionFor('voxel', 'blueprint', {}, transitionHash(String(seed)));
      if (getTransitionStyle(choice.style)?.lookChange === true) specials += 1;
    }
    // 1 special (weight 3) among 6 plain styles: about a third.
    expect(specials).toBeGreaterThan(40);
    expect(specials).toBeLessThan(120);
  });

  it('holds over a synthetic 8-minute storyboard', () => {
    const shots: StoryboardShot[] = [];
    let t = 0;
    for (let index = 0; t < 480; index += 1) {
      const hash = transitionHash(`shot${String(index)}`);
      const length = 3 + (hash % 5);
      const look = LOOKS[(hash >>> 8) % LOOKS.length] ?? 'voxel';
      const roll = ROLLS[(hash >>> 12) % ROLLS.length] ?? 'A';
      const id = `s${String(index).padStart(3, '0')}`;
      shots.push(
        storyboardShotSchema.parse({
          id,
          t0: t,
          t1: t + length,
          treatment: 'metaphor-object',
          intent: 'x',
          scene: `scenes/${id}.js`,
          roll,
          look,
          ...(index === 0 ? {} : { transitionIn: { type: 'crossfade', duration: 0.5 } }),
        }),
      );
      t += length;
    }
    const { shots: assigned, changed } = assignTransitionStyles(shots, 2115);
    expect(changed).toHaveLength(shots.length - 1);
    let previous: string | undefined;
    const used = new Set<string>();
    assigned.forEach((shot, index) => {
      const transition = shot.transitionIn;
      const before = assigned[index - 1];
      if (transition === undefined || transition.type === 'cut' || before === undefined) return;
      const style = getTransitionStyle(transition.style);
      expect(style, shot.id).toBeDefined();
      if (style === undefined) return;
      used.add(style.id);
      expect(transition.type).toBe(style.type);
      expect(transition.duration).toBeGreaterThanOrEqual(style.duration.min);
      expect(transition.duration).toBeLessThanOrEqual(style.duration.max);
      expect(style.id, `${shot.id} repeats the previous style`).not.toBe(previous);
      if (before.look === shot.look) expect(style.lookChange, shot.id).toBe(false);
      expect(
        transitionSuits(style, before.look ?? 'voxel', shot.look ?? 'voxel', {
          from: before.roll,
          to: shot.roll,
        }),
      ).toBe(true);
      previous = style.id;
    });
    expect(used.size).toBe(TRANSITION_STYLE_IDS.length);
    expect(assignTransitionStyles(shots, 2115)).toEqual({ shots: assigned, changed });
  });

  it('aligns the type of a named style, keeps cuts, unknown styles and the first shot', () => {
    const shot = (id: string, look: string, transitionIn?: StoryboardShot['transitionIn']) =>
      storyboardShotSchema.parse({
        id,
        t0: 0,
        t1: 4,
        treatment: 'map',
        intent: 'x',
        scene: `scenes/${id}.js`,
        look,
        ...(transitionIn === undefined ? {} : { transitionIn }),
      });
    const shots = [
      shot('a', 'voxel', { type: 'crossfade', duration: 0.5 }),
      shot('b', 'blueprint', { type: 'crossfade', duration: 0.5, style: 'draw-over' }),
      shot('c', 'blueprint', { type: 'cut' }),
      shot('d', 'voxel', { type: 'glitch', duration: 0.3, style: 'nope' }),
    ];
    const { shots: result, changed } = assignTransitionStyles(shots, 1);
    expect(changed).toEqual(['b']);
    expect(result[0]).toBe(shots[0]);
    expect(result[1]?.transitionIn).toEqual({ type: 'wipe', duration: 0.5, style: 'draw-over' });
    expect(result[2]).toBe(shots[2]);
    expect(result[3]).toBe(shots[3]);
  });
});
