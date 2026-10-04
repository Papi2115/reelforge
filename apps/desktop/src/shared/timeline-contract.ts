/**
 * Timeline editor contracts (PLAN.md#6.5): the edit operations the renderer sends to main for
 * `storyboard.json` and `cues.json`, and the waveform peaks of the playing audio. Every edit
 * carries the value it expects to replace (`from`, `at`), so main refuses an edit made against a
 * stale view instead of overwriting a newer file. Main answers an applied edit with its inverse,
 * which is what undo sends back.
 */
import { shotIdSchema } from '@reelforge/shared';
import { z } from 'zod';

/** Shortest shot a boundary drag may produce (seconds). */
export const MIN_SHOT_SECONDS = 1;
/** Boundary/cue drags snap to a word boundary this close (seconds); Alt disables snapping. */
export const SNAP_TOLERANCE_SECONDS = 0.15;
/** Longest timeline the editor accepts (matches the mixer's limit). */
export const MAX_TIMELINE_SECONDS = 3 * 60 * 60;
/** Times written by the editor are rounded to milliseconds. */
export const TIME_RESOLUTION = 0.001;

/** Built-in SFX recipes (packages/pipeline SFX_RECIPES; equality is checked by a main test). */
export const BUILTIN_SFX_NAMES = [
  'whoosh',
  'click',
  'hit',
  'typewriter',
  'riser',
  'glitch',
  'tick',
  'pop',
  'swoosh-in',
  'swoosh-out',
  'whoosh-impact',
  'downer',
  'hit-soft',
  'boom',
  'stamp',
  'snap',
  'bubble',
  'bubble-up',
  'scribble',
  'paper',
  'camera-shutter',
  'tock',
  'blip',
  'blip-up',
  'blip-down',
  'notification',
  'success',
  'error-buzz',
  'ding',
  'chime',
  'coin',
  'sparkle',
  // look palettes (PLAN.md#12.24)
  'key-click',
  'keyboard',
  'mouse-click',
  'window-open',
  'window-close',
  'disk-seek',
  'modem',
  'crt-zap',
  'error-beep',
  'terminal-tick',
  'soft-keys',
  'chair',
  'paper-shuffle',
  'server-whir',
  'led-blip',
  'traffic-pass',
  'horn-blip',
  'bird-chirp',
  'servo',
  'pencil-scratch',
  'plotter-pen',
  'ruler-tick',
  'measure-blip',
  'relay-click',
  'data-ping',
  'shape-pop',
  'swoosh-soft',
  'whoosh-flat',
  'flat-tick',
  'chime-up',
  'text-snap',
  'marker-stroke',
  'marker-squeak',
  'cap-pop',
  'eraser-swipe',
  'board-tap',
  'board-chime',
  'board-tick',
  'paper-rustle',
  'paper-slide',
  'scissor-snip',
  'tape-tear',
  'paper-pop',
  'wood-tick',
  'page-flip',
] as const;

export const CUE_TRACKS = ['sfx', 'ambience', 'music'] as const;
export const cueTrackSchema = z.enum(CUE_TRACKS);
export type CueTrack = z.infer<typeof cueTrackSchema>;
export const rangeTrackSchema = z.enum(['ambience', 'music']);
export type RangeTrack = z.infer<typeof rangeTrackSchema>;

const timeSchema = z.number().min(0).max(MAX_TIMELINE_SECONDS);
const indexSchema = z.int().min(0).max(100_000);
const gainSchema = z.number().min(-60).max(24);
const rangeSchema = z
  .strictObject({ from: timeSchema, to: timeSchema })
  .refine((range) => range.to > range.from, { message: '`to` must be greater than `from`' });
export type TimeRange = z.infer<typeof rangeSchema>;

/** A cue exactly as stored in cues.json (restored by undoing a delete). */
export const rawCueSchema = z.record(z.string(), z.json());
export type RawCue = z.infer<typeof rawCueSchema>;

export const moveBoundaryEditSchema = z.strictObject({
  kind: z.literal('move-boundary'),
  /** The shot ending at the boundary and the one starting there (adjacent in the file). */
  left: shotIdSchema,
  right: shotIdSchema,
  from: timeSchema,
  to: timeSchema,
});
export type MoveBoundaryEdit = z.infer<typeof moveBoundaryEditSchema>;

export const cueEditSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('move-sfx'),
    index: indexSchema,
    from: timeSchema,
    to: timeSchema,
  }),
  z.strictObject({
    kind: z.literal('set-range'),
    track: rangeTrackSchema,
    index: indexSchema,
    from: rangeSchema,
    to: rangeSchema,
  }),
  z.strictObject({
    kind: z.literal('set-gain'),
    track: cueTrackSchema,
    index: indexSchema,
    from: gainSchema,
    to: gainSchema,
  }),
  z.strictObject({
    kind: z.literal('insert-cue'),
    track: cueTrackSchema,
    index: indexSchema,
    cue: rawCueSchema,
  }),
  /** `at` = the cue's `t` (sfx) or `from` (ranges), as a staleness check. */
  z.strictObject({
    kind: z.literal('delete-cue'),
    track: cueTrackSchema,
    index: indexSchema,
    at: timeSchema,
  }),
]);
export type CueEdit = z.infer<typeof cueEditSchema>;

export const EDIT_REASONS = ['edit', 'undo', 'redo'] as const;
const editReasonSchema = z.enum(EDIT_REASONS);
export type EditReason = z.infer<typeof editReasonSchema>;

export const MAX_EDITS_PER_REQUEST = 1_000;

/** Edits of one file, applied in order as one change (one write, one commit). */
export const fileEditsSchema = z.discriminatedUnion('file', [
  z.strictObject({
    file: z.literal('storyboard'),
    edits: z.array(moveBoundaryEditSchema).min(1).max(MAX_EDITS_PER_REQUEST),
  }),
  z.strictObject({
    file: z.literal('cues'),
    edits: z.array(cueEditSchema).min(1).max(MAX_EDITS_PER_REQUEST),
  }),
]);
export type FileEdits = z.infer<typeof fileEditsSchema>;
export type TimelineFile = FileEdits['file'];

export const timelineEditRequestSchema = z.strictObject({
  change: fileEditsSchema,
  reason: editReasonSchema,
});
export type TimelineEditRequest = z.infer<typeof timelineEditRequestSchema>;

export const timelineEditResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** The edits that undo this change (same file, already in apply order). */
    inverse: fileEditsSchema,
    /** Commit subject written to the project history. */
    message: z.string(),
    committed: z.boolean(),
  }),
  /** The file changed since the view was read, or the edit breaks a rule (min length, …). */
  z.object({ status: z.literal('rejected'), message: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type TimelineEditResult = z.infer<typeof timelineEditResultSchema>;

/** Waveform resolution sent to the renderer. */
export const PEAKS_PER_SECOND = 200;
/** ffmpeg decodes to mono PCM at this rate before the peaks are taken. */
export const PEAKS_SAMPLE_RATE = 8_000;

export const waveformRequestSchema = z.strictObject({
  /** Project-relative audio file (forward slashes), inside `audio/`. */
  file: z
    .string()
    .max(260)
    .regex(/^audio\/[^/\\]+$/, 'expected a file directly inside audio/'),
});
export type WaveformRequest = z.infer<typeof waveformRequestSchema>;

const peakBytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array, {
  message: 'expected peak bytes',
});

export const waveformResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    file: z.string(),
    peaksPerSecond: z.int().positive(),
    /** One byte per bucket: the bucket's peak |amplitude| scaled to 0..255. */
    peaks: peakBytesSchema,
  }),
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
]);
export type WaveformResult = z.infer<typeof waveformResultSchema>;
