/**
 * The Game B2 kit calls quoted by the prompts (prompts `GAME_B2_SNIPPETS`) run through the real kit:
 * the film's asset pack (`ctx.worldAssets`) and a shot's one-off pack (loaded by the view), the indoor
 * and the outdoor worked levels (`checkLevel` inside `b2View`), the automap, tally and throw specs
 * and the HUD text checks throw on a call that drifted from the API, and view + HUD repaint at a few
 * times without an error. The level format of the prompt names every mood, sky and generator kind
 * the kit knows (read from the kit's own error messages).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { resolveStyle } from '@reelforge/engine';
import { checkLevel, createKit, type KitOptions, type KitRng } from '@reelforge/kit';
import { GAME_B2_SNIPPETS, worldPromptText, type GameB2Snippet } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';

/** The kit's own Three.js (the stages package does not depend on three). */
const KIT_DIR = path.resolve(import.meta.dirname, '..', '..', 'kit');
const three = createRequire(path.join(KIT_DIR, 'package.json'))('three') as KitOptions['three'];

/** Every spoken phrase of the snippets lands 2.2 s into the shot. */
const SHOT = { width: 640, height: 360, duration: 6 };
const anchor = (): { t: number } => ({ t: 2.2 });
const TIMES = [0, 1.5, 3, 4.2, 5.9];

interface Repaint {
  update(t: number): void;
}

/** A fixed stream (the snippets are checked, not looked at). */
function fixedRng(): KitRng {
  return Object.assign(() => 0.5, {
    range: (min: number, max: number) => (min + max) / 2,
    int: (min: number) => min,
    pick: <T>(items: readonly T[]): T => {
      const [first] = items;
      if (first === undefined) throw new RangeError('pick: empty list');
      return first;
    },
    fork: () => fixedRng(),
  });
}

function kitApi(): unknown {
  return createKit({
    three,
    palette: resolveStyle({ style: 'game-b2' }).palette,
    rng: fixedRng(),
    style: 'game-b2',
  }).api;
}

const literal = (code: string): Record<string, unknown> =>
  runInNewContext(`(${code})`) as Record<string, unknown>;
const FILM = (): Record<string, unknown> => literal(GAME_B2_SNIPPETS.assets);

/** Calls a snippet needs before it (damage pops off the meter, a placed sprite is defined). */
const BEFORE: Partial<Record<GameB2Snippet, readonly GameB2Snippet[]>> = {
  damage: ['meter'],
  place: ['defineSprite'],
};
const SETUP: readonly GameB2Snippet[] = [
  'assets',
  'level',
  'shotAssets',
  'outdoor',
  'view',
  'viewOutdoor',
  'hud',
];

interface RunOptions {
  readonly level?: Record<string, unknown>;
  readonly worldAssets?: unknown;
  readonly viewCode?: string;
}

/** Builds view + HUD (the indoor level by default), runs `code` and repaints both. */
function run(code: string, options: RunOptions = {}): void {
  const worldAssets = 'worldAssets' in options ? options.worldAssets : FILM();
  const scope: Record<string, unknown> = {
    kit: kitApi(),
    ctx: { shot: SHOT, anchor, worldAssets },
    LEVEL: options.level ?? literal(GAME_B2_SNIPPETS.level),
    OUTDOOR: literal(GAME_B2_SNIPPETS.outdoor),
    SHOT_ASSETS: literal(GAME_B2_SNIPPETS.shotAssets),
  };
  const view = runInNewContext(options.viewCode ?? GAME_B2_SNIPPETS.view, scope) as Repaint;
  scope['view'] = view;
  const hud = runInNewContext(GAME_B2_SNIPPETS.hud, scope) as Repaint;
  scope['hud'] = hud;
  runInNewContext(code, scope);
  for (const t of TIMES) {
    view.update(t);
    hud.update(t);
  }
}

function runSnippet(name: GameB2Snippet): void {
  run([...(BEFORE[name] ?? []), name].map((part) => GAME_B2_SNIPPETS[part]).join(';\n'));
}

/** The values a kit error lists: `(known: a, b)` or zod's `expected one of "a"|"b"`. */
function listed(message: string): string[] {
  const known = /\((?:known|ramps): ([^)]*)\)/.exec(message)?.[1];
  if (known !== undefined) return known.split(', ');
  const options = /expected one of (\S+)/.exec(message)?.[1] ?? '';
  return options.split('|').map((option) => option.replace(/"/g, ''));
}

/** The view's error for a pack with one entry (the asset checks run when the view is built). */
function assetError(section: string, entry: Record<string, unknown>): string {
  try {
    run('0', { worldAssets: { [section]: { probe: entry } } });
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  return '';
}

/** The ids of both worked packs, as the view hands them to `checkLevel`. */
function packIds(): { sprites: Set<string>; textures: Set<string> } {
  const packs = [FILM(), literal(GAME_B2_SNIPPETS.shotAssets)];
  const ids = (section: string): Set<string> =>
    new Set(packs.flatMap((pack) => Object.keys(pack[section] ?? {})));
  return { sprites: ids('sprites'), textures: ids('textures') };
}

function levelError(level: GameB2Snippet, patch: Record<string, unknown>): string {
  const checked = checkLevel({ ...literal(GAME_B2_SNIPPETS[level]), ...patch }, packIds());
  return checked.ok ? '' : checked.errors.join('\n');
}

describe('Game B2 snippets of the prompts', () => {
  const names = (Object.keys(GAME_B2_SNIPPETS) as GameB2Snippet[]).filter(
    (name) => !SETUP.includes(name),
  );

  it.each(names)('%s runs on the real kit', (name) => {
    expect(() => {
      runSnippet(name);
    }).not.toThrow();
  });

  it('builds the outdoor shot next to the film pack, one pack or a list of them', () => {
    const outdoor = { viewCode: GAME_B2_SNIPPETS.viewOutdoor };
    expect(() => {
      run('0', outdoor);
    }).not.toThrow();
    expect(() => {
      run('0', { ...outdoor, worldAssets: [FILM()] });
    }).not.toThrow();
    expect(() => {
      run('0', { ...outdoor, worldAssets: undefined });
    }).toThrow(/unknown sprite "pupil"/);
  });

  it('would fail on a call that drifted from the API', () => {
    const { automap, tally, throw: toss, level, act } = GAME_B2_SNIPPETS;
    const broken = (from: string, to: string): RunOptions => ({
      level: literal(level.replace(from, to)),
    });
    expect(() => {
      run('0', broken("'SSSSSSSSSSSSSSSSSSSSSS'", "'SSSSSSSSSSSSSSSSSSSSS.'"));
    }).toThrow(/border/);
    expect(() => {
      run('0', broken("W: { wall: 'panelling' }", "W: { wall: 'marble' }"));
    }).toThrow(/the film's assets\.textures: plaster/);
    expect(() => {
      run('0', { worldAssets: { sprites: { desk: { gen: 'object', kind: 'table' } } } });
    }).toThrow(/built-in sprite name/);
    expect(() => {
      run('0', { worldAssets: { icons: { chalk: { rows: ['pp'], legend: { p: '#ffffff' } } } } });
    }).toThrow(/not a game-b2 colour/);
    expect(() => {
      run(automap.replace(/intent: '[^']*', /, ''));
    }).toThrow(/intent/);
    expect(() => {
      run(automap.replace('cell: [15, 5]', 'cell: [0, 0]'));
    }).toThrow(/not inside a room/);
    expect(() => {
      run(tally.replace(/intent: '[^']*', /, ''));
    }).toThrow(/intent/);
    expect(() => {
      run(tally.replace("format: 'unit'", "format: 'roman'"));
    }).toThrow(/format/);
    expect(() => {
      run(toss.replace(/intent: '[^']*', /, ''));
    }).toThrow(/intent/);
    expect(() => {
      run(toss.replace("target: 'teacher'", "target: 'nobody'"));
    }).toThrow(/nobody/);
    expect(() => {
      run(toss.replace("icon: 'chalk'", "icon: 'quill'"));
    }).toThrow(/not an icon of the assets/);
    expect(() => {
      run(act.replace("'teacher'", "'cat'"));
    }).toThrow(/no clerk or person sprite/);
  });

  it('names every mood, sky, skyline, ramp and generator kind the kit knows in the format', () => {
    const format = worldPromptText('game-b2')?.missing ?? '';
    expect(levelError('level', {})).toBe('');
    expect(levelError('outdoor', {})).toBe('');
    const lists = {
      moods: listed(levelError('level', { mood: 'neon' })),
      skies: listed(levelError('outdoor', { sky: { preset: 'fog' } })),
      skylines: listed(levelError('outdoor', { sky: { skyline: 'reef' } })),
      ramps: listed(assetError('sprites', { gen: 'plant', kind: 'bush', leaf: 'teal' })),
      plants: listed(assetError('sprites', { gen: 'plant', kind: 'vine' })),
      creatures: listed(assetError('sprites', { gen: 'creature', kind: 'whale' })),
      hats: listed(assetError('sprites', { gen: 'person', hat: 'beret' })),
      outfits: listed(assetError('sprites', { gen: 'person', outfit: 'kilt' })),
      tools: listed(assetError('sprites', { gen: 'person', tool: 'flute' })),
      structures: listed(assetError('sprites', { gen: 'structure', kind: 'igloo' })),
      vehicles: listed(assetError('sprites', { gen: 'vehicle', kind: 'tram' })),
      objects: listed(assetError('sprites', { gen: 'object', kind: 'vase' })),
      textures: listed(assetError('textures', { gen: 'texture', kind: 'marble' })),
      icons: listed(assetError('icons', { gen: 'icon', kind: 'harp' })),
      ...Object.fromEntries(
        ['bird', 'quadruped', 'fish', 'insect', 'reptile'].map((kind) => [
          kind,
          listed(assetError('sprites', { gen: 'creature', kind, form: 'blob' })),
        ]),
      ),
    };
    for (const [name, list] of Object.entries(lists)) {
      expect(list.length, name).toBeGreaterThan(1);
      for (const value of list)
        expect(format, `${name}: ${value}`).toMatch(new RegExp(`\\b${value}\\b`));
    }
  });

  it('are quoted verbatim by the world prompt texts', () => {
    const all = JSON.stringify(worldPromptText('game-b2'));
    for (const code of Object.values(GAME_B2_SNIPPETS)) {
      expect(all).toContain(JSON.stringify(code).slice(1, -1));
    }
  });
});
