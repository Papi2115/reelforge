import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  extractAnchorUses,
  castRoleInputs,
  kitExtensionInputs,
  segmentCacheKey,
  stableStringify,
  type RenderIdentity,
  type SegmentKeyInput,
} from './cache-key.js';
import { planShots, shotAtTime } from './shot-plan.js';

describe('extractAnchorUses', () => {
  it('finds literal anchor calls with optional nth', () => {
    const source = `
      const { anchor, rng } = ctx;
      const a = anchor('61 KB');
      const b = ctx.anchor("spec sheet", 2);
      const c = anchor(\`it's \\\`here\\\`\`);
    `;
    expect(extractAnchorUses(source)).toEqual([
      { phrase: '61 KB', nth: 1 },
      { phrase: 'spec sheet', nth: 2 },
      { phrase: "it's `here`", nth: 1 },
    ]);
  });

  it('returns [] for scenes without anchors', () => {
    expect(extractAnchorUses('export function build(ctx) { return {}; }')).toEqual([]);
  });

  it.each([
    ['a variable phrase', 'const p = "x"; anchor(p);'],
    ['an alias', 'const { anchor: at } = ctx; at("x");'],
    ['a template expression', 'anchor(`word ${n}`);'],
    ['a passed function', 'helper(ctx.anchor);'],
  ])('gives up (null) on %s', (_label, source) => {
    expect(extractAnchorUses(source)).toBeNull();
  });
});

describe('stableStringify', () => {
  it('sorts keys and drops undefined', () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: undefined }], e: null })).toBe(
      '{"a":[{"d":2}],"b":1,"e":null}',
    );
    expect(stableStringify({ x: 1, y: 2 })).toBe(stableStringify({ y: 2, x: 1 }));
  });
});

const identity: RenderIdentity = {
  engineVersion: 'e1',
  kitVersion: 'k1',
  style: { id: 's', width: 640, height: 360, preset: { a: 1, b: [1, 2] } },
};

function manifest(): RenderManifest {
  return {
    version: 1,
    fps: 30,
    seed: 1,
    words: { version: 1, words: [{ text: 'hi', t: 0.5, tEnd: 0.8 }] },
    shots: [
      { id: 'a', t0: 0, t1: 2, scene: { file: 'a.js', source: 'anchor("hi");' } },
      { id: 'b', t0: 2, t1: 4, scene: { file: 'b.js', source: 'return 1;' } },
    ],
  };
}

function keyOf(input: Partial<SegmentKeyInput> & { manifest: RenderManifest }, shot = 0): string {
  const planned = planShots(input.manifest).shots[shot];
  if (!planned) throw new Error('no shot');
  return segmentCacheKey({ planned, identity, outputKey: 'out', ...input });
}

describe('segmentCacheKey', () => {
  const base = keyOf({ manifest: manifest() });

  it('is stable and ignores style key order and the scene file name', () => {
    expect(keyOf({ manifest: manifest() })).toBe(base);
    const reordered = { ...identity, style: { ...identity.style, preset: { b: [1, 2], a: 1 } } };
    expect(keyOf({ manifest: manifest(), identity: reordered })).toBe(base);
    const renamed = manifest();
    const [first] = renamed.shots;
    if (first) renamed.shots[0] = { ...first, scene: { ...first.scene, file: 'renamed.js' } };
    expect(keyOf({ manifest: renamed })).toBe(base);
  });

  it.each<[string, (m: RenderManifest) => Partial<SegmentKeyInput>]>([
    ['engine version', () => ({ identity: { ...identity, engineVersion: 'e2' } })],
    ['kit version', () => ({ identity: { ...identity, kitVersion: 'k2' } })],
    [
      'style preset',
      () => ({ identity: { ...identity, style: { ...identity.style, preset: { a: 2 } } } }),
    ],
    ['output settings', () => ({ outputKey: 'other' })],
    ['seed', (m) => ({ manifest: { ...m, seed: 2 } })],
    ['fps', (m) => ({ manifest: { ...m, fps: 60 } })],
    ['palette', (m) => ({ manifest: { ...m, palette: { sky: '#000000' } } })],
    [
      'scene source',
      (m) => ({
        manifest: {
          ...m,
          shots: m.shots.map((s, i) =>
            i === 0 ? { ...s, scene: { ...s.scene, source: 'x' } } : s,
          ),
        },
      }),
    ],
    [
      'shot end',
      (m) => ({
        manifest: {
          ...m,
          shots: m.shots.map((s, i) => (i === 0 ? { ...s, t1: 2.5 } : { ...s, t0: 2.5 })),
        },
      }),
    ],
    [
      'word times (no resolver: all words count)',
      (m) => ({
        manifest: { ...m, words: { version: 1, words: [{ text: 'hi', t: 0.6, tEnd: 0.8 }] } },
      }),
    ],
  ])('changes with %s', (_label, change) => {
    const m = manifest();
    expect(keyOf({ manifest: m, ...change(m) })).not.toBe(base);
  });

  it('depends on the project props (kit-ext) a shot calls, not on the others', () => {
    const fridge = { name: 'fridge', file: 'kit-ext/props/fridge.js', source: 'v1' };
    const lamp = { name: 'lamp', file: 'kit-ext/props/lamp.js', source: 'v1' };
    const m = manifest();
    const shots = m.shots.map((s, i) =>
      i === 0 ? { ...s, scene: { ...s.scene, source: 'kit.props.fridge();' } } : s,
    );
    const withProps = { ...m, shots, kitExtensions: [fridge, lamp] };
    const key = keyOf({ manifest: withProps });
    const otherKey = keyOf({ manifest: withProps }, 1);
    const fridgeChanged = { ...withProps, kitExtensions: [{ ...fridge, source: 'v2' }, lamp] };
    expect(keyOf({ manifest: fridgeChanged })).not.toBe(key);
    expect(keyOf({ manifest: fridgeChanged }, 1)).toBe(otherKey);
    const lampChanged = { ...withProps, kitExtensions: [fridge, { ...lamp, source: 'v2' }] };
    expect(keyOf({ manifest: lampChanged })).toBe(key);
    // No project props at all: the same keys as before kit-ext existed.
    expect(keyOf({ manifest: { ...m, kitExtensions: [] } })).toBe(base);
    expect(kitExtensionInputs('const p = kit.props[name]();', [fridge, lamp])).toHaveLength(2);
  });

  it('depends on the project roles (characters/) a shot shows, not on the others', () => {
    const role = (id: string, source: string) => ({
      id,
      file: `characters/roles/${id}.json`,
      source,
    });
    const radio = {
      id: 'shoulderRadio',
      file: 'characters/accessories/shoulderRadio.json',
      source: 'r1',
    };
    const firefighter = role('firefighter', '{"id":"firefighter"}');
    const officer = role('policeOfficer', '{"id":"policeOfficer","accessories":["shoulderRadio"]}');
    const m = manifest();
    const shots = m.shots.map((s, i) =>
      i === 0 ? { ...s, scene: { ...s.scene, source: "kit.cast.person('police-officer');" } } : s,
    );
    const castRoles = { roles: [firefighter, officer], accessories: [radio] };
    const withRoles = { ...m, shots, castRoles };
    const key = keyOf({ manifest: withRoles });
    const otherKey = keyOf({ manifest: withRoles }, 1);
    const radioChanged = {
      ...withRoles,
      castRoles: { ...castRoles, accessories: [{ ...radio, source: 'r2' }] },
    };
    expect(keyOf({ manifest: radioChanged })).not.toBe(key);
    expect(keyOf({ manifest: radioChanged }, 1)).toBe(otherKey);
    const fireChanged = {
      ...withRoles,
      castRoles: { ...castRoles, roles: [role('firefighter', '{"v":2}'), officer] },
    };
    expect(keyOf({ manifest: fireChanged })).toBe(key);
    // No project roles at all: the same keys as before characters/ existed.
    expect(keyOf({ manifest: { ...m, castRoles: { roles: [], accessories: [] } } })).toBe(base);
    expect(castRoleInputs('kit.cast.person(who);', castRoles)?.roles).toHaveLength(2);
    expect(castRoleInputs("kit.cast.role({ id: 'x' });", castRoles)?.roles).toEqual([]);
  });

  it('depends on the world asset files (PLAN.md#13.15) of every shot, not their order', () => {
    const forest = { file: 'assets/comic/forest.json', source: '{"version":1}' };
    const sea = { file: 'assets/comic/sea.json', source: '{"version":1,"x":1}' };
    const m = manifest();
    const withAssets = (files: (typeof forest)[]): RenderManifest => ({
      ...m,
      worldAssets: { world: 'comic', files },
    });
    const key = keyOf({ manifest: withAssets([forest, sea]) });
    expect(key).not.toBe(base);
    expect(keyOf({ manifest: withAssets([sea, forest]) })).toBe(key);
    expect(keyOf({ manifest: withAssets([forest, { ...sea, source: '{}' }]) })).not.toBe(key);
    expect(keyOf({ manifest: withAssets([forest, sea]) }, 1)).not.toBe(keyOf({ manifest: m }, 1));
    // No world assets: the same keys as before the field existed.
    expect(keyOf({ manifest: m })).toBe(base);
  });

  it('with a resolver, depends on used anchor spans only', () => {
    const at = (t: number) => () => ({ t, tEnd: t + 0.3 });
    const m = manifest();
    const key = keyOf({ manifest: m, resolveAnchor: at(0.5) });
    const moreWords: RenderManifest = {
      ...m,
      words: { version: 1, words: [...(m.words?.words ?? []), { text: 'x', t: 3, tEnd: 3.2 }] },
    };
    expect(keyOf({ manifest: moreWords, resolveAnchor: at(0.5) })).toBe(key);
    expect(keyOf({ manifest: m, resolveAnchor: at(0.6) })).not.toBe(key);
    // Shot b uses no anchors: words never matter for it.
    expect(keyOf({ manifest: moreWords }, 1)).toBe(keyOf({ manifest: m }, 1));
  });

  it('includes the previous shot when the shot transitions in', () => {
    const cut = manifest();
    const crossfade: RenderManifest = {
      ...cut,
      shots: cut.shots.map((s, i) =>
        i === 1 ? { ...s, transitionIn: { type: 'crossfade', duration: 0.5 } } : s,
      ),
    };
    const editA = (m: RenderManifest): RenderManifest => ({
      ...m,
      shots: m.shots.map((s, i) => (i === 0 ? { ...s, scene: { ...s.scene, source: 'y' } } : s)),
    });
    expect(keyOf({ manifest: editA(cut) }, 1)).toBe(keyOf({ manifest: cut }, 1));
    expect(keyOf({ manifest: editA(crossfade) }, 1)).not.toBe(keyOf({ manifest: crossfade }, 1));
  });

  it('depends on ambient variation only when the manifest has it (PLAN.md#12.8)', () => {
    const off = manifest();
    const ambientShots = off.shots.map((s, index) => ({ ...s, ambient: { index, act: 0 } }));
    // Shot positions without the switch never reach the key: old keys stay valid.
    expect(keyOf({ manifest: { ...off, shots: ambientShots } })).toBe(base);
    const on: RenderManifest = {
      ...off,
      ambientVariation: { enabled: true, seed: 1 },
      shots: ambientShots,
    };
    expect(keyOf({ manifest: on })).not.toBe(base);
    const reseeded = { ...on, ambientVariation: { enabled: true, seed: 2 } };
    expect(keyOf({ manifest: reseeded })).not.toBe(keyOf({ manifest: on }));
    const moved: RenderManifest = {
      ...on,
      shots: on.shots.map((s, index) => ({ ...s, ambient: { index: index + 1, act: 0 } })),
    };
    expect(keyOf({ manifest: moved })).not.toBe(keyOf({ manifest: on }));
  });

  it('depends on reveal-moment effects only when a shot has them (PLAN.md#12.27)', () => {
    const plain = manifest();
    const slowed: RenderManifest = {
      ...plain,
      shots: plain.shots.map((s, index) =>
        index === 0 ? { ...s, timeRemap: [{ from: s.t0, to: s.t0 + 0.5, rate: 0.4 }] } : s,
      ),
    };
    expect(keyOf({ manifest: slowed })).not.toBe(base);
    const flashed: RenderManifest = {
      ...plain,
      shots: plain.shots.map((s, index) =>
        index === 0 ? { ...s, paletteShift: [{ from: s.t0, to: s.t0 + 0.5 }] } : s,
      ),
    };
    expect(keyOf({ manifest: flashed })).not.toBe(base);
    expect(keyOf({ manifest: flashed })).not.toBe(keyOf({ manifest: slowed }));
  });

  it('depends on live directions only when a shot has one (PLAN.md#12.14)', () => {
    const plain = manifest();
    const directed = (direction: { dim?: number; zoom?: number }): RenderManifest => ({
      ...plain,
      shots: plain.shots.map((s, index) => (index === 0 ? { ...s, direction } : s)),
    });
    expect(keyOf({ manifest: directed({ dim: -0.25 }) })).not.toBe(base);
    expect(keyOf({ manifest: directed({ dim: -0.25 }) })).not.toBe(
      keyOf({ manifest: directed({ zoom: 1.1 }) }),
    );
    expect(keyOf({ manifest: directed({ dim: -0.25 }) })).toBe(
      keyOf({ manifest: directed({ dim: -0.25 }) }),
    );
  });
});

describe('planShots', () => {
  it('tiles frames by rounding shot bounds and skips empty shots', () => {
    const plan = planShots({
      version: 1,
      fps: 30,
      seed: 1,
      shots: [
        { id: 'a', t0: 0, t1: 1.01, scene: { file: 'a', source: 'a' } },
        { id: 'b', t0: 1.01, t1: 1.015, scene: { file: 'b', source: 'b' } },
        { id: 'c', t0: 1.015, t1: 2.5, scene: { file: 'c', source: 'c' } },
      ],
    });
    expect(plan.totalFrames).toBe(75);
    expect(plan.durationS).toBe(2.5);
    expect(plan.shots.map((s) => [s.shot.id, s.startFrame, s.endFrame])).toEqual([
      ['a', 0, 30],
      ['c', 30, 75],
    ]);
    expect(shotAtTime(plan, 1.0)?.shot.id).toBe('c');
    expect(shotAtTime(plan, 0.99)?.shot.id).toBe('a');
    expect(shotAtTime(plan, 99)?.shot.id).toBe('c');
  });
});
