/**
 * `kit.fx.whiteboardDiagram`: diagrams drawn in order by the hand: a flow chart (nodes and arrows,
 * auto laid out), a timeline, or an equation row of words, doodles and operators.
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';
import { whenParam } from '../blueprint/timing.js';
import { boardParams, defineWhiteboard } from './board.js';
import { flowEntries } from './diagram-flow.js';
import { equationEntries, timelineEntries } from './diagram-rows.js';
import { DOODLE_NAMES, type DoodleName } from './doodles.js';
import type { Entry, WhiteboardContext } from './tools.js';

const doodleParam = z.enum(DOODLE_NAMES as [DoodleName, ...DoodleName[]]);

const diagramParams = z
  .object({
    kind: z.enum(['flow', 'timeline', 'equation']).default('flow'),
    nodes: z
      .array(
        z.object({
          id: z.string().min(1).max(24),
          label: z.string().max(16).default(''),
          at: whenParam.optional().describe('When the node is drawn (seconds or phrase)'),
          shape: z.enum(['box', 'circle', 'cloud', 'none']).default('box'),
          doodle: doodleParam
            .optional()
            .describe('Draw this doodle with the label under it instead of a shape'),
          color: z.string().optional(),
        }),
      )
      .max(8)
      .default([])
      .describe('flow: nodes in drawing order'),
    edges: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          label: z.string().max(14).optional(),
          at: whenParam.optional(),
          color: z.string().optional(),
        }),
      )
      .max(12)
      .optional()
      .describe('flow: arrows (default: a chain through the nodes in order)'),
    layout: z
      .enum(['auto', 'row', 'column', 'cycle'])
      .default('auto')
      .describe('flow: auto = a row up to 4 nodes, two snaking rows above'),
    events: z
      .array(
        z.object({
          label: z.string().min(1).max(12),
          caption: z.string().max(20).optional(),
          at: whenParam.optional(),
          color: z.string().optional(),
        }),
      )
      .max(8)
      .default([])
      .describe('timeline: events left to right'),
    terms: z
      .array(
        z.union([
          z.string().min(1).max(14),
          z.object({
            text: z.string().max(14).optional(),
            doodle: doodleParam.optional(),
            at: whenParam.optional(),
            color: z.string().optional(),
          }),
        ]),
      )
      .max(7)
      .default([])
      .describe("equation: words, operators ('+', '-', '=', 'x', '->') or { doodle: 'bulb' }"),
  })
  .extend(boardParams);

type DiagramParams = z.output<typeof diagramParams>;

function setupDiagram(params: DiagramParams, context: WhiteboardContext): { entries: Entry[] } {
  const need = (count: number, what: string): void => {
    if (count === 0) {
      throw new KitError('invalid-params', `${context.call}: kind '${params.kind}' needs ${what}`);
    }
  };
  if (params.kind === 'timeline') {
    need(params.events.length, 'events');
    return { entries: timelineEntries(params.events, context) };
  }
  if (params.kind === 'equation') {
    need(params.terms.length, 'terms');
    const terms = params.terms.map((term) => (typeof term === 'string' ? { text: term } : term));
    return { entries: equationEntries(terms, context) };
  }
  need(params.nodes.length, 'nodes');
  return { entries: flowEntries(params.nodes, params.edges, params.layout, context) };
}

export const whiteboardDiagram = defineWhiteboard({
  name: 'whiteboardDiagram',
  description:
    'Whiteboard diagram (look whiteboard): a flow chart (boxes, circles, clouds or doodles joined by arrows, auto laid out), a timeline or an equation row (IDEA + WORK = $), drawn in order by hand, each part on its phrase. Full-frame 2D board: call update(t) every frame.',
  params: diagramParams,
  setup: setupDiagram,
});
