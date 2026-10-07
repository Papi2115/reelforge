/**
 * The Game B2 kit calls quoted by the prompts (prompts `GAME_B2_SNIPPETS`) run through the real kit:
 * the level format (`checkLevel` inside `b2View`), the automap, tally and throw specs, the HUD text
 * checks throw on a call that drifted from the API, and view + HUD repaint at a few times without
 * an error. The worked level of the prompt is the kit's built-in `office`: it paints the same pixels.
 */
import { createHash } from 'node:crypto';
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
  traverse(visit: (object: unknown) => void): void;
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

const LEVEL = (): Record<string, unknown> =>
  runInNewContext(`(${GAME_B2_SNIPPETS.level})`) as Record<string, unknown>;

/** The worked level with a clerk standing in the office (for `act`). */
function withClerk(): Record<string, unknown> {
  const level = LEVEL();
  const sprites = level['sprites'] as unknown[];
  return { ...level, sprites: [...sprites, { id: 'clerk', sprite: 'clerk', pos: [18.5, 4.5] }] };
}

/** Calls a snippet needs before it (damage pops off the meter). */
const BEFORE: Partial<Record<GameB2Snippet, readonly GameB2Snippet[]>> = {
  damage: ['meter'],
};
const SETUP: readonly GameB2Snippet[] = ['level', 'view', 'hud'];

/** Builds view + HUD on the worked level, runs `code` and repaints both. */
function run(code: string, level = LEVEL()): { view: Repaint; hud: Repaint } {
  const scope: Record<string, unknown> = { kit: kitApi(), ctx: { shot: SHOT, anchor } };
  scope['LEVEL'] = level;
  const view = runInNewContext(GAME_B2_SNIPPETS.view, scope) as Repaint;
  scope['view'] = view;
  const hud = runInNewContext(GAME_B2_SNIPPETS.hud, scope) as Repaint;
  scope['hud'] = hud;
  runInNewContext(code, scope);
  for (const t of TIMES) {
    view.update(t);
    hud.update(t);
  }
  return { view, hud };
}

function runSnippet(name: GameB2Snippet): void {
  const code = [...(BEFORE[name] ?? []), name].map((part) => GAME_B2_SNIPPETS[part]).join(';\n');
  run(code, name === 'act' ? withClerk() : LEVEL());
}

/** Hash of the view's raster at t (the quad's data texture). */
function frame(view: Repaint, t: number): string {
  view.update(t);
  const hash = createHash('sha256');
  view.traverse((object) => {
    const data = (object as { material?: { uniforms?: { map?: { value?: { image?: unknown } } } } })
      .material?.uniforms?.map?.value?.image;
    if (typeof data === 'object' && data !== null && 'data' in data) {
      hash.update(data.data as Uint8Array);
    }
  });
  return hash.digest('hex');
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

  it('writes out the built-in office level: the same pixels', () => {
    const scope = { kit: kitApi(), ctx: { shot: SHOT, anchor } };
    const builtIn = runInNewContext(
      GAME_B2_SNIPPETS.view.replace('level: LEVEL', "level: 'office', stencil: 'E.T.'"),
      scope,
    ) as Repaint;
    const { view } = run('0');
    for (const t of [0, 2.3]) expect(frame(view, t)).toBe(frame(builtIn, t));
  });

  it('would fail on a call that drifted from the API', () => {
    const { automap, tally, throw: toss, level } = GAME_B2_SNIPPETS;
    const broken = (from: string, to: string): Record<string, unknown> =>
      runInNewContext(`(${level.replace(from, to)})`) as Record<string, unknown>;
    expect(() => run('0', broken("'#####", "'####."))).toThrow(/border/);
    expect(() => run('0', broken("u: { wall: 'cubicle' }", "u: { wall: 'glass' }"))).toThrow(
      /wall texture/,
    );
    expect(() => run(automap.replace(/intent: '[^']*', /, ''))).toThrow(/intent/);
    expect(() => run(automap.replace('cell: [17, 5]', 'cell: [0, 0]'))).toThrow(
      /not inside a room/,
    );
    expect(() => run(tally.replace(/intent: '[^']*', /, ''))).toThrow(/intent/);
    expect(() => run(tally.replace("format: 'unit'", "format: 'roman'"))).toThrow(/format/);
    expect(() => run(toss.replace(/intent: '[^']*', /, ''))).toThrow(/intent/);
    expect(() => run(toss.replace("target: 'worker'", "target: 'nobody'"))).toThrow(/nobody/);
    expect(() => run(GAME_B2_SNIPPETS.act)).toThrow(/clerk/);
  });

  it('lists every wall, floor, ceiling, mood and sprite the level format knows', () => {
    const level = LEVEL();
    const known = (patch: Record<string, unknown>): string[] => {
      const checked = checkLevel({ ...level, ...patch });
      const message = checked.ok ? '' : checked.errors.join('\n');
      return /\(known: ([^)]*)\)/.exec(message)?.[1]?.split(', ') ?? [];
    };
    const legend = (entry: Record<string, unknown>): Record<string, unknown> => ({
      legend: { ...(level['legend'] as object), u: entry },
    });
    const lists = [
      known(legend({ wall: 'glass' })),
      known({ floor: 'marble' }),
      known({ ceiling: 'sky' }),
      known({ mood: 'neon' }),
      known({ sprites: [{ sprite: 'robot', pos: [2.5, 6.5] }] }),
    ];
    const format = worldPromptText('game-b2')?.missing ?? '';
    for (const list of lists) {
      expect(list.length).toBeGreaterThan(3);
      for (const value of list) expect(format).toContain(`'${value}'`);
    }
  });

  it('are quoted verbatim by the world prompt texts', () => {
    const all = JSON.stringify(worldPromptText('game-b2'));
    for (const code of Object.values(GAME_B2_SNIPPETS)) {
      expect(all).toContain(JSON.stringify(code).slice(1, -1));
    }
  });
});
