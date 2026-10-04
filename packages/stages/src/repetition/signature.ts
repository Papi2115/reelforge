/**
 * What a shot looks like, for repetition control (PLAN.md#12.23, pure): the kit definitions its
 * scene calls (a cheap static scan of `kit.<namespace>.<name>(` calls in the scene source — scene
 * QA records no template signature) and the visual signature look + treatment + definitions.
 * Definitions every scene calls (lights, sky, plain rooms) do not count; chart / UI / map
 * templates are what the "same template N times a minute" rule looks at.
 */
import { shotLook, type StoryboardShot } from '@reelforge/shared';

const KIT_CALL = /\bkit\s*\.\s*([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
/** Background definitions nearly every scene calls: they say nothing about what a shot shows. */
const COMMON_DEFINITIONS: ReadonlySet<string> = new Set([
  'env.lights',
  'env.sky',
  'env.ground',
  'env.backdrop',
  'fx.glow',
  'fx.particles',
]);
/** Definitions that are a template: charts, maps, counters, timelines, retro UI, documents. */
const TEMPLATE_NAME =
  /chart|graph|map|counter|odometer|timeline|window|terminal|browser|document|newspaper|dossier|crt|sheet|table|diagram|node/i;

/** `kit.<ns>.<name>` definitions a scene source calls, sorted, each once (common ones dropped). */
export function kitDefinitions(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(KIT_CALL)) {
    const name = `${match[1] ?? ''}.${match[2] ?? ''}`;
    if (!COMMON_DEFINITIONS.has(name)) found.add(name);
  }
  return [...found].sort();
}

export function isTemplateDefinition(definition: string): boolean {
  return TEMPLATE_NAME.test(definition.split('.').at(-1) ?? '');
}

export interface ShotVisual {
  readonly shot: StoryboardShot;
  /** Scanned definitions; undefined when the scene source is unknown or a placeholder. */
  readonly definitions: readonly string[] | undefined;
}

/** "look · treatment · defs" (undefined without definitions: too little to call a repeat). */
export function visualSignature(visual: ShotVisual): string | undefined {
  const definitions = visual.definitions;
  if (definitions === undefined || definitions.length === 0) return undefined;
  return `${shotLook(visual.shot)} · ${visual.shot.treatment} · ${definitions.join(', ')}`;
}
