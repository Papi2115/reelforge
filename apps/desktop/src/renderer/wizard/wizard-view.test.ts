import { describe, expect, it } from 'vitest';
import { channelById, CHANNELS } from '../home/home-test-cards.js';
import {
  canReachStep,
  defaultVoicePlan,
  firstProblemStep,
  nextWizardStep,
  parseMinutes,
  reviewLines,
  stepProblem,
  voiceOptions,
  wizardBrief,
  type WizardDraft,
} from './wizard-view.js';

const draft = (patch: Partial<WizardDraft> = {}): WizardDraft => ({
  title: 'How magnets work',
  about: '',
  minutes: '8',
  channel: { kind: 'existing', id: 'voxplain' },
  ...patch,
});

describe('wizard steps', () => {
  it('walks Topic → Channel and genre → Style → Voice and create', () => {
    expect(nextWizardStep('topic', 1)).toBe('channel');
    expect(nextWizardStep('voice', 1)).toBeUndefined();
    expect(nextWizardStep('topic', -1)).toBeUndefined();
    expect(nextWizardStep('style', -1)).toBe('channel');
  });

  it('needs a title and a sensible length before going on', () => {
    expect(stepProblem('topic', draft({ title: '  ' }), CHANNELS.channels)).toBe(
      'Give the video a title.',
    );
    expect(stepProblem('topic', draft({ minutes: 'ten' }), CHANNELS.channels)).toContain('minutes');
    expect(stepProblem('topic', draft({ minutes: '90' }), CHANNELS.channels)).toContain('60');
    expect(stepProblem('topic', draft(), CHANNELS.channels)).toBeUndefined();
    expect(parseMinutes('7,5')).toBe(7.5);
  });

  it('checks a typed new channel name like Settings → Channels does', () => {
    const named = (name: string): WizardDraft => draft({ channel: { kind: 'new', name } });
    expect(stepProblem('channel', named(''), CHANNELS.channels)).toBe('A channel needs a name.');
    expect(stepProblem('channel', named('crime'), CHANNELS.channels)).toBe(
      'Another channel already has this name.',
    );
    expect(stepProblem('channel', named('History Bits'), CHANNELS.channels)).toBeUndefined();
  });

  it('jumps back to the first step that is not ready, and only lets ready steps be reached', () => {
    const blank = draft({ title: '' });
    expect(firstProblemStep(blank, CHANNELS.channels)).toBe('topic');
    expect(firstProblemStep(draft(), CHANNELS.channels)).toBeUndefined();
    expect(canReachStep('topic', blank, CHANNELS.channels)).toBe(true);
    expect(canReachStep('style', blank, CHANNELS.channels)).toBe(false);
    expect(canReachStep('voice', draft(), CHANNELS.channels)).toBe(true);
  });
});

describe('what the wizard makes', () => {
  it('saves a brief from the description, else from the title', () => {
    expect(wizardBrief(draft({ about: '  Why iron sticks. ' }), 'en')).toEqual({
      topic: 'Why iron sticks.',
      language: 'en',
      targetMinutes: 8,
      tone: '',
      audience: '',
      notes: '',
    });
    expect(wizardBrief(draft({ minutes: '2.5' }), 'pl')).toMatchObject({
      topic: 'How magnets work',
      language: 'pl',
      targetMinutes: 2.5,
    });
  });

  it('offers ElevenLabs only with a voice and a key on the channel', () => {
    const voxplain = channelById('voxplain');
    const crime = channelById('crime');
    expect(defaultVoicePlan(voxplain)).toBe('generate');
    expect(defaultVoicePlan(crime)).toBe('later');
    expect(voiceOptions(voxplain, false)[0]?.unavailable).toBeUndefined();
    expect(voiceOptions(crime, false)[0]?.unavailable).toContain('Settings → Channels');
    expect(voiceOptions(undefined, true)[0]?.unavailable).toContain('new channel');
  });

  it('reviews the choices in plain words', () => {
    expect(
      reviewLines({
        draft: draft({ channel: { kind: 'new', name: 'History Bits' } }),
        channelName: 'History Bits',
        genre: 'history',
        style: 'soft-480',
        voice: 'record',
        language: 'pl',
      }),
    ).toEqual([
      ['Title', 'How magnets work'],
      ['Length', 'about 8 min'],
      ['Channel', 'History Bits (new)'],
      ['Genre', 'History'],
      ['Style', 'Soft 480'],
      ['Voice', 'You record or import it'],
      ['Language', 'Polski'],
    ]);
  });
});
