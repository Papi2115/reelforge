import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChatSelection, ChatSendRequest } from '../../shared/chat-contract.js';
import { lockedShotsNote } from './chat-locks.js';
import {
  buildChatPrompt,
  CHIP_INSTRUCTIONS,
  findSourceHint,
  lineOfOccurrence,
  requestTitle,
  selectionLabel,
} from './chat-prompt.js';

const SCENE = `export const meta = { id: 's02' };
export function build(ctx) {
  const { kit } = ctx;
  const desk = kit.props.bench();
  const first = kit.props.calculator();
  const second = kit.props.calculator({ scale: 2 });
  marker.name = 'marker';
  return { first, second };
}
export function update(t, state, ctx) {
  ctx.text.lowerThird('61 KB', null, { id: 'memory' });
}
`;

const CALCULATOR: ChatSelection = {
  kind: 'kit',
  shotId: 's02',
  t: 3.4,
  localTime: 1.2,
  x: 0.52,
  y: 0.48,
  name: 'calculator',
  id: 'props.calculator#1',
  call: 'kit.props.calculator()',
  occurrence: 1,
  sceneName: null,
  parent: 'bench',
  position: [0, 0.2, 0],
  size: [2, 0.4, 3],
  description: 'calculator (kit.props.calculator() #2) on bench at (0.00, 0.20, 0.00)',
};

function request(patch: Partial<ChatSendRequest>): ChatSendRequest {
  return {
    text: 'make the calculator bigger',
    chip: null,
    scope: 'selection',
    shotIds: ['s02'],
    selection: CALCULATOR,
    boost: false,
    ...patch,
  };
}

let project: string;

beforeAll(async () => {
  project = await mkdtemp(path.join(os.tmpdir(), 'rf prompt ż '));
  await mkdir(path.join(project, 'scenes'));
  await writeFile(path.join(project, 'scenes', 's02_calc.js'), SCENE);
  await writeFile(
    path.join(project, 'storyboard.json'),
    JSON.stringify({
      version: 1,
      shots: [
        {
          id: 's02',
          t0: 0,
          t1: 5,
          treatment: 'metaphor-object',
          intent: 'A calculator.',
          scene: 'scenes/s02_calc.js',
        },
        {
          id: 's03',
          t0: 5,
          t1: 6,
          treatment: 'metaphor-object',
          intent: 'Escapes.',
          scene: '../outside.js',
        },
      ],
    }),
  );
});

afterAll(async () => {
  await rm(project, { recursive: true, force: true });
});

describe('source hints', () => {
  it('finds the n-th call, else the first', () => {
    expect(lineOfOccurrence(SCENE, 'props.calculator(', 1)).toBe(6);
    expect(lineOfOccurrence(SCENE, 'props.calculator(', 7)).toBe(5);
    expect(lineOfOccurrence(SCENE, 'props.globe(', 0)).toBeUndefined();
  });

  it('maps the picked shot to its scene file and line; stays inside the project', async () => {
    expect(await findSourceHint(project, CALCULATOR)).toEqual({
      file: 'scenes/s02_calc.js',
      line: 6,
    });
    const card: ChatSelection = {
      ...CALCULATOR,
      kind: 'text',
      name: '61 KB',
      id: 'text:memory',
      call: null,
      occurrence: null,
    };
    expect(await findSourceHint(project, card)).toEqual({ file: 'scenes/s02_calc.js', line: 11 });
    const plain = { ...card, kind: 'object' as const, name: 'marker', id: 'object:marker#0' };
    expect((await findSourceHint(project, plain))?.line).toBe(7);
    expect(await findSourceHint(project, { ...CALCULATOR, shotId: 's03' })).toBeUndefined();
    expect(await findSourceHint(project, { ...CALCULATOR, shotId: 's99' })).toBeUndefined();
  });
});

describe('buildChatPrompt', () => {
  it('wraps a Selection request with the picked object and its source line', async () => {
    const hint = await findSourceHint(project, CALCULATOR);
    const result = buildChatPrompt({ request: request({}), hint });
    if (!result.ok) throw new Error(result.message);
    expect(result.prompt).toContain(
      'Scope: Selection (Selection | Shot | Whole video) · Shot(s): s02',
    );
    expect(result.prompt).toContain(
      'Selected object in the preview: calculator (kit.props.calculator() #2) on bench',
    );
    expect(result.prompt).toContain('picked at local t = 1.20 s (global 3.40 s)');
    expect(result.prompt).toContain(
      'Scene file: scenes/s02_calc.js, probably created at line 6 (kit.props.calculator() call #2).',
    );
    expect(result.prompt).toContain('Request: make the calculator bigger');
    expect(selectionLabel(CALCULATOR)).toBe('calculator (s02)');
  });

  it('Shot and Whole video scopes carry no selection; chips use their instruction', () => {
    const shot = buildChatPrompt({
      request: request({ scope: 'shot', shotIds: ['s01', 's02'] }),
      hint: undefined,
    });
    expect(shot.ok && shot.prompt).toContain(
      'Scope: Shot (Selection | Shot | Whole video) · Shot(s): s01, s02',
    );
    expect(shot.ok && shot.prompt).not.toContain('Selected object');
    const chip = buildChatPrompt({
      request: request({ chip: 'review-video', text: '', scope: 'selection' }),
      hint: undefined,
    });
    expect(chip.ok && chip.prompt).toContain('Scope: Whole video');
    expect(chip.ok && chip.prompt).toContain('Shot(s): all');
    expect(chip.ok && chip.prompt).toContain(CHIP_INSTRUCTIONS['review-video']);
    expect(chip.ok && chip.prompt).toContain('reelforge contact-sheet --all');
    expect(requestTitle({ chip: 'review-video', text: '' })).toBe(
      'Review the whole video and fix what looks wrong',
    );
    expect(requestTitle({ chip: null, text: '\n  make it red  \nand blue' })).toBe('make it red');
  });

  it('keeps braces of user text verbatim (values are never re-parsed)', () => {
    const result = buildChatPrompt({
      request: request({ scope: 'video', text: 'use {{selection}} literally' }),
      hint: undefined,
    });
    expect(result.ok && result.prompt).toContain('Request: use {{selection}} literally');
  });

  it('tells a Whole-video turn which shots are locked (not a Shot turn)', () => {
    const lockedNote = lockedShotsNote(['s02', 's05']);
    const video = buildChatPrompt({
      request: request({ scope: 'video' }),
      hint: undefined,
      lockedNote,
    });
    expect(video.ok && video.prompt).toContain(
      'Locked shots (approved by the user): s02, s05. Do not edit their scene files',
    );
    const shot = buildChatPrompt({
      request: request({ scope: 'shot', shotIds: ['s01'] }),
      hint: undefined,
      lockedNote,
    });
    expect(shot.ok && shot.prompt).not.toContain('Locked shots');
    expect(lockedShotsNote([])).toBe('');
  });
});
