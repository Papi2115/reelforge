/**
 * Test support (not exported): a direction plan of a 30 s Grim Ink film that passes every rule,
 * and a storyboard that executes it. Tests break one thing at a time.
 */
import type { DirectionFile, FramingStep, StoryboardShot } from '@reelforge/shared';

export const PLAN_DURATION_S = 30;

export const PLAN_SCRIPT =
  'Nobody had the key. The warden slept through every alarm. The inmate counted the bars twice. Then the lock simply fell off. The warden woke up to an open door. He went back to sleep.';

const wide = (subject: string): FramingStep => ({ framing: 'wide', subject });
const medium = (subject: string): FramingStep => ({ framing: 'medium', subject });
const close = (subject: string): FramingStep => ({
  framing: 'close',
  subject,
  why: 'emotion: the reaction',
});
const ecu = (subject: string): FramingStep => ({
  framing: 'ecu',
  subject,
  why: 'information: the thing the narration names',
});

export function goodPlan(): DirectionFile {
  return {
    version: 1,
    titleFrame: {
      cast: ['warden', 'inmate'],
      title: 'Nobody had the key',
      background: { placeId: 'cellBlock', why: 'the place the story is trapped in' },
      acting: [
        { person: 'warden', pose: 'akimbo', expr: 'smug', note: 'jingles an empty key ring' },
        { person: 'inmate', pose: 'stand', expr: 'scared' },
      ],
      accentObject: 'the empty key ring',
    },
    motifs: [{ id: 'keyRing', object: 'a ring of keys', meaning: 'control nobody has' }],
    cast: [
      {
        id: 'warden',
        role: 'the night warden',
        signatureGag: {
          kind: 'yawn',
          note: 'yawns at every alarm',
          arc: {
            setup: 'b01',
            escalations: ['b03'],
            payoff: 'b06',
            why: 'his boredom opens the door',
          },
        },
      },
      {
        id: 'inmate',
        signatureGag: {
          kind: 'sweat',
          arc: {
            setup: 'b02',
            escalations: ['b04'],
            payoff: 'b05',
            why: 'his nerves carry the stakes',
          },
        },
      },
    ],
    beats: [
      {
        id: 'b01',
        span: { t0: 0, t1: 4, text: 'Nobody had the key.' },
        intent: 'setup',
        camera: {
          progression: [wide('the cell block'), ecu('the empty hook'), close('the warden')],
        },
        gagRefs: ['warden'],
      },
      {
        id: 'b02',
        span: { t0: 4, t1: 9, text: 'The warden slept through every alarm.' },
        intent: 'reveal',
        camera: { progression: [medium('the warden asleep'), close('the inmate')] },
        gagRefs: ['inmate'],
      },
      {
        id: 'b03',
        span: { t0: 9, t1: 14, text: 'The inmate counted the bars twice.' },
        intent: 'cause-effect',
        camera: { progression: [wide('the cell'), ecu('the bars'), medium('both of them')] },
        accident: 'the inmate bumps his head on the bunk while counting',
        gagRefs: ['warden'],
      },
      {
        id: 'b04',
        span: { t0: 14, t1: 19, text: 'Then the lock simply fell off.' },
        intent: 'tension',
        camera: { progression: [ecu('the lock'), close('the inmate')], tilt: true },
        gagRefs: ['inmate'],
      },
      {
        id: 'b05',
        span: { t0: 19, t1: 24, text: 'The warden woke up to an open door.' },
        intent: 'reveal',
        camera: {
          progression: [wide('the open door'), ecu('the lock on the floor'), close('the warden')],
        },
        gagRefs: ['inmate'],
      },
      {
        id: 'b06',
        span: { t0: 24, t1: 30, text: 'He went back to sleep.' },
        intent: 'punchline',
        camera: { progression: [close('the warden'), wide('the empty cell block')] },
        gagRefs: ['warden'],
      },
    ],
    climax: { beatRef: 'b05', ecuSubject: 'the lock on the floor', why: 'the outcome lies there' },
    accidents: ['b03'],
  };
}

function shot(
  id: string,
  t0: number,
  t1: number,
  intent: string,
  look: string,
  direction: StoryboardShot['direction'],
): StoryboardShot {
  return {
    id,
    t0,
    t1,
    treatment: look === 'ink-poster' ? 'title-card' : 'character-scene',
    intent,
    scene: `scenes/${id}.js`,
    roll: look === 'ink-poster' ? 'C' : 'A',
    look,
    ...(direction === undefined ? {} : { direction }),
  };
}

/** A storyboard that executes `goodPlan()`. */
export function goodShots(): StoryboardShot[] {
  const plan = goodPlan();
  const progression = (id: string): FramingStep[] =>
    plan.beats.find((beat) => beat.id === id)?.camera.progression ?? [];
  return [
    shot(
      's01_title',
      0,
      2.5,
      'cast: warden, inmate | place: cellBlock. Title "Nobody had the key".',
      'ink-poster',
      {
        titleFrame: true,
        framings: [wide('the title over the cast')],
      },
    ),
    shot(
      's02_key',
      2.5,
      9,
      'cast: warden, inmate | place: cellBlock. Nobody had the key.',
      'ink-scene',
      {
        beats: ['b01', 'b02'],
        gags: ['warden', 'inmate'],
        framings: [...progression('b01')],
      },
    ),
    shot('s03_bars', 9, 14, 'cast: warden, inmate | place: cellBlock. The bars.', 'ink-scene', {
      beats: ['b03'],
      gags: ['warden'],
      framings: progression('b03'),
    }),
    shot('s04_lock', 14, 19, 'cast: inmate | place: cellBlock. The lock falls.', 'ink-scene', {
      beats: ['b04'],
      gags: ['inmate'],
      framings: progression('b04'),
    }),
    shot(
      's05_door',
      19,
      24,
      'cast: warden, inmate | place: cellBlock. The open door.',
      'ink-scene',
      {
        beats: ['b05'],
        gags: ['inmate'],
        framings: progression('b05'),
      },
    ),
    shot('s06_sleep', 24, 30, 'cast: warden | place: cellBlock. Back to sleep.', 'ink-scene', {
      beats: ['b06'],
      gags: ['warden'],
      framings: progression('b06'),
    }),
  ];
}
