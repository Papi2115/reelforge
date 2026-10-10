/**
 * Grim Ink captions and the title card (PLAN.md#14.18): the prototypes' caption pass (centred at
 * x 960, last line on y 1010, 58 px apart, wrapped at 1500 px, 46 px with an 11 px outline), found
 * on the shot's painted ink stage; the title card's lines, thud-in and the moment it has landed.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { RecordingPaint } from '../draw/recording-paint.js';
import { THUD_FPS } from '../lettering/index.js';
import { CAPTION_HOOK, type CaptionPainter } from '../stage.js';
import { paintCaption, wrapCaption } from './captions.js';
import { fakeTarget } from './fake-text-target.js';
import { resetFontProbe } from './roles.js';
import { titleCard, titleLines } from './title-card.js';
import { C_CAM_CAPTIONS } from './world-captions.js';

afterEach(() => {
  resetFontProbe();
});

const FRAME = { width: 1920, height: 1080 };

describe('Grim Ink captions', () => {
  it('wraps and places the lines like the prototype', () => {
    expect(wrapCaption('aa bb cc dd', 5, (line) => line.length)).toEqual(['aa bb', 'cc dd']);
    const target = fakeTarget(['Arial Black']);
    const line =
      'Tiberius reportedly offered retired gladiators one hundred thousand sesterces to come back and fight again in the arena of Rome for the crowd';
    paintCaption(new RecordingPaint(), target, line, FRAME);
    const translates = target.calls.filter((call) => call.startsWith('translate'));
    // 11 px per character in the fake: wrapped at 1500 px into two lines
    expect(translates).toEqual(['translate 960 952', 'translate 960 1010']);
    expect(target.calls.filter((call) => call.startsWith('strokeText'))[0]).toContain(
      'lw 11 round',
    );
  });

  it('draws on the ink stage the scene painted, else lets the engine draw', () => {
    const painted: string[] = [];
    const hook = (painter: CaptionPainter): boolean => {
      painter(new RecordingPaint(), undefined);
      painted.push('stage');
      return true;
    };
    const stage = Object.defineProperty({ visible: true }, CAPTION_HOOK, { value: hook });
    const scene = {
      traverse: (callback: (object: unknown) => void) => {
        [stage].forEach(callback);
      },
    };
    expect(C_CAM_CAPTIONS.draw(scene, 'You land.', FRAME)).toBe(true);
    expect(painted).toEqual(['stage']);
    const empty = {
      traverse: (callback: (object: unknown) => void) => {
        [{}].forEach(callback);
      },
    };
    expect(C_CAM_CAPTIONS.draw(empty, 'You land.', FRAME)).toBe(false);
  });
});

describe('ink.titleCard', () => {
  it('splits a long title into a lead-in and the hook', () => {
    expect(titleLines('Would you survive landing on the Moon?')).toEqual([
      'WOULD YOU SURVIVE',
      'LANDING ON THE MOON?',
    ]);
    expect(titleLines('The rudis')).toEqual(['THE RUDIS']);
  });

  it('draws the cast, thuds the title in and adds the tag once it has landed', () => {
    const drawn: string[] = [];
    const person = {
      draw: (_g: unknown, env: { t: number }, opts?: { x?: number }) => {
        drawn.push(`person at ${String(opts?.x)} t ${String(env.t)}`);
      },
    };
    const spec = {
      title: 'Freedom was optional',
      subtitle: 'ROME · 80 AD',
      cast: [{ person, x: 600, y: 1100, s: 0.8, view: 'front' as const }],
    };
    const early = new RecordingPaint();
    const result = titleCard(early, undefined, 0.1, spec);
    expect(drawn).toEqual(['person at 600 t 0.1']);
    // two lines: the hook starts 0.75 s after the lead-in; 4 steps on twos after its last letter
    expect(titleLines(spec.title)).toEqual(['FREEDOM', 'WAS OPTIONAL']);
    const hook = 'WAS OPTIONAL'.length - 1;
    expect(result.settled).toBeCloseTo(0.15 + 0.75 + hook * 0.04 + 4 / THUD_FPS, 9);
    const before = new RecordingPaint();
    titleCard(before, undefined, result.settled - 0.2, spec);
    const after = new RecordingPaint();
    titleCard(after, undefined, result.settled + 0.1, spec);
    const mustard = (g: RecordingPaint): number =>
      g.calls.filter((call) => call.op === 'set:fillStyle' && call.args[0] === '#9b8236').length;
    expect(mustard(before)).toBe(0);
    expect(mustard(after)).toBeGreaterThan(0);
    // nothing of the title before its first letter lands
    expect(early.calls.length).toBeLessThan(after.calls.length);
  });
});
