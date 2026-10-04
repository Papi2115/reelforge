import type { StoryboardShot, WordsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkCharacters, impersonationCue, type CharacterCheckOptions } from './characters.js';
import { matchesWordList, PERSON_ROLE_WORDS } from './mascot-words.js';
import { validateStoryboard } from './storyboard.js';

const FOX: CharacterCheckOptions = { characters: 'pack', mascot: 'fox' };
const POINTER = { role: 'pointer', action: 'points at the rising bar' } as const;

/** Contiguous shots of `length` s each; `mascots` = indexes with a mascot. */
function film(count: number, length: number, mascots: readonly number[]): StoryboardShot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${String(index + 1).padStart(2, '0')}`,
    t0: index * length,
    t1: (index + 1) * length,
    treatment: index % 2 === 0 ? 'data-chart-3d' : 'metaphor-object',
    intent: 'A chart of sales by year.',
    scene: `scenes/s${String(index + 1).padStart(2, '0')}.js`,
    ...(mascots.includes(index) ? { mascot: POINTER } : {}),
  }));
}

/** Words spread evenly over [t0, t1). */
function words(t0: number, t1: number, text: string): WordsFile {
  const list = text.split(' ');
  const step = (t1 - t0) / list.length;
  return {
    version: 1,
    language: 'en',
    words: list.map((word, index) => ({
      text: word,
      t: t0 + index * step,
      tEnd: t0 + (index + 1) * step - 0.01,
    })),
  } as WordsFile;
}

const codes = (issues: readonly { code: string; severity: string }[]): string[] =>
  issues.map((entry) => `${entry.severity}:${entry.code}`);

function shot(intent: string, extra: Partial<StoryboardShot> = {}): StoryboardShot {
  return {
    id: 's05',
    t0: 40,
    t1: 46,
    treatment: 'character-scene',
    intent,
    scene: 'scenes/s05.js',
    mascot: POINTER,
    ...extra,
  };
}

describe('mascot impersonation', () => {
  it('flags a mascot in a shot about a doctor, a scientist or a victim (EN + PL)', () => {
    expect(impersonationCue(shot('A doctor explains the scan.'), [])).toContain('"doctor"');
    expect(impersonationCue(shot('Lab bench.'), ['The', 'scientists', 'found'])).toContain(
      '"scientists"',
    );
    expect(impersonationCue(shot('Lekarz ogląda zdjęcie.'), [])).toContain('"lekarz"');
    expect(impersonationCue(shot('Sala sądowa.'), ['Świadek', 'milczał'])).toContain('"świadek"');
    expect(impersonationCue(shot('Mapa.'), ['ofiarami', 'powodzi'])).toContain('"ofiarami"');
    expect(
      impersonationCue(
        shot('Chart.', { mascot: { role: 'viewer', action: 'acts as the CEO' } }),
        [],
      ),
    ).toContain('"ceo"');
  });

  it('flags quoted speech and named people in the narration', () => {
    expect(impersonationCue(shot('Chart.'), ['Then', 'he', 'said', 'no'])).toContain('quoted');
    expect(impersonationCue(shot('Chart.'), ['“We', 'did', 'it”'])).toContain('quoted speech');
    expect(impersonationCue(shot('Chart.'), ['and', 'Steve', 'Jobs', 'smiled'])).toContain(
      '"Steve Jobs"',
    );
    expect(impersonationCue(shot('Chart.'), ['Dr', 'Kowalski', 'wrote'])).toContain(
      '"Dr Kowalski"',
    );
  });

  it('lets the mascot point at a chart, carry an object or react', () => {
    expect(impersonationCue(shot('A bar chart of phone sales.'), ['Sales', 'tripled'])).toBe(
      undefined,
    );
    expect(impersonationCue(shot('The Nokia rises on the chart.'), ['The', 'Nokia', 'won.'])).toBe(
      undefined,
    );
    expect(impersonationCue(shot('Wykres rośnie.'), ['W', 'Nowym', 'Jorku', 'sprzedaż'])).toBe(
      undefined,
    );
    expect(impersonationCue(shot('Map.'), ['in', 'New', 'York', 'and', 'Hong', 'Kong'])).toBe(
      undefined,
    );
    expect(impersonationCue(shot('Badania naukowe na wykresie.'), [])).toBe(undefined);
  });

  it('keeps the keyword list matching whole words or prefixes', () => {
    expect(matchesWordList('doctors', PERSON_ROLE_WORDS)).toBe('doctor*');
    expect(matchesWordList('pacjentów', PERSON_ROLE_WORDS)).toBe('pacjent*');
    expect(matchesWordList('kingdom', PERSON_ROLE_WORDS)).toBeUndefined();
    expect(matchesWordList('engineering', PERSON_ROLE_WORDS)).toBeUndefined();
    expect(matchesWordList('świadomy', PERSON_ROLE_WORDS)).toBeUndefined();
    expect(matchesWordList('królik', PERSON_ROLE_WORDS)).toBeUndefined();
  });

  it('is an error of the storyboard validator (a repair turn)', () => {
    const shots = [
      { ...shot('Hook.', { t0: 0, t1: 4, id: 's01', scene: 'scenes/s01.js' }), mascot: undefined },
      shot('A doctor explains the scan.', { t0: 4, t1: 9 }),
    ].map(({ mascot, ...rest }) => (mascot === undefined ? rest : { ...rest, mascot }));
    const report = validateStoryboard(JSON.stringify({ version: 1, shots }), { characters: FOX });
    expect(report.valid).toBe(false);
    expect(codes(report.issues)).toContain('error:mascot-impersonation');
    const legacy = validateStoryboard(JSON.stringify({ version: 1, shots }));
    expect(codes(legacy.issues)).not.toContain('error:mascot-impersonation');
  });
});

describe('mascot rhythm', () => {
  it('accepts sparse appearances (one about every minute)', () => {
    const shots = film(40, 6, [1, 10, 20, 30]);
    expect(checkCharacters({ shots }, undefined, FOX)).toEqual([]);
  });

  it('refuses more than 30% of the shots and returns closer than 12 s', () => {
    const many = checkCharacters({ shots: film(6, 6, [0, 2, 4]) }, undefined, FOX);
    expect(codes(many)).toContain('error:mascot-overuse');
    const close = checkCharacters({ shots: film(20, 5, [4, 6]) }, undefined, FOX);
    expect(close.filter((entry) => entry.code === 'mascot-overuse')).toHaveLength(1);
    expect(close[0]?.message).toContain('10.0 s after s05');
  });

  it('warns about a mascot in the first 3 s outside a title card', () => {
    const shots = film(20, 6, [0]);
    expect(codes(checkCharacters({ shots }, undefined, FOX))).toContain('warning:mascot-in-hook');
    const title = shots.map((entry, index) =>
      index === 0 ? { ...entry, treatment: 'title-card' as const } : entry,
    );
    expect(codes(checkCharacters({ shots: title }, undefined, FOX))).not.toContain(
      'warning:mascot-in-hook',
    );
  });

  it('warns about more than 90 s without the mascot only in films over 3 min', () => {
    const long = checkCharacters({ shots: film(40, 6, [2, 30]) }, undefined, FOX);
    expect(codes(long)).toEqual(['warning:mascot-gap']);
    expect(long[0]?.message).toContain('0:12–3:00');
    expect(checkCharacters({ shots: film(25, 6, []) }, undefined, FOX)).toEqual([]);
  });
});

describe('mascot without a choice', () => {
  it('refuses shot.mascot when the project has none or the classic hero', () => {
    const shots = film(10, 6, [3]);
    const none = checkCharacters({ shots }, undefined, { characters: 'pack', mascot: 'none' });
    expect(codes(none)).toEqual(['error:mascot-without-choice']);
    const legacy: CharacterCheckOptions = { characters: 'classic', mascot: 'none' };
    expect(checkCharacters({ shots }, undefined, legacy)[0]?.message).toContain('classic hero');
    // A legacy storyboard (no mascot, no newRoles) gets nothing.
    expect(checkCharacters({ shots: film(10, 6, []) }, undefined, legacy)).toEqual([]);
  });
});

describe('new roles', () => {
  const shots = film(10, 6, []);
  const PACK: CharacterCheckOptions = {
    characters: 'pack',
    mascot: 'none',
    builtRoles: ['chef'],
  };

  it('accepts a role the cast does not have', () => {
    const newRoles = [{ id: 'firefighter', description: 'helmet, turnout coat, axe' }];
    expect(checkCharacters({ shots, newRoles }, undefined, PACK)).toEqual([]);
  });

  it('refuses duplicates and cast, mannequin or mascot ids; warns about built ones', () => {
    const newRoles = [
      { id: 'firefighter', description: 'x' },
      { id: 'firefighter', description: 'y' },
      { id: 'doctor', description: 'z' },
      { id: 'bean', description: 'z' },
      { id: 'chef', description: 'z' },
    ];
    expect(codes(checkCharacters({ shots, newRoles }, undefined, PACK))).toEqual([
      'error:unknown-role',
      'error:unknown-role',
      'error:unknown-role',
      'warning:role-built',
    ]);
  });

  it('refuses kit.cast.person ids outside the cast unless listed or built', () => {
    const calls = shots.map((entry, index) =>
      index === 2
        ? { ...entry, intent: "kit.cast.person('pilot') lands; kit.cast.person('chef') cooks" }
        : entry,
    );
    const issues = checkCharacters({ shots: calls }, undefined, PACK);
    expect(codes(issues)).toEqual(['error:unknown-role']);
    expect(issues[0]?.message).toContain("kit.cast.person('pilot')");
    const listed = { shots: calls, newRoles: [{ id: 'pilot', description: 'cap, uniform' }] };
    expect(checkCharacters(listed, undefined, PACK)).toEqual([]);
  });

  it('ignores newRoles of a classic project with a warning', () => {
    const newRoles = [{ id: 'firefighter', description: 'x' }];
    const classic = { characters: 'classic', mascot: 'none' } as const;
    expect(codes(checkCharacters({ shots, newRoles }, undefined, classic))).toEqual([
      'warning:roles-without-pack',
    ]);
  });
});

describe('the narration window', () => {
  it('reads only the words spoken inside the mascot shot', () => {
    const shots = film(20, 6, [5]);
    const spoken = words(
      0,
      120,
      Array.from({ length: 120 }, (_, index) => (index === 10 ? 'doctor' : 'sales')).join(' '),
    );
    expect(checkCharacters({ shots }, spoken, FOX)).toEqual([]);
    const inside = words(30, 36, 'the doctor said');
    expect(codes(checkCharacters({ shots }, inside, FOX))).toContain('error:mascot-impersonation');
  });
});
