/**
 * Spec schemas of `page.diagram(kind, spec)` (PLAN.md#13.15a): one strict object per kind, the
 * shared pen / label size / label mode / highlight, readable errors through the page's parse.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { swatch } from './spec.js';

const label = z.string().min(1).max(40);
const item = z.strictObject({ label });
const base = {
  at: whenParam.optional(),
  pen: z.enum(['felt', 'bic', 'fine', 'pencil']).default('felt').describe('bic for look B pages'),
  size: z.number().min(10).max(60).default(18).describe('Label cap height'),
  labels: z
    .enum(['appear', 'hand'])
    .default('appear')
    .describe('Small labels bloom in, or the hand writes them'),
  highlight: z.int().min(0).optional().describe('Index of the one red element'),
};
const unit = z.number().min(0).max(1);

export const DIAGRAM_SCHEMAS = {
  callout: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number(),
    label,
    from: z.tuple([z.number(), z.number()]),
    ring: z.number().min(0).max(200).default(0),
  }),
  timeline: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number(),
    w: z.number().min(100).max(880),
    events: z
      .array(z.strictObject({ label, pos: unit.optional() }))
      .min(2)
      .max(8),
  }),
  map: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number(),
    w: z.number().min(80).max(880),
    h: z.number().min(60).max(500),
    land: z.enum(['island', 'coast', 'none']).default('island'),
    color: swatch.default('green'),
    route: z
      .array(z.tuple([unit, unit]))
      .min(2)
      .max(16)
      .optional(),
    mark: z.tuple([unit, unit]).optional().describe('The red X (local 0-1)'),
    places: z
      .array(z.strictObject({ label, at: z.tuple([unit, unit]) }))
      .max(6)
      .default([]),
    compass: z.boolean().default(true),
  }),
  bars: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number().describe('Baseline'),
    w: z.number().min(60).max(880),
    h: z.number().min(40).max(480),
    bars: z
      .array(z.strictObject({ value: z.number().min(0), label }))
      .min(1)
      .max(8),
    values: z.boolean().default(false),
    color: swatch.default('orange'),
  }),
  line: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number().describe('Baseline'),
    w: z.number().min(60).max(880),
    h: z.number().min(40).max(480),
    points: z.array(z.number()).min(2).max(16),
    from: label.optional(),
    to: label.optional(),
  }),
  pie: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number(),
    r: z.number().min(20).max(240),
    slices: z
      .array(z.strictObject({ value: z.number().positive(), label, color: swatch.optional() }))
      .min(2)
      .max(6),
  }),
  venn: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number(),
    r: z.number().min(30).max(220),
    sets: z.tuple([item, item]),
    both: label.optional(),
  }),
  flow: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number(),
    w: z.number().min(100).max(880),
    steps: z.array(item).min(2).max(6),
    direction: z.enum(['right', 'down']).default('right'),
  }),
  stack: z.strictObject({
    ...base,
    labels: z
      .enum(['appear', 'hand'])
      .default('hand')
      .describe('The facts are the content: the hand writes them'),
    x: z.number(),
    y: z.number(),
    items: z.array(item).min(2).max(7),
    bullet: z.enum(['dot', 'check', 'cross', 'dash']).default('dot'),
    gap: z.number().min(16).max(120).optional(),
  }),
  cutaway: z.strictObject({
    ...base,
    x: z.number(),
    y: z.number(),
    w: z.number().min(80).max(880),
    h: z.number().min(60).max(500),
    layers: z
      .array(z.strictObject({ label, color: swatch, depth: z.number().positive() }))
      .min(2)
      .max(6),
    shape: z.enum(['ground', 'box', 'dome']).default('ground'),
  }),
} as const;
export type DiagramKind = keyof typeof DIAGRAM_SCHEMAS;
export const DIAGRAM_KINDS = Object.keys(DIAGRAM_SCHEMAS) as DiagramKind[];
