/**
 * Palette `diorama` (look 12.3): a miniature world heard from above — servos turn the model,
 * paper and chairs move, LEDs blink, fans whir, cars pass and birds chirp. The bed follows the
 * diorama type named in the shot's intent (server room, city, office, else a room).
 */
import type { StoryboardShot } from '@reelforge/shared';
import { only, pick, type PaletteSlot, type SoundPalette } from './types.js';

export const DIORAMA_KINDS = ['server-room', 'city', 'office', 'room'] as const;
export type DioramaKind = (typeof DIORAMA_KINDS)[number];

const KIND_WORDS: readonly (readonly [DioramaKind, RegExp])[] = [
  ['server-room', /\b(?:server|servers|data ?cent(?:er|re)s?|racks?|serwer\w*)\b/u],
  ['city', /\b(?:city|cities|street|streets|town|traffic|roads?|downtown|miast\w*|ulic\w*)\b/u],
  ['office', /\b(?:office|offices|desks?|cubicles?|workplace|meeting|biur\w*)\b/u],
];

/** The diorama type a shot shows, from words in its intent (first match wins). */
export function dioramaKind(shot: Pick<StoryboardShot, 'intent'>): DioramaKind {
  const intent = shot.intent.toLowerCase();
  return KIND_WORDS.find(([, words]) => words.test(intent))?.[0] ?? 'room';
}

const isKind = (key: string): key is DioramaKind =>
  (DIORAMA_KINDS as readonly string[]).includes(key);

const BEDS = {
  'server-room': 'server-room',
  city: 'city',
  office: 'office',
  room: 'room-tone',
} as const;

/** Leads (s) put each accent's loudest moment on the cut (the fan swells in, the car passes). */
const ACCENTS: Readonly<Record<DioramaKind, PaletteSlot>> = {
  'server-room': [
    pick('server-whir', ['fan', 'rack'], { leadS: 0.3 }),
    pick('led-blip', ['mid'], { leadS: 0 }),
  ],
  city: [
    pick('traffic-pass', ['car', 'scooter'], { leadS: 0.6 }),
    pick('bird-chirp', ['sparrow', 'tweet'], { leadS: 0 }),
  ],
  office: [
    pick('chair', ['creak', 'swivel'], { leadS: 0.1 }),
    pick('paper-shuffle', ['shuffle'], { leadS: 0.05 }),
  ],
  room: [pick('servo', ['up', 'down'], { leadS: 0.1 }), pick('chair', ['creak'], { leadS: 0.1 })],
};

export const DIORAMA_PALETTE: SoundPalette = {
  id: 'diorama',
  label: 'Isometric diorama',
  sfx: {
    'transition-cut': [
      [pick('servo', ['up', 'down', 'step'], { leadS: 0.1 })],
      [pick('servo', ['up', 'down'], { leadS: 0.1 })],
    ],
    'transition-crossfade': only('traffic-pass', 'distant'),
    'transition-glitch': only('server-whir', 'spin-up'),
    'transition-wipe': only('paper-shuffle', 'flip'),
    appear: [
      [pick('led-blip', ['mid', 'high'])],
      [pick('paper-shuffle', ['flip'])],
      [pick('led-blip', ['low', 'mid'])],
    ],
    'list-item': only('led-blip'),
    'counter-step': [[pick('led-blip', ['mid'])], [pick('led-blip', ['low'])]],
    'counter-final': [[pick('horn-blip', ['toy'])], [pick('servo', ['step'])]],
    number: only('paper-shuffle', 'stack'),
    'number-big': [[pick('horn-blip', ['toy', 'car'], { leadS: 0 })]],
    'text-in': only('paper-shuffle', 'flip'),
    'text-typed': only('soft-keys', 'office', 'laptop'),
    'emphasis-riser': only('server-whir', 'spin-up'),
    'emphasis-hit': only('horn-blip', 'double', 'toy'),
    'end-card': only('bird-chirp', 'sparrow', 'trill'),
  },
  listPitch: ['low', 'mid', 'high'],
  scene: {
    map: {
      click: 'led-blip',
      typewriter: 'soft-keys',
      tick: 'led-blip',
      tock: 'led-blip',
      pop: 'led-blip',
      blip: 'led-blip',
      paper: 'paper-shuffle',
      scribble: 'paper-shuffle',
      whoosh: 'traffic-pass',
      notification: 'bird-chirp',
      success: 'bird-chirp',
      'error-buzz': 'horn-blip',
      glitch: 'led-blip',
    },
    byCategory: {
      motion: 'servo',
      impact: 'paper-shuffle',
      texture: 'paper-shuffle',
      ui: 'led-blip',
      tonal: 'bird-chirp',
    },
  },
  accents: ACCENTS,
  ambience: {
    key: (shot) => dioramaKind(shot),
    bed: (key) => (isKind(key) ? BEDS[key] : 'room-tone'),
    gainDb: -28,
    underMusic: (key) => (isKind(key) ? BEDS[key] : 'room-tone'),
    underMusicGainDb: -33,
  },
};
