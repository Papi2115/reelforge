/**
 * Spec of `page.strip(...)` (an accordion timeline, docs/worlds/sketchbook-v2 shot 8): 2-8 events
 * in order (a big label, a short note, an optional doodle, an optional year that spaces them), the
 * one highlighted event (written after a held beat, its note in red), and the time window.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { checkLettering } from './popup-check.js';

export const STRIP_LIMITS = { events: 8, noteLines: 2 } as const;

const line = z.string().min(1).max(22);

export const stripEvent = z.object({
  label: z.string().min(1).max(10).describe('The date or title, written big (45 BC, 1582)'),
  note: z
    .union([line, z.array(line).min(1).max(STRIP_LIMITS.noteLines)])
    .optional()
    .describe('One or two short lines under the axis (<= 22 characters each)'),
  year: z
    .number()
    .min(-100_000)
    .max(100_000)
    .optional()
    .describe('Spaces the events (all or none)'),
  doodle: z
    .enum(['none', 'sun', 'figure', 'loop'])
    .default('none')
    .describe('Small drawing by the note'),
});
export type StripEvent = z.output<typeof stripEvent>;

export const stripOptions = z.object({
  events: z.array(stripEvent).min(2).max(STRIP_LIMITS.events).describe('In order, 2-8'),
  highlight: z.int().min(0).optional().describe('Index of the event that is the point (red note)'),
  y: z.number().min(40).max(330).default(156).describe('Top edge of the strip (page px)'),
  at: whenParam.optional().describe('The first label starts (default 0.18)'),
  until: whenParam.optional().describe('The last note is written by then (the pace stretches)'),
  pen: z.enum(['felt', 'bic']).default('felt').describe('felt (story) or bic (look B proofs)'),
  end: z
    .string()
    .min(1)
    .max(10)
    .optional()
    .describe(
      "Pencil word at the strip end, with a clip ('now' only when the narration reaches today)",
    ),
  seed: z.int().min(0).optional(),
});
export type StripOptions = z.output<typeof stripOptions>;

/** Note lines of an event. */
export function noteLines(event: StripEvent): readonly string[] {
  if (event.note === undefined) return [];
  return typeof event.note === 'string' ? [event.note] : event.note;
}

export function checkStrip(o: StripOptions, call: string): void {
  const fail = (message: string): never => {
    throw new KitError('invalid-params', `${call}: ${message}`);
  };
  if (o.highlight !== undefined && o.highlight >= o.events.length) {
    fail(
      `highlight ${String(o.highlight)} is not an event index (0-${String(o.events.length - 1)})`,
    );
  }
  const years = o.events.filter((event) => event.year !== undefined).length;
  if (years !== 0 && years !== o.events.length) fail('give every event a year, or none');
  o.events.forEach((event, index) => {
    const where = `events.${String(index)}`;
    checkLettering(event.label, where, call);
    for (const text of noteLines(event)) checkLettering(text, where, call);
    const next = o.events[index + 1];
    if (next?.year !== undefined && event.year !== undefined && next.year <= event.year) {
      fail(`${where}: years must increase (${String(event.year)} then ${String(next.year)})`);
    }
  });
  if (o.end !== undefined) checkLettering(o.end, 'end', call);
}
