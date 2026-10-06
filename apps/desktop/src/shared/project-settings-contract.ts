/**
 * IPC payloads of the per-project settings dialog: options stored in the open project's
 * `project.json` (2.x: look mode, ambient variation, research mode + sources, tension map,
 * dramaturgy, editing, characters and mascot, scenes per minute and faster checks; 3.0: continuity
 * links between shots).
 * Main reads and writes the file (zod-validated, atomic, autocommitted); the renderer only sees
 * the effective values and sends patches. Changes apply to future builds: nothing is marked
 * out of date. Merged into ipc-contract.ts.
 */
import {
  ALLOWLIST_SOURCES,
  beatSyncModeSchema,
  characterModeSchema,
  dramaturgyModeSchema,
  lookModeSchema,
  mascotChoiceSchema,
  repetitionControlModeSchema,
  researchModeSchema,
  shotsPerMinuteSchema,
  tensionMapModeSchema,
} from '@reelforge/shared';
import { z } from 'zod';

/** Sources the `allowlist` research mode may use (no duplicates). */
export const researchSourcesSchema = z
  .array(z.enum(ALLOWLIST_SOURCES))
  .max(ALLOWLIST_SOURCES.length)
  .refine((sources) => new Set(sources).size === sources.length, {
    message: 'a source is listed twice',
  });

/** Effective values (defaults filled in for fields project.json does not have). */
export const projectSettingsSchema = z.object({
  lookMode: lookModeSchema,
  ambientVariation: z.boolean(),
  /** Asset research (PLAN.md#12.10); absent in project.json = `off`. */
  researchMode: researchModeSchema,
  researchSources: researchSourcesSchema,
  /** Tension map (PLAN.md#12.22); absent in project.json = `off`. */
  tensionMap: tensionMapModeSchema,
  /** Dramaturgy (PLAN.md#12.25-12.27); absent in project.json = `off`. */
  patternInterrupts: dramaturgyModeSchema,
  openLoops: dramaturgyModeSchema,
  revealMoments: dramaturgyModeSchema,
  /** Beat sync (PLAN.md#12.21), repetition control (#12.23); absent in project.json = `off`. */
  beatSync: beatSyncModeSchema,
  repetitionControl: repetitionControlModeSchema,
  /** Characters (PLAN.md#12.20); absent in project.json = `classic`. */
  characters: characterModeSchema,
  /** The chosen mascot as stored (absent = `none`); in effect only with `pack`. */
  mascot: mascotChoiceSchema,
  /** Shots per minute (ADR-027); null = no range (absent in project.json). */
  shotsPerMinute: shotsPerMinuteSchema.nullable(),
  /** Faster checks (ADR-027); absent in project.json = off. */
  fasterChecks: z.boolean(),
  /** Continuity links between shots (PLAN.md#13.2); absent in project.json = off. */
  continuityLinks: z.boolean(),
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

/** A change of one or more settings; unknown keys are refused. */
export const projectSettingsPatchSchema = z
  .strictObject({
    lookMode: lookModeSchema.optional(),
    ambientVariation: z.boolean().optional(),
    researchMode: researchModeSchema.optional(),
    researchSources: researchSourcesSchema.optional(),
    tensionMap: tensionMapModeSchema.optional(),
    patternInterrupts: dramaturgyModeSchema.optional(),
    openLoops: dramaturgyModeSchema.optional(),
    revealMoments: dramaturgyModeSchema.optional(),
    beatSync: beatSyncModeSchema.optional(),
    repetitionControl: repetitionControlModeSchema.optional(),
    characters: characterModeSchema.optional(),
    mascot: mascotChoiceSchema.optional(),
    /** null removes the range from project.json. */
    shotsPerMinute: shotsPerMinuteSchema.nullable().optional(),
    fasterChecks: z.boolean().optional(),
    continuityLinks: z.boolean().optional(),
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
