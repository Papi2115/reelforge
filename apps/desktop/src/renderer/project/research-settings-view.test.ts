import { describe, expect, it } from 'vitest';
import type { ProjectSettings } from '../../shared/project-settings-contract.js';
import {
  allowlistProblem,
  FULL_AUTO_WARNING,
  RESEARCH_MODE_CHOICES,
  RESEARCH_SOURCE_CHOICES,
  researchModePatch,
  researchSourcePatch,
} from './research-settings-view.js';

const SETTINGS: ProjectSettings = {
  lookMode: 'mixed',
  ambientVariation: true,
  researchMode: 'ask',
  researchSources: [],
  tensionMap: 'off',
  patternInterrupts: 'off',
  openLoops: 'off',
  revealMoments: 'off',
  beatSync: 'off',
  repetitionControl: 'off',
};

describe('research settings view', () => {
  it('offers the four modes, ask first, only full-auto marked risky', () => {
    expect(RESEARCH_MODE_CHOICES.map((choice) => [choice.value, choice.risky])).toEqual([
      ['ask', false],
      ['allowlist', false],
      ['full-auto', true],
      ['off', false],
    ]);
    expect(FULL_AUTO_WARNING).toMatch(/You are responsible for checking every licence/);
    expect(RESEARCH_SOURCE_CHOICES.map((source) => source.id)).toEqual([
      'wikimedia',
      'openverse',
      'internet-archive',
      'nasa',
      'loc',
    ]);
  });

  it('starts the allowlist with Wikimedia + NASA, keeps chosen sources otherwise', () => {
    expect(researchModePatch(SETTINGS, 'allowlist')).toEqual({
      researchMode: 'allowlist',
      researchSources: ['wikimedia', 'nasa'],
    });
    expect(researchModePatch({ ...SETTINGS, researchSources: ['loc'] }, 'allowlist')).toEqual({
      researchMode: 'allowlist',
    });
    expect(researchModePatch(SETTINGS, 'off')).toEqual({ researchMode: 'off' });
  });

  it('ticks sources in catalogue order and warns about an empty allowlist', () => {
    const some = { ...SETTINGS, researchMode: 'allowlist', researchSources: ['nasa'] } as const;
    expect(researchSourcePatch({ ...some, researchSources: ['nasa'] }, 'wikimedia', true)).toEqual({
      researchSources: ['wikimedia', 'nasa'],
    });
    expect(researchSourcePatch({ ...some, researchSources: ['nasa'] }, 'nasa', false)).toEqual({
      researchSources: [],
    });
    expect(allowlistProblem({ ...some, researchSources: [] })).toMatch(/Tick at least one source/);
    expect(allowlistProblem({ ...some, researchSources: ['nasa'] })).toBeNull();
    expect(allowlistProblem({ ...SETTINGS, researchMode: 'off' })).toBeNull();
  });
});
