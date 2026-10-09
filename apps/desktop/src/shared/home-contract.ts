/**
 * IPC payloads of the Home screen (PLAN.md#13.16): the project cards (one summary per known
 * project: the recent list plus the production line's films), opening one of them, showing its
 * folder and renaming it. Main only acts on folders of that list (never on a path the renderer
 * makes up). Merged into ipc-contract.ts.
 */
import { z } from 'zod';
import { projectOpenResultSchema, type ProjectOpenResult } from './project-contract.js';

/** The eight steps of a card's progress strip, in film order. */
export const HOME_STEPS = [
  'script',
  'voice',
  'clean',
  'words',
  'storyboard',
  'scenes',
  'sound',
  'export',
] as const;
export const homeStepSchema = z.enum(HOME_STEPS);
export type HomeStep = z.infer<typeof homeStepSchema>;

/**
 * One step of a card: `todo` (not started), `done`, `busy` (running or paused), `needs-you` (a
 * decision or input of the user, or out of date) and `problem` (the last run failed).
 */
export const HOME_STEP_STATES = ['todo', 'done', 'busy', 'needs-you', 'problem'] as const;
export const homeStepStateSchema = z.enum(HOME_STEP_STATES);
export type HomeStepState = z.infer<typeof homeStepStateSchema>;

export const homeStepStatusSchema = z.object({
  step: homeStepSchema,
  state: homeStepStateSchema,
});
export type HomeStepStatus = z.infer<typeof homeStepStatusSchema>;

/** A Short's own settings (project.json#short) as Home shows them (PLAN.md#13.18). */
export const homeShortSchema = z.object({
  lengthS: z.number().positive(),
  captions: z.boolean(),
  endCardText: z.string(),
});
export type HomeShort = z.infer<typeof homeShortSchema>;

export const homeProjectSchema = z.object({
  /** Absolute folder (the key of every Home request). */
  dir: z.string().min(1),
  title: z.string(),
  /** False when the folder (or its project.json) is gone. */
  exists: z.boolean(),
  /** Why project.json could not be read; null when it was. */
  problem: z.string().nullable(),
  /** project.json#channelId; null = the default channel. */
  channelId: z.string().nullable(),
  style: z.string().nullable(),
  genrePreset: z.string().nullable(),
  /** `short` = a Short cut from a film (project.json#kind); everything else is a film. */
  kind: z.enum(['film', 'short']),
  /** A Short's film (its folder, resolved); null when unknown. */
  parentDir: z.string().nullable(),
  /** A Short's film title (project.json#parentProject); null for a film or when unknown. */
  parentTitle: z.string().nullable(),
  /** A Short's settings; null for a film. */
  short: homeShortSchema.nullable(),
  /** script.txt exists (Shorts are written from the film's script). */
  hasScript: z.boolean(),
  steps: z.array(homeStepStatusSchema).length(HOME_STEPS.length),
  /** Length of the film in seconds (storyboard, else the timed words); null = not known yet. */
  durationS: z.number().nonnegative().nullable(),
  /** Last change of the project's files (ISO); null when unknown. */
  updatedAt: z.string().nullable(),
  /** Last time it was opened in the app (ISO); null = never (e.g. a production line film). */
  openedAt: z.string().nullable(),
  /** A small picture for the card (data URL): the uploaded thumbnail, else the export's. */
  thumbnail: z.string().nullable(),
  /** Made by the production line. */
  fromLine: z.boolean(),
});
export type HomeProject = z.infer<typeof homeProjectSchema>;

export const homeDirRequestSchema = z.strictObject({ dir: z.string().min(1).max(4096) });

export const homeRenameRequestSchema = z.strictObject({
  dir: z.string().min(1).max(4096),
  title: z.string().trim().min(1).max(200),
});

export const homeActionResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type HomeActionResult = z.infer<typeof homeActionResultSchema>;

export const HOME_IPC = {
  /** Every known project as a card (cached in main by the files' modification times). */
  homeProjects: {
    name: 'home:projects',
    request: z.null(),
    response: z.array(homeProjectSchema),
  },
  /** Opens a project of the list (refused for any other folder). */
  homeOpen: {
    name: 'home:open',
    request: homeDirRequestSchema,
    response: projectOpenResultSchema,
  },
  /** Shows the project's folder in the system's file browser. */
  homeShowFolder: {
    name: 'home:show-folder',
    request: homeDirRequestSchema,
    response: homeActionResultSchema,
  },
  /** Changes the project's title (project.json, committed); the folder keeps its name. */
  homeRename: {
    name: 'home:rename',
    request: homeRenameRequestSchema,
    response: homeActionResultSchema,
  },
} as const;

export interface HomeApi {
  getHomeProjects(): Promise<HomeProject[]>;
  openHomeProject(dir: string): Promise<ProjectOpenResult>;
  showProjectFolder(dir: string): Promise<HomeActionResult>;
  renameProject(dir: string, title: string): Promise<HomeActionResult>;
}
