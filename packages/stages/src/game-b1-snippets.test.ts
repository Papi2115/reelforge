/**
 * The Game B1 kit calls quoted by the prompts (prompts `GAME_B1_SNIPPETS`) run through the real kit:
 * its zod schemas and checks (the fonts, the high-score table's beat of silence and hold, the
 * manual's blocks and correction, the seams' order) throw on a call that drifted from the API, and
 * the screen repaints at a few times without an error.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { resolveStyle } from '@reelforge/engine';
import { createKit, type KitOptions, type KitRng } from '@reelforge/kit';
import { GAME_B1_SNIPPETS, worldPromptText, type GameB1Snippet } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';

/** The kit's own Three.js (the stages package does not depend on three). */
const KIT_DIR = path.resolve(import.meta.dirname, '..', '..', 'kit');
const three = createRequire(path.join(KIT_DIR, 'package.json'))('three') as KitOptions['three'];

/** Every spoken phrase of the snippets lands 2.2 s into the shot. */
const SHOT = { width: 640, height: 360, duration: 6 };
const anchor = (): { t: number } => ({ t: 2.2 });
const TIMES = [0, 1.5, 2.45, 3, 4.2, 5.9];

interface Screen {
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
    palette: resolveStyle({ style: 'game-b1' }).palette,
    rng: fixedRng(),
    style: 'game-b1',
  }).api;
}

/** Calls a snippet needs before it (the calendar zoom zooms into the room's calendar). */
const BEFORE: Partial<Record<GameB1Snippet, readonly GameB1Snippet[]>> = {
  calendarZoom: ['room'],
};

/** Runs `code` on a fresh screen and repaints it. */
function run(code: string): Screen {
  const kit = kitApi();
  const ctx = { shot: SHOT, anchor };
  const screen = runInNewContext(GAME_B1_SNIPPETS.screen, { kit, ctx }) as Screen;
  runInNewContext(code, { kit, ctx, screen });
  for (const t of TIMES) screen.update(t);
  return screen;
}

function runSnippet(name: GameB1Snippet): void {
  run([...(BEFORE[name] ?? []), name].map((part) => GAME_B1_SNIPPETS[part]).join(';\n'));
}

describe('Game B1 snippets of the prompts', () => {
  const names = (Object.keys(GAME_B1_SNIPPETS) as GameB1Snippet[]).filter(
    (name) => name !== 'screen',
  );

  it.each(names)('%s runs on the real kit', (name) => {
    expect(() => {
      runSnippet(name);
    }).not.toThrow();
  });

  it('runs every snippet together on one screen (one shot can hold them)', () => {
    const { room, camera, year, progress, narrate, note, boss, tv } = GAME_B1_SNIPPETS;
    expect(() =>
      run([room, camera, year, progress, narrate, note, boss, tv].join(';\n')),
    ).not.toThrow();
  });

  it('would fail on a call that drifted from the API', () => {
    const { scoreTable, manual, calendarZoom, cartridge, levelSelect, note, boss } =
      GAME_B1_SNIPPETS;
    const noIntent = (code: string): string => code.replace(/intent: '[^']*', /, '');
    for (const code of [scoreTable, manual, calendarZoom, cartridge, levelSelect]) {
      expect(() => run(`${GAME_B1_SNIPPETS.room};\n${noIntent(code)}`)).toThrow(/intent/);
    }
    expect(() => run(calendarZoom)).toThrow(/room\(/);
    expect(() => run(scoreTable.replace('hero: 0', "hero: 0, initials: 'roman'"))).toThrow(
      /initials/,
    );
    expect(() => run(scoreTable.replace('slam: { at: 2.78 }', 'slam: { at: 1.2 }'))).toThrow(
      /silence|beat/,
    );
    expect(() => run(manual.replace("shape: 'cartridge'", "shape: 'dragon'"))).toThrow(/shape/);
    expect(() => run(cartridge.replace("action: 'pull'", "action: 'eject'"))).toThrow(/action/);
    expect(() => run(levelSelect.replace("icon: 'home'", "icon: 'castle'"))).toThrow(/icon/);
    expect(() => run(note.replace("'MORE TIME'", "'MORE TIME THAN ANYONE'"))).toThrow(/16/);
    expect(() => run(boss.replace('num: 1', 'num: 12'))).toThrow(/num/);
  });

  it('are quoted verbatim by the world prompt texts', () => {
    const all = JSON.stringify(worldPromptText('game-b1'));
    for (const code of Object.values(GAME_B1_SNIPPETS)) {
      expect(all).toContain(JSON.stringify(code).slice(1, -1));
    }
  });
});
