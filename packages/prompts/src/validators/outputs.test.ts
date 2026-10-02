import { CuesFileSchema } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import { validateCriticReply } from './critic.js';
import { validateCues } from './cues.js';
import { countWords, targetWordsFor, validateScript } from './script.js';
import {
  parseMissing,
  replyLengthIssues,
  validateResearch,
  validateSceneModule,
} from './text-outputs.js';

const codes = (issues: readonly { code: string }[]): string[] => issues.map((entry) => entry.code);

describe('validateScript', () => {
  const words = (count: number): string =>
    Array.from({ length: count }, (_, index) => `word${String(index)}`).join(' ');

  it('accepts plain narration within ±15 % of the target', () => {
    const text = `${words(50)}.\n\n${words(45)}, 1997.\n`;
    const result = validateScript(text, { targetWords: 100 });
    expect(result.issues).toEqual([]);
    expect(result.value).toEqual({ wordCount: 96, estimatedMinutes: 96 / 150 });
  });

  it('rejects word counts outside the tolerance', () => {
    expect(codes(validateScript(words(84), { targetWords: 100 }).issues)).toEqual(['word-count']);
    expect(codes(validateScript(words(116), { targetWords: 100 }).issues)).toEqual(['word-count']);
    expect(validateScript(words(85), { targetWords: 100 }).valid).toBe(true);
  });

  it.each([
    ['# Intro\n', 'markdown-heading'],
    ['- first point\n', 'markdown-list'],
    ['1. first point\n', 'markdown-list'],
    ['This is **big**.\n', 'markdown-emphasis'],
    ['[VISUAL: a desk] Then it starts.\n', 'stage-direction'],
    ['(music swells)\n', 'stage-direction'],
    ['NARRATOR: In 1993 a team...\n', 'speaker-label'],
    ['Wow 🚀 fast.\n', 'emoji'],
  ])('rejects %j', (snippet, code) => {
    const result = validateScript(`${snippet}${words(99)}`, { targetWords: 100 });
    expect(codes(result.issues)).toContain(code);
  });

  it('does not flag ordinary prose (numbers, colons, parentheses inside sentences)', () => {
    const text = `In 1993, a team (four people) shipped it. Music: no. ${words(20)}`;
    expect(validateScript(text, { targetWords: countWords(text) }).issues).toEqual([]);
  });

  it('rejects an empty script and computes targets', () => {
    expect(validateScript('  \n', { targetWords: 10 }).valid).toBe(false);
    expect(targetWordsFor(0.6)).toBe(90);
    expect(countWords('Każdy telefon — 4 KB, i...')).toBe(5);
  });
});

describe('validateCriticReply', () => {
  const reply = JSON.stringify({
    frames: [
      { path: 'out/a.png', verdict: 'ok', note: 'fine' },
      { path: 'out\\b.png', verdict: 'clipped', note: 'title cut at the right edge' },
    ],
  });

  it('accepts a verdict per frame (path separators normalized)', () => {
    const result = validateCriticReply(reply, { expectedPaths: ['out/a.png', 'out/b.png'] });
    expect(result.issues).toEqual([]);
    expect(result.value?.frames.map((frame) => frame.verdict)).toEqual(['ok', 'clipped']);
  });

  it('rejects unknown verdicts, extra keys, prose and missing frames', () => {
    const unknown = JSON.stringify({ frames: [{ path: 'a', verdict: 'meh', note: '' }] });
    expect(validateCriticReply(unknown).valid).toBe(false);
    const extra = JSON.stringify({ frames: [{ path: 'a', verdict: 'ok', note: '', score: 1 }] });
    expect(validateCriticReply(extra).valid).toBe(false);
    expect(codes(validateCriticReply('Looks good to me!').issues)).toEqual(['invalid-json']);
    const missing = validateCriticReply(reply, { expectedPaths: ['out/a.png', 'out/c.png'] });
    expect(codes(missing.issues)).toEqual(['missing-frame', 'unexpected-frame']);
  });

  it('warns on fenced JSON and long notes', () => {
    const long = JSON.stringify({
      frames: [{ path: 'a', verdict: 'blank', note: Array(20).fill('word').join(' ') }],
    });
    const result = validateCriticReply(`\`\`\`json\n${long}\n\`\`\``);
    expect(result.valid).toBe(true);
    expect(codes(result.issues)).toEqual(['fenced-json', 'long-note']);
  });
});

describe('validateCues (pipeline schema injected)', () => {
  const cues = (patch: Record<string, unknown> = {}): string =>
    JSON.stringify({
      version: 1,
      sfx: [
        { t: 2, name: 'hit' },
        { t: 9, name: 'whoosh', gainDb: -8 },
      ],
      ambience: [{ from: 0, to: 20, name: 'hum', gainDb: -24 }],
      music: [{ from: 0, to: 20, file: 'audio/music/bed.wav', gainDb: -18 }],
      ...patch,
    });
  const options = { schema: CuesFileSchema, durationS: 20, musicFileExists: () => true };

  it('accepts valid cues and returns the parsed (defaulted) file', () => {
    const result = validateCues(cues(), options);
    expect(result.issues).toEqual([]);
    expect(result.value?.music[0]?.ducking.enabled).toBe(true);
  });

  it('rejects unknown keys and unknown recipe names via the schema', () => {
    expect(codes(validateCues(cues({ sfx: [{ t: 1, name: 'boom' }] }), options).issues)).toEqual([
      'schema',
    ]);
    expect(validateCues(cues({ extra: true }), options).valid).toBe(false);
  });

  it('applies the mixing rules', () => {
    const loud = cues({ ambience: [{ from: 0, to: 20, name: 'hum', gainDb: -10 }] });
    expect(codes(validateCues(loud, options).issues)).toEqual(['ambience-too-loud']);
    const elsewhere = cues({ music: [{ from: 0, to: 20, file: 'C:/music/bed.wav' }] });
    expect(codes(validateCues(elsewhere, options).issues)).toEqual(['music-location']);
    const absent = validateCues(cues(), { ...options, musicFileExists: () => false });
    expect(codes(absent.issues)).toEqual(['music-missing']);
    const late = cues({ sfx: [{ t: 25, name: 'hit' }] });
    expect(codes(validateCues(late, options).issues)).toEqual(['beyond-end']);
    const dense = cues({
      sfx: Array.from({ length: 15 }, (_, index) => ({ t: index, name: 'tick' })),
    });
    expect(validateCues(dense, options).issues).toEqual([
      expect.objectContaining({ code: 'sfx-density', severity: 'warning' }),
    ]);
  });
});

describe('parseMissing', () => {
  it.each([
    ['Built the desk.\nMISSING: calculator, floppy-disk', ['calculator', 'floppy-disk']],
    ['done\n**MISSING:** `prism`.', ['prism']],
    ['MISSING: a\nlater\nMissing: b; c', ['b', 'c']],
    ['QA ok.\nMISSING: none', []],
    ['All good, nothing missing.', []],
    // Real Opus replies (PLAN.md#10.4): explanations in brackets, "none (...)", prose.
    ["MISSING: none (I drew the file icon with the kit's voxel tools)", []],
    [
      'MISSING: calculator open-back (back panel that opens), chip prop (Z80 / 40-pin DIP)',
      ['calculator open-back', 'chip prop'],
    ],
    [
      'MISSING: a typing/strikethrough option in ctx.text.title is undocumented, so I built the headline from 3D labels and a glowing bar instead',
      [],
    ],
  ])('%j', (reply, expected) => {
    expect(parseMissing(reply)).toEqual(expected);
  });
});

describe('replyLengthIssues', () => {
  it('warns above the line limit and rejects empty replies', () => {
    expect(replyLengthIssues('a\n\nb', 2)).toEqual([]);
    expect(codes(replyLengthIssues('a\nb\nc', 2))).toEqual(['long-reply']);
    expect(codes(replyLengthIssues(' ', 2))).toEqual(['empty-reply']);
  });
});

describe('validateResearch', () => {
  const research = `# R
## Key facts
- Doom shipped in 1993 — https://en.wikipedia.org/wiki/Doom
## Timeline
- 1997: source released — https://example.org/source
## People & entities
- John Carmack — https://en.wikipedia.org/wiki/John_Carmack
## Numbers worth showing on screen
- 4 MB RAM — https://en.wikipedia.org/wiki/Doom
## Open questions / uncertain
- Unclear which ports are real.
`;

  it('accepts sourced claims; open questions may be unsourced', () => {
    expect(validateResearch(research)).toEqual({
      valid: true,
      value: { claims: 5, sources: 3 },
      issues: [],
    });
  });

  it('rejects unsourced claims and missing sections', () => {
    const unsourced = research.replace(' — https://example.org/source', '');
    expect(codes(validateResearch(unsourced).issues)).toEqual(['unsourced-claim']);
    const noTimeline = research.replace('## Timeline', '## Story');
    expect(codes(validateResearch(noTimeline).issues)).toContain('missing-section');
  });
});

describe('validateSceneModule', () => {
  const scene = `export const meta = { id: 's01', title: 'x', treatment: 'map' };
export function build(ctx) {
  return { hit: ctx.anchor('x') };
}
export function update(t, s, ctx) {
  ctx.camera.orbit({ target: s.hit, angle: t })(t);
}
`;

  it('accepts the scene contract', () => {
    expect(validateSceneModule(scene).issues).toEqual([]);
  });

  it('flags missing exports and non-deterministic APIs', () => {
    expect(
      codes(validateSceneModule(scene.replace('export function update', 'function update')).issues),
    ).toEqual(['scene-export']);
    const random = scene.replace('angle: t', 'angle: Math.random() + Date.now()');
    expect(validateSceneModule(random).issues.map((entry) => entry.message)).toEqual([
      'uses Date',
      'uses Math.random',
    ]);
    expect(codes(validateSceneModule(`import x from 'y';\n${scene}`).issues)).toEqual([
      'scene-forbidden',
    ]);
  });
});
