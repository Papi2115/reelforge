/**
 * IPC payloads of the per-project settings dialog: options stored in the open project's
 * `project.json` (2.x: look mode, ambient variation; later research mode, tension curve, taste).
 * Main reads and writes the file (zod-validated, atomic, autocommitted); the renderer only sees
 * the effective values and sends patches. Changes apply to future builds: nothing is marked
 * out of date. Merged into ipc-contract.ts.
 */
import { lookModeSchema } from '@reelforge/shared';
import { z } from 'zod';

/** Effective values (defaults filled in for fields project.json does not have). */
export const projectSettingsSchema = z.object({
  lookMode: lookModeSchema,
  ambientVariation: z.boolean(),
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

/** A change of one or more settings; unknown keys are refused. */
export const projectSettingsPatchSchema = z
  .strictObject({
    lookMode: lookModeSchema.optional(),
    ambientVariation: z.boolean().optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'the patch changes nothing',
  });
export type ProjectSettingsPatch = z.infer<typeof projectSettingsPatchSchema>;

/** An available look of the kit registry, as the dialog lists it. */
export const lookSummarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
});
export type LookSummary = z.infer<typeof lookSummarySchema>;

export const projectSettingsStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    settings: projectSettingsSchema,
    /** Available looks, voxel first. */
    looks: z.array(lookSummarySchema),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ProjectSettingsState = z.infer<typeof projectSettingsStateSchema>;

export const projectSettingsUpdateResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    settings: projectSettingsSchema,
    /** False when nothing changed on disk or the commit failed (the file is saved either way). */
    committed: z.boolean(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ProjectSettingsUpdateResult = z.infer<typeof projectSettingsUpdateResultSchema>;

export const PROJECT_SETTINGS_IPC = {
  projectSettingsGet: {
    name: 'project-settings:get',
    request: z.null(),
    response: projectSettingsStateSchema,
  },
  projectSettingsUpdate: {
    name: 'project-settings:update',
    request: projectSettingsPatchSchema,
    response: projectSettingsUpdateResultSchema,
  },
} as const;

export interface ProjectSettingsApi {
  getProjectSettings(): Promise<ProjectSettingsState>;
  updateProjectSettings(patch: ProjectSettingsPatch): Promise<ProjectSettingsUpdateResult>;
}
