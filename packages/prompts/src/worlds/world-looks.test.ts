import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkWorldVariety } from '../validators/world-variety.js';
import { worldPromptText } from './index.js';
import { worldTextForLooks } from './world-looks.js';

const C_CAM = worldPromptText('c-cam');
if (C_CAM === undefined) throw new Error('no c-cam prompts');
const ALL = ['ink-scene', 'ink-insert', 'ink-poster'];

describe('world prompts for the looks a project keeps (PLAN.md#14.12)', () => {
  it('returns the text as it is with every look on', () => {
    expect(worldTextForLooks(C_CAM, ALL, ALL)).toBe(C_CAM);
    // a list without any of the world's looks never strips the film
    expect(worldTextForLooks(C_CAM, ALL, [])).toBe(C_CAM);
  });

  it('keeps the rolls of the looks in use, lettered by place, and names the looks off', () => {
    const text = worldTextForLooks(C_CAM, ALL, ['ink-scene', 'ink-poster']);
    const rolls = text.rolls.split('\n');
    expect(rolls.filter((line) => line.startsWith('- `'))).toHaveLength(2);
    expect(rolls.find((line) => line.includes('(`ink-scene`'))).toMatch(/^- `A` = /);
    expect(rolls.find((line) => line.includes('(`ink-poster`'))).toMatch(/^- `B` = /);
    expect(rolls.some((line) => line.includes('(`ink-insert`'))).toBe(false);
    expect(rolls.at(-1)).toMatch(/^- Turned off in this project .*`ink-insert`\. Never use it;/);
    // the header line (cast and place tags) stays
    expect(rolls[0]).toBe(C_CAM.rolls.split('\n')[0]);
  });

  it('makes the first look in use the A roll', () => {
    const text = worldTextForLooks(C_CAM, ALL, ['ink-insert', 'ink-poster']);
    expect(text.rolls).toMatch(/^- `A` = the insert/mu);
    expect(text.rolls).toMatch(/^- `B` = the poster/mu);
    expect(text.rolls).toMatch(/`ink-scene`\. Never use it;/u);
  });

  it('drops the moments only a look that is off can host', () => {
    const ids = (looks: string[]): string[] =>
      worldTextForLooks(C_CAM, ALL, looks).moments.map((moment) => moment.id);
    expect(ids(ALL)).toEqual(C_CAM.moments.map((moment) => moment.id));
    expect(ids(['ink-scene', 'ink-insert'])).not.toContain('poster');
    expect(ids(['ink-insert', 'ink-poster'])).not.toContain('reverse');
    expect(ids(['ink-insert', 'ink-poster'])).not.toContain('over-shoulder');
    expect(ids(['ink-scene'])).toEqual(
      C_CAM.moments
        .filter((moment) => moment.looks.length === 0 || moment.looks.includes('ink-scene'))
        .map((moment) => moment.id),
    );
  });

  it('asks the variety check for one breakthrough kind when only one is left', () => {
    const text = worldTextForLooks(C_CAM, ALL, ['ink-scene', 'ink-insert']);
    const shot = (id: string, t0: number, moment?: string): StoryboardShot => ({
      id,
      t0,
      t1: t0 + 5,
      treatment: 'character-scene',
      scene: `scenes/${id}.js`,
      intent: 'cast: porter | place: corridor | a shot',
      look: 'ink-scene',
      roll: 'A',
      ...(moment === undefined ? {} : { worldMoment: moment }),
    });
    const shots = Array.from({ length: 12 }, (_, index) =>
      shot(
        `s${String(index + 1).padStart(2, '0')}`,
        index * 5,
        index % 6 === 2 ? 'reverse' : undefined,
      ),
    );
    const codes = checkWorldVariety(shots, { moments: text.moments, transitions: [] }).map(
      (issue) => issue.code,
    );
    expect(codes).not.toContain('moment-variety');
    expect(codes).not.toContain('moment-unknown');
  });
});
