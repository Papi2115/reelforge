/**
 * Option schemas of `kit.fx.b2Hud` (one per method; times are local seconds or spoken phrases)
 * and the readable text check every HUD word goes through (the pixel face's characters, lines
 * and width).
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { textWidth, unsupportedChars } from '../core/font.js';
import { ICON_HELP } from './inventory.js';

export const CALL = 'kit.fx.b2Hud()';

export const time = whenParam;
export const span = { at: time.default(0), until: time.optional() };
/** HUD words are caps (the face has no lower case); accents and symbols it lacks stay errors. */
export const words = (schema: z.ZodString) => schema.transform((text) => text.toUpperCase());

export const schemas = {
  compass: z.strictObject({
    ...span,
    year: words(z.string().max(5)).optional(),
    place: words(z.string().max(24)).default(''),
    years: z
      .array(
        z.strictObject({
          at: time,
          year: words(z.string().max(5)),
          place: words(z.string().max(24)).default(''),
        }),
      )
      .max(8)
      .optional(),
    target: z.tuple([z.number(), z.number()]).optional(),
    targets: z
      .array(z.strictObject({ at: time, pos: z.tuple([z.number(), z.number()]) }))
      .max(12)
      .optional(),
  }),
  minimap: z.strictObject(span),
  meter: z.strictObject({
    ...span,
    label: words(z.string().min(1).max(10)),
    segments: z.int().min(4).max(16).default(12),
    keys: z
      .array(z.tuple([time, z.number().min(0).max(16)]))
      .min(1)
      .max(16),
  }),
  status: z.strictObject({
    ...span,
    label: words(z.string().min(1).max(14)),
    icon: z.enum(['hourglass', 'waves', 'alarm']).default('hourglass'),
  }),
  boss: z.strictObject({
    ...span,
    name: words(z.string().min(1).max(24)),
    label: words(z.string().max(10)).default(''),
    keys: z
      .array(z.tuple([time, z.number().min(0).max(1)]))
      .min(1)
      .max(12),
  }),
  progress: z.strictObject({
    ...span,
    from: z.number().min(0).max(1),
    to: z.number().min(0).max(1),
    chapters: z.array(z.number().min(0).max(1)).max(8).default([]),
  }),
  checkpoint: z.strictObject({
    at: time,
    until: time.optional(),
    label: words(z.string().min(1).max(20)),
  }),
  toast: z.strictObject({
    at: time,
    until: time.optional(),
    head: words(z.string().min(1).max(16)),
    body: words(z.string().min(1).max(28)),
  }),
  say: z.strictObject({
    at: time,
    until: time.optional(),
    speaker: words(z.string().max(14)).default(''),
  }),
  choose: z.strictObject({
    at: time,
    until: time,
    speaker: words(z.string().max(14)).default(''),
    options: z
      .array(words(z.string().min(1).max(20)))
      .min(2)
      .max(4),
    steps: z
      .array(
        z.strictObject({
          at: time,
          cursor: z.int().min(0).optional(),
          strike: z.int().min(0).optional(),
          pick: z.int().min(0).optional(),
        }),
      )
      .max(12)
      .default([]),
  }),
  inventory: z.strictObject({
    ...span,
    items: z
      .array(
        z.strictObject({
          icon: z.string().describe(ICON_HELP),
          label: words(z.string().min(1).max(24)),
          at: time.default(0),
          itemLabel: words(z.string().max(5)).optional(),
          band: z.string().optional(),
          out: time.optional().describe('The item leaves the bar (thrown, handed over)'),
        }),
      )
      .min(1)
      .max(6),
  }),
} as const;

export type Schemas = typeof schemas;
export type Input<K extends keyof Schemas> = z.input<Schemas[K]>;

export function fail(message: string): never {
  throw new KitError('invalid-params', `${CALL}: ${message}`);
}

export function parseWith<S extends z.ZodType>(
  schema: S,
  value: unknown,
  what: string,
): z.output<S> {
  const parsed = schema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  return fail(
    `${what}: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || '(options)'} ${issue.message}`).join('; ')}`,
  );
}

export function parse<K extends keyof Schemas>(key: K, value: unknown): z.output<Schemas[K]> {
  return parseWith(schemas[key], value, `${key}()`) as z.output<Schemas[K]>;
}

/** Readable text checks: the pixel face's characters, lines and width. */
export function checkText(
  where: string,
  text: string,
  maxLines: number,
  maxWidth: number,
  scale: number,
): void {
  const bad = unsupportedChars(text);
  if (bad.length > 0)
    fail(
      `${where}: "${text}" has characters the pixel face cannot draw: ${bad.join(' ')} (use CAPS, digits, . , : ' ! ? - + / ~ % $ # & ( ))`,
    );
  const lines = text.split('\n');
  if (lines.length > maxLines)
    fail(`${where}: ${String(lines.length)} lines, max ${String(maxLines)}`);
  for (const line of lines)
    if (textWidth(line, scale) > maxWidth)
      fail(
        `${where}: "${line}" is too wide (max ${String(maxWidth)} px at scale ${String(scale)}); break it with \\n or shorten it`,
      );
}
