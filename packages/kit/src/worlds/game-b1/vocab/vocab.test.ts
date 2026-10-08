/**
 * The open vocabulary of Game B1 (PLAN.md#13.15): the 2600 sprite and playfield DSLs explain
 * every violation as a sentence, the seeded generators always produce valid, deterministic
 * definitions in the grammar, and the painter draws them with the hardware's rules (NUSIZ copies
 * count once on a scanline, one-shots, facing, coarse scroll, balls and missiles, counters that
 * must say what real number they count).
 */
import { describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { IndexCanvas } from '../core/canvas.js';
import { C } from '../palette.js';
import { SCREEN_H, SCREEN_W } from '../screen/model.js';
import { TvPainter } from '../tv/painter.js';
import { colourProblem } from './colours.js';
import { GENERATOR_KINDS, generatorSchema, runGenerator } from './gen/generators.js';
import { blockRuns, compilePlayfield, fullLine, playfieldProblems } from './playfield.js';
import { Vocab } from './registry.js';
import { spriteProblems } from './sprite.js';

const fail = (message: string): never => {
  throw new KitError('invalid-params', message);
};

const BOX = { rows: ['########', '#......#', '########'], colours: 'gold' };

describe('sprite DSL', () => {
  it('accepts a valid player and explains every broken rule in a sentence', () => {
    expect(spriteProblems('ranger', BOX)).toEqual([]);
    const wide = spriteProblems('tank', { rows: ['#########'], colours: 'grey' });
    expect(wide.join()).toMatch(/9 bits wide: a 2600 player is 8 bits.*size 2 or 4/);
    expect(spriteProblems('x', { rows: ['#x#'], colours: 'grey' }).join()).toMatch(/'x'.*'#' \(on\) and '\.' \(off\)/);
    expect(spriteProblems('x', { rows: ['##', '##'], colours: ['grey'] }).join()).toMatch(/1 colours for 2 rows.*once per scanline/);
    expect(spriteProblems('x', { ...BOX, size: 2, copies: 2 }).join()).toMatch(/stretches a player or copies it, not both/);
    expect(spriteProblems('x', { ...BOX, copies: 3, gap: 'wide' }).join()).toMatch(/no wide triple/);
    expect(spriteProblems('x', { frames: [['##'], ['##', '##']], colours: 'gold' }).join()).toMatch(/same height/);
    expect(spriteProblems('x', { rows: ['##'], frames: [['##']], colours: 'gold' }).join()).toMatch(/not both/);
    expect(spriteProblems('Bad Id', BOX).join()).toMatch(/camelCase/);
  }); // prettier-ignore

  it('names the inks for everyday colour words and accepts row stops', () => {
    expect(colourProblem('green')).toMatch(/try avocado, oliveDark/);
    expect(colourProblem('teal')).toBeUndefined();
    expect(
      spriteProblems('x', { rows: ['#', '#', '#'], colours: { 0: 'tan', 2: 'teal' } }),
    ).toEqual([]);
    expect(spriteProblems('x', { rows: ['#', '#'], colours: { 1: 'tan' } }).join()).toMatch(
      /start at "0"/,
    );
  });
});

describe('playfield DSL', () => {
  it('mirrors or repeats 20-bit rows, keeps 40-bit rows, and explains bad rows', () => {
    const half = '##..................';
    expect(fullLine(half, 'mirror')).toBe(`${half}..................##`);
    expect(fullLine(half, 'repeat')).toBe(half + half);
    expect(playfieldProblems('sea', { rows: [half], colours: 'blue' })).toEqual([]);
    expect(playfieldProblems('sea', { rows: ['###'], colours: 'blue' }).join()).toMatch(
      /3 bits: a playfield row is 20 bits.*or 40/,
    );
    const field = compilePlayfield('sea', { rows: [half, '#'.repeat(40)], rowH: [2, 5], colours: ['blue', 'aqua'] }, fail); // prettier-ignore
    expect(field.height).toBe(7);
  });

  it('scrolls in whole blocks', () => {
    const line = `#${'.'.repeat(39)}`;
    expect(blockRuns(line, 0)).toEqual([[0, 1]]);
    expect(blockRuns(line, 1)).toEqual([[39, 1]]);
    expect(blockRuns(line, -1)).toEqual([[1, 1]]);
  });
});

/** One spec per generator kind (defaults fill the rest). */
const SAMPLES: Record<string, unknown> = {
  tree: { kind: 'tree', shape: 'pine' },
  bush: { kind: 'bush' },
  cactus: { kind: 'cactus' },
  seaweed: { kind: 'seaweed' },
  rock: { kind: 'rock' },
  bird: { kind: 'bird' },
  fish: { kind: 'fish' },
  animal: { kind: 'animal', like: 'camel' },
  insect: { kind: 'insect', type: 'locust' },
  reptile: { kind: 'reptile', type: 'snake' },
  person: { kind: 'person', role: 'knight' },
  vehicle: { kind: 'vehicle', type: 'rocket' },
  building: { kind: 'building', type: 'office', lit: true },
  item: { kind: 'item', type: 'gem' },
  boss: { kind: 'boss', body: 'clock', crown: true },
  effect: { kind: 'effect', type: 'explosion' },
  scenery: { kind: 'scenery', type: 'skyline', rows: 6 },
};

describe('parametric generators', () => {
  it('cover every kind, and every variant at many seeds is valid in the grammar', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...GENERATOR_KINDS].sort());
    const variants: unknown[] = [
      ...['pine', 'round', 'palm', 'birch', 'dead'].map((shape) => ({ kind: 'tree', shape })),
      ...['deer', 'horse', 'camel', 'dog', 'cow', 'bear', 'goat'].map((like) => ({ kind: 'animal', like })),
      ...['plain', 'ranger', 'miner', 'sailor', 'knight', 'astronaut', 'clerk', 'farmer', 'kid'].map((role) => ({ kind: 'person', role })),
      ...['blob', 'cloud', 'wave', 'clock', 'swarm', 'tower', 'beast'].map((body) => ({ kind: 'boss', body, arms: true })),
      ...['canopy', 'waves', 'dunes', 'hills', 'skyline', 'wall', 'reef', 'clouds', 'ground'].map((type) => ({ kind: 'scenery', type })),
      ...Object.values(SAMPLES),
    ]; // prettier-ignore
    for (const spec of variants)
      for (let seed = 0; seed < 12; seed += 1) {
        const made = runGenerator('thing', generatorSchema.parse({ ...(spec as object), seed }));
        const problems =
          made.type === 'sprite'
            ? spriteProblems('thing', made.spec)
            : playfieldProblems('thing', made.spec);
        expect(problems, JSON.stringify({ spec, seed })).toEqual([]);
      }
  });

  it('is a pure function of its params; the seed (or the id) varies the drawing', () => {
    const once = (id: string, spec: unknown) =>
      JSON.stringify(runGenerator(id, generatorSchema.parse(spec)));
    expect(once('oak', { kind: 'tree', seed: 3 })).toBe(once('oak', { kind: 'tree', seed: 3 }));
    const trees = new Set([0, 1, 2, 3, 4, 5].map((seed) => once('oak', { kind: 'tree', seed })));
    expect(trees.size).toBeGreaterThan(2);
    expect(once('oak', { kind: 'tree' })).not.toBe(once('elm', { kind: 'tree' }));
    expect(() => generatorSchema.parse({ kind: 'dragon' })).toThrow();
  });
});

function painter(frame: number, vocab: Vocab, draw: (g: TvPainter) => void): IndexCanvas {
  const cv = new IndexCanvas(SCREEN_W, SCREEN_H);
  const g = new TvPainter(cv, frame / 30, 2, vocab);
  draw(g);
  g.flush();
  return cv;
}

const count = (cv: IndexCanvas, c: number) => cv.d.reduce((n, v) => n + (v === c ? 1 : 0), 0);

describe('drawing the vocabulary in the TV', () => {
  const vocab = new Vocab(fail);
  vocab.defineSprite('flock', { rows: ['##', '##'], colours: 'gold', copies: 3, gap: 'close' });
  vocab.defineSprite('dot', { rows: ['#'], colours: 'aqua' });
  vocab.defineSprite('blink', { frames: [['#'], ['##']], colours: 'cream', fps: 10 });
  vocab.definePlayfield('band', { rows: [`#${'.'.repeat(19)}`], colours: 'teal', mode: 'repeat' });

  it('counts NUSIZ copies once on a scanline: a copied player and one more never flicker', () => {
    for (const frame of [0, 1, 2, 3]) {
      const cv = painter(frame, vocab, (g) => {
        g.draw('flock', 10, 20);
        g.draw('dot', 100, 20);
      });
      expect(count(cv, C.GOLD), `frame ${String(frame)}`).toBe(3 * 2 * 4 * 2 * 2);
      expect(count(cv, C.AQUA)).toBe(4 * 2);
    }
    const crowded = [0, 1].map((frame) =>
      count(painter(frame, vocab, (g) => {
        g.draw('flock', 10, 20);
        g.draw('dot', 100, 20);
        g.draw('dot', 120, 20);
      }), C.AQUA),
    ); // prettier-ignore
    expect(crowded).not.toEqual([16, 16]);
  });

  it('plays one-shots once, picks frames by t, flips by facing, scrolls fields by blocks', () => {
    const at = (frame: number) => count(painter(frame, vocab, (g) => { g.draw('blink', 0, 0, { at: 0.1 }); }), C.CREAM); // prettier-ignore
    expect([at(0), at(3), at(6), at(9)]).toEqual([0, 8, 16, 0]);
    const left = painter(0, vocab, (g) => {
      g.draw('flock', 10, 20, { face: 'left' });
    });
    expect(count(left, C.GOLD)).toBeGreaterThan(0);
    const shifted = painter(0, vocab, (g) => g.field('band', 0, { shift: 1 }));
    expect(shifted.d[0]).not.toBe(C.TEAL);
    expect(shifted.d[19 * 16]).toBe(C.TEAL);
  });

  it('keeps balls and missiles to 2600 widths and counters to real numbers', () => {
    expect(() => painter(0, vocab, (g) => { g.ball(0, 0, { w: 3, colour: 'cream' }); })).toThrow(/1, 2, 4 or 8/);
    expect(() => painter(0, vocab, (g) => g.counter({ means: 'score', keys: [[0, 5]], x: 0, y: 0, colour: 'gold' }))).toThrow(/says nothing/);
    const value = [0, 60].map((frame) => {
      let v = 0;
      painter(frame, vocab, (g) => {
        v = g.counter({ means: 'oaks left in the valley', keys: [[0, 4000], [1.5, 900]], x: 0, y: 0, colour: 'gold' });
      });
      return v;
    });
    expect(value).toEqual([4000, 900]);
  }); // prettier-ignore

  it('answers an unknown id with what exists and a did-you-mean', () => {
    expect(() =>
      painter(0, vocab, (g) => {
        g.draw('flok', 0, 0);
      }),
    ).toThrow(/no sprite "flok".*Did you mean "flock"/);
    expect(() => vocab.defineSprite('dot', BOX)).toThrow(/already defined/);
    expect(() => vocab.generate('bad', { kind: 'tree', shape: 'cube' })).toThrow(/shape/);
  });
});
