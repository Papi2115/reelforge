import { defineLook, listLooks, LOOKS, voxelLook, type Look } from '@reelforge/kit';
import { renderPrompt } from '@reelforge/prompts';
import {
  lookIdSchema,
  TRANSITION_STYLE_LIST,
  TRANSITION_STYLES,
  treatmentSchema,
  WOW_STYLE_LIST,
  type StoryboardShot,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  availableTransitionStyles,
  CRITIC_LOOK_RULES,
  criticLookVars,
  lookLine,
  sceneLookVars,
  storyboardLookOptions,
  storyboardLookVars,
  transitionLine,
  wowTransitionLine,
} from './looks.js';

const SHOT: StoryboardShot = {
  id: 's01',
  t0: 0,
  t1: 4,
  treatment: 'ui-mockup',
  intent: 'A login window.',
  scene: 'scenes/s01.js',
};

/** A test-only second look (stands for the 2.0 looks). */
const testLook: Look = defineLook({
  ...voxelLook,
  id: 'test-look',
  label: 'Test look',
  description: 'a look that exists only in tests',
  rolls: ['B'],
  treatments: ['ui-mockup'],
  docs: 'Build with test things.',
  kit: {},
});

describe('look mode plumbing', () => {
  it('gives voxel-only projects nothing (prompts and checks as before looks)', () => {
    expect(storyboardLookVars('voxel-only')).toEqual({});
    expect(storyboardLookOptions('voxel-only')).toEqual({});
    expect(sceneLookVars('voxel-only', { ...SHOT, look: 'test-look' })).toEqual({});
  });

  it('lists the available looks for a mixed storyboard', () => {
    const available = listLooks();
    // The 2.0 looks first, in order; the 2.3 looks (each adds itself) after them.
    expect(available.slice(0, 4).map((look) => look.id)).toEqual([
      'voxel',
      'retro-ui',
      'diorama',
      'blueprint',
    ]);
    expect(available.map((look) => look.id)).toContain('flat-2d');
    expect(storyboardLookVars('mixed')).toEqual({
      looks: available.map(lookLine).join('\n'),
      multiLook: true,
      transitions: TRANSITION_STYLE_LIST.filter((style) => style.wow === undefined)
        .map(transitionLine)
        .join('\n'),
      wowTransitions: WOW_STYLE_LIST.map(wowTransitionLine).join('\n'),
    });
    expect(storyboardLookOptions('mixed')).toEqual({
      lookMode: 'mixed',
      looks: available.map((look) => look.id),
    });
    expect(storyboardLookVars('mixed', [voxelLook])).toEqual({
      looks: lookLine(voxelLook),
      singleLook: true,
    });
    const two = storyboardLookVars('mixed', [voxelLook, testLook]);
    expect(two).toMatchObject({ multiLook: true });
    expect(String(two['looks']).split('\n')).toEqual([lookLine(voxelLook), lookLine(testLook)]);
    expect(lookLine(testLook)).toBe(
      '- `test-look` (Test look): a look that exists only in tests. Rolls: B. Treatments: ui-mockup.',
    );
  });

  it('lists the transition styles the available looks can use', () => {
    expect(transitionLine(TRANSITION_STYLES['crt-zoom'])).toBe(
      '- `crt-zoom` (glitch, 0.5–0.8 s; look changes only: * -> retro-ui, retro-ui -> *): zoom into the screen centre, the tube powers off to a line, the new shot powers on.',
    );
    expect(transitionLine(TRANSITION_STYLES.iris)).toBe(
      '- `iris` (wipe, 0.3–0.7 s): a stair-stepped pixel circle opens from the centre with a bright rim.',
    );
    const ids = availableTransitionStyles([voxelLook, testLook]).map((style) => style.id);
    expect(ids).toContain('pixel-sort-melt');
    expect(ids).not.toContain('crt-zoom');
    expect(ids).not.toContain('tile-flip');
    expect(ids).not.toContain('draw-over');
    expect(storyboardLookVars('mixed', [voxelLook])).not.toHaveProperty('transitions');
  });

  it('gives a multi-look storyboard its budget of non-cut transitions (real run 2.3)', () => {
    expect(storyboardLookVars('mixed', [voxelLook, testLook], 139)).toMatchObject({
      maxTransitions: '7',
    });
    expect(storyboardLookVars('mixed', [voxelLook, testLook], 139)).toMatchObject({
      wowBudget: '3',
    });
    expect(storyboardLookVars('mixed', [voxelLook], 139)).not.toHaveProperty('maxTransitions');
    expect(storyboardLookVars('voxel-only', undefined, 139)).toEqual({});
    const prompt = renderPrompt('storyboard', {
      styleId: 'voxel-pixel-crisp640',
      ...storyboardLookVars('mixed', [voxelLook, testLook], 139),
    });
    expect(prompt.ok && prompt.value).toContain('at most 7 non-cut transitions in this film');
  });

  it('lists the wow transitions with their content and budget in mixed storyboards (ADR-028)', () => {
    expect(wowTransitionLine(TRANSITION_STYLES['enter-keyhole'])).toBe(
      '- `enter-keyhole` (wipe, 0.8–1.4 s, set focus): a dark door with a brass keyhole closes around the focus point, the new shot shows through the keyhole, then the camera pushes through. Fits: secret, hidden, private, locked, conspiracy, mystery.',
    );
    expect(wowTransitionLine(TRANSITION_STYLES['paper-roll'])).not.toContain('focus');
    const ids = availableTransitionStyles([voxelLook, testLook]).map((style) => style.id);
    expect(ids).not.toContain('enter-lens');
    const prompt = renderPrompt('storyboard', {
      styleId: 'voxel-pixel-crisp640',
      ...storyboardLookVars('mixed', [voxelLook, testLook], 240),
    });
    const text = prompt.ok ? prompt.value : '';
    expect(text).toContain('Wow transitions (rare showpieces');
    expect(text).toContain('at most 6 in this film, about one per 40–90 s');
    expect(text).toContain('"focus": { "x": 0.62, "y": 0.4 }');
    for (const style of WOW_STYLE_LIST) expect(text).toContain(wowTransitionLine(style));
    const voxelOnly = renderPrompt('storyboard', { styleId: 'voxel-pixel-crisp640' });
    expect(voxelOnly.ok && voxelOnly.value).not.toContain('Wow transitions');
  });

  it("hands the scene build the shot's look docs; unknown looks build as voxel", () => {
    expect(sceneLookVars('mixed', SHOT)).toEqual({ lookId: 'voxel', lookDocs: voxelLook.docs });
    expect(sceneLookVars('mixed', { ...SHOT, look: 'test-look' }, [voxelLook, testLook])).toEqual({
      lookId: 'test-look',
      lookDocs: 'Build with test things.',
    });
    const retroUi = LOOKS.find((look) => look.id === 'retro-ui');
    expect(sceneLookVars('mixed', { ...SHOT, look: 'retro-ui' })).toEqual({
      lookId: 'retro-ui',
      lookDocs: retroUi?.docs,
    });
    expect(sceneLookVars('mixed', { ...SHOT, look: 'retro-ui' }, [voxelLook])).toEqual({
      lookId: 'voxel',
      lookDocs: voxelLook.docs,
    });
    expect(sceneLookVars('mixed', { ...SHOT, look: 'test-look' })).toEqual({
      lookId: 'voxel',
      lookDocs: voxelLook.docs,
    });
  });

  it("hands the critic the shot's look, roll and look rules (none in voxel-only)", () => {
    expect(criticLookVars('voxel-only', { ...SHOT, look: 'retro-ui', roll: 'B' })).toEqual({});
    expect(criticLookVars('mixed', { ...SHOT, look: 'retro-ui', roll: 'B' })).toEqual({
      lookId: 'retro-ui',
      roll: 'B',
      lookRules: CRITIC_LOOK_RULES['retro-ui'],
    });
    expect(criticLookVars('mixed', SHOT)).toEqual({
      lookId: 'voxel',
      lookRules: CRITIC_LOOK_RULES['voxel'],
    });
    expect(criticLookVars('mixed', { ...SHOT, look: 'test-look' }, [voxelLook, testLook])).toEqual({
      lookId: 'test-look',
      lookRules: 'Test look: a look that exists only in tests.',
    });
    for (const look of listLooks()) expect(CRITIC_LOOK_RULES[look.id], look.id).toBeDefined();
  });

  it('tells the critic about a planned source chip (real run 2.3: flagged as a watermark)', () => {
    const chip = {
      ...SHOT,
      look: 'whiteboard',
      annotations: [
        { kind: 'source-chip', phrase: 'eight weeks', text: 'righto.com', reason: 'claim' },
      ],
    } satisfies StoryboardShot;
    const vars = criticLookVars('mixed', chip);
    expect(vars).toMatchObject({ sourceChip: 'RIGHTO.COM' });
    expect(criticLookVars('voxel-only', chip)).toEqual({});
    const prompt = renderPrompt('critic', {
      imagePaths: 'a.png',
      intent: 'x',
      styleId: 'voxel-pixel-crisp640',
      ...vars,
    });
    expect(prompt.ok && prompt.value).toContain(
      '"SOURCE: RIGHTO.COM" plate in a corner is intended',
    );
  });

  it('keeps every look module in line with the storyboard schema', () => {
    for (const look of LOOKS) {
      expect(lookIdSchema.safeParse(look.id).success, look.id).toBe(true);
      for (const treatment of look.treatments) {
        expect(treatmentSchema.safeParse(treatment).success, `${look.id}: ${treatment}`).toBe(true);
      }
    }
  });
});
