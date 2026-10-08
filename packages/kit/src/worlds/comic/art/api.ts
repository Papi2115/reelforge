/**
 * `page.art` (PLAN.md#13.15a): the open vocabulary of the comic world. Generators draw what the
 * film's narration needs in the comic grammar (`art.person(g, { x, y, pose, ... })`, `art.tree`,
 * `art.animal`, `art.backdrop`, ... see GENERATORS), the shape DSL and sprites draw new things
 * from plain JSON, and `defineProp/defineCharacter/defineBackdrop` + `draw` name the film's own
 * things once for every panel (`load` takes a project asset file). Plus the page helpers
 * `page.layout(beats)` (a preset chosen by beats, panels never empty) and `page.audit()`.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { parse, type ApiContext, type PanelHandle } from '../page/api.js';
import type { LayoutName } from '../page/layouts.js';
import type { ComicPen } from '../page/pen.js';
import { loadComicAssets } from './assets.js';
import { auditSchema, emptyPanels } from './audit.js';
import { parseArt, placeShape } from './common.js';
import { backdropSchema, BACKDROPS, drawBackdrop } from './gen-backdrop.js';
import { GENERATOR_NAMES, GENERATORS, type GeneratorName } from './generators.js';
import { createLayout, suggestLayout } from './layout.js';
import { ArtRegistry, type AssetKind } from './registry.js';
import { drawParts, shapePartSchema, shapePartsSchema } from './shape-dsl.js';
import { Sketch } from './sketch.js';
import { drawSprite, spriteSchema } from './sprite.js';

type Options = Readonly<Record<string, unknown>>;
type GeneratorCalls = Record<GeneratorName, (g: ComicPen, options?: Options) => void>;

const dslPlaceSchema = z.strictObject({
  x: placeShape.x.default(0),
  y: placeShape.y.default(0),
  scale: z.number().positive().max(40).default(1),
  flip: placeShape.flip,
  key: z.string().max(40).default('shape'),
});

function isZeroSized(options: unknown): boolean {
  return typeof options === 'object' && options !== null && 'size' in options && options.size === 0;
}

function isBackdropPreset(name: string): name is (typeof BACKDROPS)[number] {
  return (BACKDROPS as readonly string[]).includes(name);
}

function createArtApi(registry: ArtRegistry) {
  const calls = Object.fromEntries(
    GENERATOR_NAMES.map((name) => {
      const generator = GENERATORS[name];
      const call = (g: ComicPen, options?: Options) => {
        const parsed = parseArt(generator.schema, options, `page.art.${name}`);
        // Something grown from nothing (size animated from 0) draws nothing at size 0.
        if (isZeroSized(parsed)) return;
        generator.draw(g, parsed);
      };
      return [name, call];
    }),
  ) as GeneratorCalls;
  const sketchAt = (g: ComicPen, place: unknown, where: string) => {
    const p = parseArt(dslPlaceSchema, place, where);
    return new Sketch(g, {
      x: p.x,
      y: p.y,
      k: p.scale,
      flip: p.flip,
      angle: 0,
      key: `art:${p.key}`,
    });
  };
  const define = (kind: AssetKind) => (id: string, spec: unknown) => {
    registry.define(kind, id, spec);
  };
  return {
    ...calls,
    /** Shape DSL part(s) at { x, y, scale, flip } (model units). */
    shape(g: ComicPen, parts: unknown, place?: unknown): void {
      const list = parseArt(
        Array.isArray(parts) ? shapePartsSchema : shapePartSchema.transform((part) => [part]),
        parts,
        'page.art.shape',
      );
      drawParts(sketchAt(g, place, 'page.art.shape place'), list, registry.resolver());
    },
    /** ASCII spot art: { rows, legend, px, outline, anchor } at { x, y, scale, flip }. */
    sprite(g: ComicPen, spec: unknown, place?: unknown): void {
      drawSprite(
        sketchAt(g, place, 'page.art.sprite place'),
        parseArt(spriteSchema, spec, 'page.art.sprite'),
      );
    },
    defineProp: define('prop'),
    defineCharacter: define('character'),
    defineBackdrop: define('backdrop'),
    /** A defined thing: { x, y, size, flip } (gen presets: any of their knobs, e.g. pose). */
    draw(g: ComicPen, id: string, options?: Options): void {
      registry.draw(g, id, options);
    },
    /** A project asset file (assets/comic/*.json, version 1); returns the ids it defined. */
    load(assets: unknown, file?: string): readonly string[] {
      return loadComicAssets(registry, assets, file);
    },
    ids(): string[] {
      return registry.ids;
    },
    suggestLayout,
  };
}

/** Prepares a beat's establishing backdrop for its panel box (validated now, at build time). */
function backdropPainter(ctx: ApiContext, registry: ArtRegistry) {
  return (backdrop: string | Options, rest: readonly [number, number, number, number]) => {
    // Overscan: a panel camera or entrance never uncovers bare paper inside the panel.
    const [rx, ry, rw, rh] = rest;
    const m = Math.max(24, Math.max(rw, rh) * 0.12);
    const box = [rx - m, ry - m, rw + m * 2, rh + m * 2] as const;
    if (typeof backdrop === 'string' && registry.kindOf(backdrop) !== undefined) {
      return (g: ComicPen) => {
        registry.drawInBox(g, backdrop, box);
      };
    }
    if (typeof backdrop === 'string' && !isBackdropPreset(backdrop)) {
      throw new KitError(
        'invalid-params',
        `page.layout: backdrop '${backdrop}' is neither a defined id (define it before layout) nor a preset (${BACKDROPS.join(', ')})`,
      );
    }
    const options = typeof backdrop === 'string' ? { preset: backdrop } : backdrop;
    const parsed = parseArt(
      backdropSchema,
      { box: [...box], seed: ctx.seed, ...options },
      'page.layout backdrop',
    );
    return (g: ComicPen) => {
      drawBackdrop(g, parsed);
    };
  };
}

type PanelsFn = (
  layout: LayoutName,
  options: { weights: number[]; mirror: boolean; gutter?: number; seed?: number },
) => PanelHandle[];

/** `page.art`, `page.layout(beats, options)` and `page.audit(options)` of one page. */
export function createArt(ctx: ApiContext, panels: PanelsFn) {
  const registry = new ArtRegistry('page.art');
  return {
    art: createArtApi(registry),
    layout: createLayout(ctx, panels, backdropPainter(ctx, registry)),
    /** Panels that show (almost) nothing for longer than 0.6 s: { emptyPanels: [{ panel, from, to }] }. */
    audit(options: unknown) {
      return {
        emptyPanels: emptyPanels(ctx.model, parse(auditSchema, options, `${ctx.call}.audit`)),
      };
    },
  };
}
