/**
 * The film's own vocabulary (PLAN.md#13.15a): `page.defineFigure(id, look)` (the same ranger in
 * every shot) and `page.defineProp(id, spec)` (a doodle, spot art or a generator call), and the
 * project asset files `assets/sketchbook/<id>.json` (or `.js` exporting the same object) that
 * carry them across shots: `{ version: 1, id, kind: 'figure' | 'prop', description, spec }`. A
 * defined thing draws with its own seed (from its id), so it wobbles the same way in every shot.
 * `sketchAssetFindings` lets a validator flag ids a scene uses but the project never defined.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { seedOf } from '../draw/math.js';
import { heightOf } from './gen/family.js';
import { drawSchema, familyOf, itemFamily, makeDrawing, type FinishOptions } from './gen/index.js';
import { spotDoodle } from './compile.js';
import { personLook } from './person.js';
import { parseDoodle, parseSpot, type DoodleSpec } from './spec.js';

export const ASSET_ID = /^[a-z][a-z0-9-]{0,39}$/;
const idSchema = z
  .string()
  .regex(ASSET_ID, 'ids are lower-case kebab-case, e.g. "ranger" or "fire-tower"');

export const sketchAssetSchema = z.strictObject({
  version: z.literal(1),
  id: idSchema,
  kind: z.enum(['figure', 'prop']),
  description: z.string().min(3).max(200),
  spec: z.record(z.string(), z.unknown()),
});
export type SketchAsset = z.output<typeof sketchAssetSchema>;

/** A defined prop: its drawing (page px per local unit when it is spot art) and default height. */
export interface PropEntry {
  readonly id: string;
  readonly height: number | undefined;
  readonly drawing: (pagePerUnit: number) => DoodleSpec;
}

const ownHeight = (spec: Record<string, unknown>, call: string): number | undefined => {
  const h = spec['h'];
  if (h === undefined) return undefined;
  if (typeof h !== 'number' || !(h >= 4 && h <= 1200))
    throw new KitError('invalid-params', `${call}: h must be a page height 4-1200`);
  return h;
};

/** Validates a prop spec: `{ doodle }`, `{ spot }` or `{ draw: kind, type, color, ... }` (+ `h`). */
export function propEntry(id: string, value: unknown, call: string): PropEntry {
  if (typeof value !== 'object' || value === null)
    throw new KitError('invalid-params', `${call}: the spec must be an object`);
  const spec = value as Record<string, unknown>;
  const height = ownHeight(spec, call);
  const seed = seedOf(id);
  if ('doodle' in spec) {
    const doodle = parseDoodle(spec['doodle'], `${call} doodle`);
    return { id, height, drawing: () => doodle };
  }
  if ('spot' in spec) {
    const art = parseSpot(spec['spot'], `${call} spot`);
    return {
      id,
      height: height ?? art.rows.length * art.px,
      drawing: (pagePerUnit) => spotDoodle(art, pagePerUnit),
    };
  }
  if ('draw' in spec) {
    const entry = familyOf(spec['draw'], call);
    const knobs = Object.fromEntries(
      Object.entries(spec).filter(([key]) => key !== 'draw' && key !== 'h'),
    );
    const schema = drawSchema(entry)
      .pick({
        type: true,
        color: true,
        action: true,
        count: true,
        plain: true,
        bold: true,
        shade: true,
      })
      .strict();
    const parsed = schema.safeParse(knobs);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'spec'}: ${issue.message}`)
        .join('; ');
      throw new KitError('invalid-params', `${call}: ${details}`);
    }
    const o = parsed.data;
    const finishing: FinishOptions = { plain: o.plain, bold: o.bold ?? false, shade: o.shade };
    const knobsOf = {
      type: o.type,
      color: o.color,
      action: o.action,
      count: o.count,
      w: undefined,
      h: undefined,
    };
    const drawing = makeDrawing(entry, knobsOf, seed, finishing, call);
    return { id, height: height ?? heightOf(entry, o.type), drawing: () => drawing };
  }
  throw new KitError(
    'invalid-params',
    `${call}: a prop is { doodle: {...} }, { spot: {...} } or { draw: 'tree', type: 'pine', ... } (plus an optional h)`,
  );
}

export class SketchLibrary {
  private readonly props = new Map<string, PropEntry>();
  private readonly figures = new Map<string, Record<string, unknown>>();

  private checkId(id: unknown, call: string): string {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success)
      throw new KitError(
        'invalid-params',
        `${call}: id ${JSON.stringify(id)}: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      );
    if (this.props.has(parsed.data) || this.figures.has(parsed.data)) {
      throw new KitError(
        'invalid-params',
        `${call}: "${parsed.data}" is already defined (ids are unique per page)`,
      );
    }
    return parsed.data;
  }

  defineProp(id: unknown, spec: unknown, call: string): void {
    const own = this.checkId(id, call);
    this.props.set(own, propEntry(own, spec, `${call}("${own}")`));
  }

  defineFigure(id: unknown, look: unknown, call: string): void {
    const own = this.checkId(id, call);
    const parsed = personLook.safeParse(look ?? {});
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'look'}: ${issue.message}`)
        .join('; ');
      throw new KitError('invalid-params', `${call}("${own}"): ${details}`);
    }
    this.figures.set(own, { ...(look as Record<string, unknown>) });
  }

  define(asset: SketchAsset, call: string): void {
    if (asset.kind === 'figure') this.defineFigure(asset.id, asset.spec, call);
    else this.defineProp(asset.id, asset.spec, call);
  }

  prop(id: unknown, call: string): PropEntry {
    const found = typeof id === 'string' ? this.props.get(id) : undefined;
    if (found) return found;
    throw new KitError(
      'invalid-params',
      `${call}: no prop "${String(id)}" (defined: ${[...this.props.keys()].join(', ') || 'none'}); define it with page.defineProp or an asset file`,
    );
  }

  hasProp(id: string): boolean {
    return this.props.has(id);
  }

  figure(id: unknown, call: string): Record<string, unknown> {
    const found = typeof id === 'string' ? this.figures.get(id) : undefined;
    if (found) return found;
    throw new KitError(
      'invalid-params',
      `${call}: no figure "${String(id)}" (defined: ${[...this.figures.keys()].join(', ') || 'none'}); define it with page.defineFigure or an asset file`,
    );
  }
}

/** Validates one asset file's content (`name` = its file name, e.g. "ranger.json"). */
export function parseSketchAsset(value: unknown, name?: string): SketchAsset {
  const where = name ?? 'asset';
  const parsed = sketchAssetSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`)
      .join('; ');
    throw new KitError('invalid-params', `${where}: ${details}`);
  }
  const asset = parsed.data;
  if (name !== undefined && !new RegExp(`(^|[\\\\/])${asset.id}\\.(json|js)$`).test(name)) {
    throw new KitError(
      'invalid-params',
      `${where}: the file of "${asset.id}" must be named ${asset.id}.json (or .js)`,
    );
  }
  new SketchLibrary().define(asset, where);
  return asset;
}

/** Checks a project's asset files: every error (all files), and the assets that passed. */
export function checkSketchAssets(
  files: readonly { readonly name: string; readonly value: unknown }[],
): {
  readonly assets: SketchAsset[];
  readonly errors: string[];
} {
  const assets: SketchAsset[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    try {
      const asset = parseSketchAsset(file.value, file.name);
      if (seen.has(asset.id)) errors.push(`${file.name}: "${asset.id}" is defined twice`);
      else {
        seen.add(asset.id);
        assets.push(asset);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { assets, errors };
}

export interface SketchAssetFinding {
  readonly line: number;
  readonly id: string;
  readonly message: string;
}

const USES = [
  /\.use\(\s*['"]([^'"]+)['"]/g,
  /\blike:\s*['"]([^'"]+)['"]/g,
  /\bholds:\s*['"]([^'"]+)['"]/g,
];

/**
 * Ids a scene uses (`page.use('x')`, `like: 'x'`, `holds: 'x'`) that are neither defined in the
 * scene (`defineProp('x'` / `defineFigure('x'`), in the project's asset ids, nor (for `holds`) a
 * built-in tool/object/instrument type.
 */
export function sketchAssetFindings(
  source: string,
  projectIds: readonly string[],
): SketchAssetFinding[] {
  const defined = new Set(projectIds);
  for (const match of source.matchAll(/define(?:Prop|Figure)\(\s*['"]([^'"]+)['"]/g))
    defined.add(match[1] ?? '');
  const out: SketchAssetFinding[] = [];
  USES.forEach((pattern, index) => {
    for (const match of source.matchAll(pattern)) {
      const id = match[1] ?? '';
      if (defined.has(id) || (index === 2 && itemFamily(id))) continue;
      const line = source.slice(0, match.index).split('\n').length;
      const known = [...defined].join(', ') || 'none';
      out.push({
        line,
        id,
        message: `line ${String(line)}: "${id}" is not defined (project ids: ${known}); add assets/sketchbook/${id}.json or define it in the scene`,
      });
    }
  });
  return out.sort((a, b) => a.line - b.line);
}
