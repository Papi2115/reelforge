/** Validation of a loaded scene module namespace against the scene contract. */
import { treatmentSchema } from '@reelforge/shared';
import { z } from 'zod';
import type { SceneModule } from './contract.js';
import { EngineError } from './errors.js';

const sceneMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  treatment: treatmentSchema.optional(),
});

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

function exportOf(namespace: unknown, name: string): unknown {
  if (typeof namespace !== 'object' || namespace === null) return undefined;
  return (namespace as Record<string, unknown>)[name];
}

/** Checks `export const meta`, `export function build`, `export function update`. */
export function toSceneModule(namespace: unknown, file: string, shotId: string): SceneModule {
  const problems: string[] = [];
  const meta = sceneMetaSchema.safeParse(exportOf(namespace, 'meta'));
  if (!meta.success) {
    const details = meta.error.issues
      .map((issue) => `${issue.path.join('.') || 'meta'}: ${issue.message}`)
      .join('; ');
    problems.push(`"export const meta = { id, title?, treatment? }" is invalid (${details})`);
  }
  const build = exportOf(namespace, 'build');
  if (!isFunction(build)) problems.push('missing "export function build(ctx)"');
  const update = exportOf(namespace, 'update');
  if (!isFunction(update)) problems.push('missing "export function update(t, state, ctx)"');
  if (!meta.success || !isFunction(build) || !isFunction(update)) {
    throw new EngineError('scene-contract', `${file}: ${problems.join('; ')}`, { shotId });
  }
  return { meta: meta.data, build, update };
}
