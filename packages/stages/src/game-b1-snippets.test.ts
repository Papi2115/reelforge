/**
 * The Game B1 kit calls quoted by the prompts (prompts `GAME_B1_SNIPPETS`) run through the real kit:
 * its zod schemas and checks (the 2600 sprite and playfield rules of the open vocabulary, the
 * generators, the room DSL, the fonts, the high-score table's beat of silence and hold, the
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

/** Calls a snippet needs before it (definitions it draws, the room whose calendar it zooms into). */
const BEFORE: Partial<Record<GameB1Snippet, readonly GameB1Snippet[]>> = {
  tv: ['defineSprite', 'spriteFrames', 'generatePerson', 'scenery'],
  interiorPoster: ['defineSprite'],
  calendarZoom: ['interior'],
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

const joined = (names: readonly GameB1Snippet[]): string =>
  names.map((part) => GAME_B1_SNIPPETS[part]).join(';\n');

function runSnippet(name: GameB1Snippet): void {
  run(joined([...(BEFORE[name] ?? []), name]));
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

  it('runs a whole shot together on one screen (one shot can hold them)', () => {
    const shot: GameB1Snippet[] = [
      'defineSprite',
      'spriteFrames',
      'generatePerson',
      'generateAnimal',
      'generateVehicle',
      'generateBoss',
      'scenery',
      'definePlayfield',
      'interiorPoster',
      'camera',
      'year',
      'progress',
      'narrate',
      'note',
      'boss',
      'tv',
      'counter',
    ];
    expect(() => run(joined(shot))).not.toThrow();
  });

  it('would fail on a call that drifted from the API', () => {
    const s = GAME_B1_SNIPPETS;
    const noIntent = (code: string): string => code.replace(/intent: '[^']*', /, '');
    for (const code of [s.scoreTable, s.manual, s.calendarZoom, s.cartridge, s.levelSelect]) {
      expect(() => run(`${s.interior};\n${noIntent(code)}`)).toThrow(/intent/);
    }
    expect(() => run(s.calendarZoom)).toThrow(/room\(/);
    expect(() => run(s.scoreTable.replace('hero: 0', "hero: 0, initials: 'roman'"))).toThrow(
      /initials/,
    );
    expect(() => run(s.scoreTable.replace('slam: { at: 2.78 }', 'slam: { at: 1.2 }'))).toThrow(
      /silence|beat/,
    );
    expect(() => run(s.manual.replace("shape: 'person'", "shape: 'dragon'"))).toThrow(/shape/);
    expect(() => run(s.cartridge.replace("action: 'insert'", "action: 'eject'"))).toThrow(/action/);
    expect(() => run(s.levelSelect.replace("icon: 'home'", "icon: 'castle'"))).toThrow(/icon/);
    expect(() => run(s.note.replace("'THE OLD PIER'", "'THE OLD PIER BY THE SEA'"))).toThrow(/16/);
    expect(() => run(s.boss.replace('num: 1', 'num: 12'))).toThrow(/num/);
  });

  it('would fail on sprites, playfields, generators and rooms that break the 2600 grammar', () => {
    const s = GAME_B1_SNIPPETS;
    expect(() => run(s.defineSprite.replace("'...##...'", "'...XX...'"))).toThrow(/'#'/);
    expect(() => run(s.defineSprite.replace("'...##...'", "'...##....'"))).toThrow(/8 bits/);
    expect(() => run(s.definePlayfield.replace("'#####...............'", "'#####'"))).toThrow(
      /20|40/,
    );
    expect(() => run(s.generateAnimal.replace("kind: 'animal'", "kind: 'dragon'"))).toThrow(/kind/);
    expect(() => run(s.interior.replace("shell: 'workshop'", "shell: 'castle'"))).toThrow(/shell/);
    expect(() => run(s.interiorPoster)).toThrow(/lighthouse/);
    expect(() => run(s.counter.replace('ships wrecked on the point', 'score'))).toThrow(/means/);
    expect(() => run(s.defineSprite.replace("'gold', 'rust'", "'gold', 'green'"))).toThrow(
      /avocado/,
    );
  });

  it('are quoted verbatim by the world prompt texts', () => {
    const all = JSON.stringify(worldPromptText('game-b1'));
    for (const code of Object.values(GAME_B1_SNIPPETS)) {
      expect(all).toContain(JSON.stringify(code).slice(1, -1));
    }
  });
});
