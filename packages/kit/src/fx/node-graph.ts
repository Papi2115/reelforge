/**
 * `kit.fx.nodeGraph`: nodes pop in one after another, edges draw in as trails of voxel cubes
 * once both ends exist, highlights make nodes glow and send pulses along edges. The graph
 * stands in the x/y plane facing +z; labels sit under (or above) the nodes on dark plates in
 * front of the edges, so crossing edges never hide text.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { colorOf } from '../env/shared.js';
import { KitError } from '../errors.js';
import { createKitObject, type KitObject } from '../object.js';
import { defineFx, type KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import { asFx, EASES, progress, SERIES_COLORS, timeParam, vec2Param } from './shared.js';
import { textBlock, textHeight, textWidth } from './text.js';
import { createTrail } from './trail.js';

const graphNode = z.object({
  id: z.string().min(1).describe('Unique id (edges and highlights refer to it)'),
  label: z.string().max(32).default('').describe('Text next to the node'),
  labelSide: z
    .enum(['below', 'above'])
    .default('below')
    .describe('Put the label where no edge leaves the node'),
  position: vec2Param.optional().describe('[x, y] in units (default: from layout)'),
  color: z.string().optional().describe('Palette name (default: series colours in turn)'),
  at: z.number().optional().describe('Local time the node pops in (default: start + i * stagger)'),
});

const graphEdge = z.object({
  from: z.string().describe('Node id'),
  to: z.string().describe('Node id'),
  at: z
    .number()
    .optional()
    .describe('Local time the edge starts drawing (default: after both nodes)'),
});

const highlight = z.object({
  id: z.string().describe("Node id, or 'from>to' for an edge"),
  at: z.number().describe('Local time the highlight starts'),
  until: z.number().optional().describe('Local time it ends (default: end of shot)'),
});

export const nodeGraphParams = z.object({
  nodes: z.array(graphNode).min(1).max(24),
  edges: z.array(graphEdge).max(48).default([]),
  layout: z
    .enum(['circle', 'row', 'column'])
    .default('circle')
    .describe('Placement of nodes without a position'),
  radius: z.number().positive().default(2.5).describe('Circle radius / row spacing in units'),
  start: timeParam.default(0).describe('Local time the first node pops in'),
  stagger: z.number().min(0).default(0.35).describe('Delay between nodes in seconds'),
  drawTime: z.number().positive().default(0.6).describe('Seconds an edge takes to draw'),
  highlights: z.array(highlight).max(48).default([]),
  nodeSize: z.number().positive().default(0.6).describe('Node edge length in units'),
  labelHeight: z.number().positive().default(0.22).describe('Label text height in units'),
  edgeColor: z.string().default('textDim').describe('Palette name'),
  highlightColor: z.string().default('accent2').describe('Palette name'),
});

export type NodeGraphParams = z.output<typeof nodeGraphParams>;

const POP_TIME = 0.35;
const NODE_VOXELS = 6;

/** Node centres [x, y] (explicit positions win over the layout). */
export function nodePositions(params: NodeGraphParams): [number, number][] {
  const count = params.nodes.length;
  return params.nodes.map((node, index) => {
    if (node.position) return [node.position[0], node.position[1]];
    if (params.layout === 'row') return [(index - (count - 1) / 2) * params.radius, 0];
    if (params.layout === 'column') return [0, ((count - 1) / 2 - index) * params.radius];
    const angle = Math.PI / 2 - (index / count) * Math.PI * 2;
    return [Math.cos(angle) * params.radius, Math.sin(angle) * params.radius];
  });
}

/** Pop-in time of every node. */
export function nodeTimes(params: NodeGraphParams): number[] {
  return params.nodes.map((node, index) => node.at ?? params.start + index * params.stagger);
}

/** Drawn share 0..1 of edge `index` at time t. */
export function edgeProgress(params: NodeGraphParams, index: number, t: number): number {
  const edge = params.edges[index];
  if (!edge) return 0;
  const times = nodeTimes(params);
  const ids = params.nodes.map((node) => node.id);
  const from = times[ids.indexOf(edge.from)] ?? 0;
  const to = times[ids.indexOf(edge.to)] ?? 0;
  const begin = edge.at ?? Math.max(from, to) + POP_TIME * 0.5;
  return progress(t, begin, begin + params.drawTime);
}

function highlighted(params: NodeGraphParams, id: string, t: number): boolean {
  return params.highlights.some(
    (entry) => entry.id === id && t >= entry.at && t < (entry.until ?? Infinity),
  );
}

function checkIds(params: NodeGraphParams): void {
  const ids = new Set<string>();
  for (const node of params.nodes) {
    if (ids.has(node.id)) {
      throw new KitError('invalid-params', `kit.fx.nodeGraph(): duplicate node id "${node.id}"`);
    }
    ids.add(node.id);
  }
  for (const edge of params.edges) {
    for (const id of [edge.from, edge.to]) {
      if (!ids.has(id)) {
        throw new KitError(
          'invalid-params',
          `kit.fx.nodeGraph(): edge ${edge.from}>${edge.to} refers to unknown node "${id}" (nodes: ${[...ids].join(', ')})`,
        );
      }
    }
  }
}

function nodeModel(tools: KitTools, color: string, glow: boolean) {
  const n = NODE_VOXELS;
  const edge = (value: number): boolean => value === 0 || value === n - 1;
  return tools.voxel.generate([n, n, 4], (x, y) => (edge(x) && edge(y) ? 0 : 1), [
    glow ? { color, glow: true } : color,
  ]);
}

interface NodeView {
  readonly root: THREE.Group;
  readonly normal: KitObject;
  readonly lit: KitObject;
}

export const nodeGraph = defineFx({
  name: 'nodeGraph',
  description:
    "Node graph / network: nodes (with labels) pop in one by one, edges draw in as voxel-cube trails, highlights ({ id: 'a' or 'a>b', at, until }) make nodes glow and pulses run along edges. Layout circle/row/column or explicit [x, y] positions. fx.update(t) every frame.",
  params: nodeGraphParams,
  anchors: { 'node:<id>': 'centre of the node with that id' },
  build(params, tools) {
    checkIds(params);
    const { three } = tools;
    const positions = nodePositions(params);
    const times = nodeTimes(params);
    const anchors: Record<string, Vec3> = {};
    params.nodes.forEach((node, index) => {
      const [x, y] = positions[index] ?? [0, 0];
      anchors[`node:${node.id}`] = [x, y, 0];
    });
    const object = createKitObject(three, { kitType: 'nodeGraph', anchors });
    const voxel = params.nodeSize / NODE_VOXELS;
    const views: NodeView[] = params.nodes.map((node, index) => {
      const color = node.color ?? SERIES_COLORS[index % SERIES_COLORS.length] ?? 'accent1';
      const root = new three.Group();
      const [x, y] = positions[index] ?? [0, 0];
      root.position.set(x, y, 0);
      const options = { voxelSize: voxel, pivot: 'center' as const };
      const normal = tools.voxel.mesh(nodeModel(tools, color, false), options);
      const lit = tools.voxel.mesh(nodeModel(tools, params.highlightColor, true), options);
      root.add(normal, lit);
      object.add(root);
      if (node.label.length > 0) {
        const style = { height: params.labelHeight, color: { color: 'text', glow: true } };
        const margin = params.labelHeight * 0.4;
        const plateSize: Vec3 = [
          textWidth([node.label], style) + margin * 2,
          textHeight(1, style) + margin * 2,
          voxel,
        ];
        const offset = params.nodeSize * 0.6 + plateSize[1] / 2;
        const y = node.labelSide === 'above' ? offset : -offset;
        const label = textBlock(tools, [node.label], style);
        label.position.set(0, y, 0.3);
        const plate = new three.Mesh(
          tools.track(new three.BoxGeometry(...plateSize)),
          tools.track(new three.MeshBasicMaterial({ color: colorOf(tools, 'shadow') })),
        );
        plate.position.set(0, y, 0.2);
        root.add(label, plate);
      }
      return { root, normal, lit };
    });
    const ids = params.nodes.map((node) => node.id);
    const trim = params.nodeSize * 0.75;
    const paths = params.edges.map((edge): Vec3[] => {
      const [ax, ay] = positions[ids.indexOf(edge.from)] ?? [0, 0];
      const [bx, by] = positions[ids.indexOf(edge.to)] ?? [0, 0];
      const length = Math.hypot(bx - ax, by - ay);
      const k = length > trim * 2 ? trim / length : 0.5;
      return [
        [ax + (bx - ax) * k, ay + (by - ay) * k, -0.05],
        [bx - (bx - ax) * k, by - (by - ay) * k, -0.05],
      ];
    });
    const trail = createTrail(tools, paths, { spacing: voxel * 2.2, size: voxel * 1.4 });
    object.add(trail.mesh);
    const edgeColor = colorOf(tools, params.edgeColor);
    const hotColor = colorOf(tools, params.highlightColor);
    const pulseColor = colorOf(tools, 'heroTrim');
    return asFx(object, (t) => {
      views.forEach((view, index) => {
        const id = ids[index] ?? '';
        const begin = times[index] ?? 0;
        const pop = EASES.easeOutBack(progress(t, begin, begin + POP_TIME));
        const hot = highlighted(params, id, t);
        const pulse = hot ? 1 + 0.12 * Math.sin(t * 10) : 1;
        view.root.visible = pop > 0;
        view.root.scale.setScalar(Math.max(1e-4, pop));
        view.normal.visible = !hot;
        view.lit.visible = hot;
        view.lit.scale.setScalar(pulse);
      });
      params.edges.forEach((edge, index) => {
        trail.reveal(index, edgeProgress(params, index, t));
        const hot = highlighted(params, `${edge.from}>${edge.to}`, t);
        const phase = (t * 1.2) % 1;
        trail.tint(index, (fraction) => {
          if (!hot) return edgeColor;
          return Math.abs(fraction - phase) < 0.12 ? pulseColor : hotColor;
        });
      });
    });
  },
});
