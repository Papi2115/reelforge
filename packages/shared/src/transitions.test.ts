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
  isWowStyle,
  TRANSITION_STYLE_IDS,
  TRANSITION_STYLE_LIST,
  TRANSITION_STYLES,
  transitionSuits,
  WOW_STYLE_IDS,
  WOW_STYLE_LIST,
} from './transitions.js';
import {
  continuesScaleSequence,
  WOW_RULES,
  wowBudget,
  wowContentMatches,
  wowOccurrences,
  wowStyleOf,
} from './wow-transitions.js';

const LOOKS = ['voxel', 'retro-ui', 'diorama', 'blueprint'] as const;
const ROLLS: readonly Roll[] = ['A', 'B', 'C'];

describe('transition styles', () => {
  it('are consistent: ids, duration ranges inside 0.2-0.8 s (wow: 0.5-1.4 s), plain types', () => {
    expect(TRANSITION_STYLE_LIST.map((style) => style.id)).toEqual([...TRANSITION_STYLE_IDS]);
    expect(WOW_STYLE_LIST.map((style) => style.id)).toEqual([...WOW_STYLE_IDS]);
    for (const style of TRANSITION_STYLE_LIST) {
      const { min, max } = style.duration;
      const { wow } = style;
      expect(min, style.id).toBeGreaterThanOrEqual(wow === undefined ? 0.2 : 0.5);
      expect(max, style.id).toBeLessThanOrEqual(wow === undefined ? 0.8 : 1.4);
      if (wow !== undefined) expect(wow.content.length, style.id).toBeGreaterThanOrEqual(3);
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
    // Intents name no content, so no wow transition: every other style is used.
    expect(used.size).toBe(TRANSITION_STYLE_IDS.length - WOW_STYLE_IDS.length);
    expect(assignTransitionStyles(shots, 2115)).toEqual({ shots: assigned, changed });
  });

  it('picks wow styles only for matching content, within the budget, over 8 minutes', () => {
    const intents = [
      'A detective searches the desk for a clue.',
      'The archive of old records and documents.',
      'Someone spying on the harbour through the fog.',
      'The secret room behind the locked door.',
      'The server crash takes the bank down.',
      'A chart of the numbers.',
    ];
    const shots: StoryboardShot[] = [];
    let t = 0;
    for (let index = 0; t < 480; index += 1) {
      const hash = transitionHash(`wow${String(index)}`);
      const length = 3 + (hash % 5);
      const id = `s${String(index).padStart(3, '0')}`;
      shots.push(
        storyboardShotSchema.parse({
          id,
          t0: t,
          t1: t + length,
          treatment: 'metaphor-object',
          intent: intents[index % intents.length],
          scene: `scenes/${id}.js`,
          look: LOOKS[(hash >>> 8) % LOOKS.length],
          ...(index === 0 ? {} : { transitionIn: { type: 'wipe', duration: 0.4 } }),
        }),
      );
      t += length;
    }
    const { shots: assigned } = assignTransitionStyles(shots, 77);
    const moments = wowOccurrences(assigned);
    expect(moments.length).toBeGreaterThanOrEqual(3);
    expect(moments.length).toBeLessThanOrEqual(wowBudget(480));
    moments.forEach((moment, index) => {
      const shot = assigned[moment.index];
      expect(moment.t).toBeGreaterThanOrEqual(WOW_RULES.hookS);
      expect(wowContentMatches(moment.style, shot?.intent ?? ''), moment.shotId).toBe(true);
      expect(
        wowStyleOf(assigned[moment.index - 1]),
        `${moment.shotId}: two in a row`,
      ).toBeUndefined();
      const before = moments[index - 1];
      if (before === undefined) return;
      expect(moment.t - before.t, moment.shotId).toBeGreaterThanOrEqual(WOW_RULES.warnSpacingS);
      const sameStyle = moments.filter(
        (other) => other.style.id === moment.style.id && other !== moment,
      );
      for (const other of sameStyle) {
        expect(Math.abs(other.t - moment.t)).toBeGreaterThanOrEqual(WOW_RULES.repeatWindowS);
      }
      expect(shot !== undefined && shot.t1 - shot.t0 >= moment.style.duration.default).toBe(true);
    });
  });

  it('matches content tags by word stem and leaves wow styles out unless allowed', () => {
    const { 'paper-roll': roll, 'enter-keyhole': keyhole } = TRANSITION_STYLES;
    expect(wowContentMatches(roll, 'A stack of Documents on the desk')).toBe(true);
    expect(wowContentMatches(roll, 'A rocket launch')).toBe(false);
    expect(wowContentMatches(keyhole, 'the SECRETS of the vault')).toBe(true);
    for (let seed = 0; seed < 50; seed += 1) {
      expect(isWowStyle(transitionFor('voxel', 'voxel', {}, seed).style)).toBe(false);
    }
    const allowed = Array.from({ length: 60 }, (_, seed) =>
      transitionFor('voxel', 'voxel', {}, transitionHash(String(seed)), {
        wow: { content: 'a secret door', avoid: [] },
      }),
    );
    expect(allowed.some((choice) => choice.style === 'enter-keyhole')).toBe(true);
    expect(
      allowed.every((choice) => !isWowStyle(choice.style) || choice.style === 'enter-keyhole'),
    ).toBe(true);
    const avoided = Array.from({ length: 60 }, (_, seed) =>
      transitionFor('voxel', 'voxel', {}, transitionHash(String(seed)), {
        wow: { content: 'a secret door', avoid: ['enter-keyhole'] },
      }),
    );
    expect(avoided.some((choice) => isWowStyle(choice.style))).toBe(false);
  });

  it('chains dives only over shots marked as a scale sequence', () => {
    const shot = (id: string, t0: number, scaleSequence: boolean, style?: string) =>
      storyboardShotSchema.parse({
        id,
        t0,
        t1: t0 + 4,
        treatment: 'map',
        intent: 'x',
        scene: `scenes/${id}.js`,
        ...(scaleSequence ? { scaleSequence } : {}),
        ...(style === undefined
          ? {}
          : { transitionIn: { type: 'crossfade', duration: 0.9, style } }),
      });
    const chain = [
      shot('a', 0, true),
      shot('b', 4, true, 'dive-out'),
      shot('c', 8, true, 'dive-out'),
      shot('d', 12, false, 'dive-out'),
    ];
    expect(continuesScaleSequence(chain, 1)).toBe(false);
    expect(continuesScaleSequence(chain, 2)).toBe(true);
    expect(continuesScaleSequence(chain, 3)).toBe(false);
    expect(wowOccurrences(chain).map((moment) => moment.chained)).toEqual([false, true, false]);
    expect(wowBudget(30)).toBe(1);
    expect(wowBudget(480)).toBe(12);
  });

  it('parses a focus point within the frame', () => {
    expect(
      transitionSchema.parse({
        type: 'wipe',
        duration: 1,
        style: 'enter-lens',
        focus: { x: 0.2, y: 1 },
      }),
    ).toMatchObject({ focus: { x: 0.2, y: 1 } });
    expect(
      transitionSchema.safeParse({ type: 'wipe', duration: 1, focus: { x: 1.2, y: 0.5 } }).success,
    ).toBe(false);
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
