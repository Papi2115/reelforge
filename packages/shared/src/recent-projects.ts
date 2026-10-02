/**
 * `<app data>/recent-projects.json`: the projects the desktop app opened most recently (start
 * screen "Recent"). Written atomically by `packages/project`.
 */
import { z } from 'zod';

export const RECENT_PROJECTS_FILE_VERSION = 1;

export const recentProjectSchema = z.object({
  /** Absolute project folder. */
  dir: z.string().min(1),
  title: z.string().min(1),
  openedAt: z.iso.datetime(),
});
export type RecentProjectRecord = z.infer<typeof recentProjectSchema>;

export const recentProjectsFileSchema = z.object({
  version: z.literal(RECENT_PROJECTS_FILE_VERSION),
  /** Most recent first. */
  projects: z.array(recentProjectSchema).max(50),
});
export type RecentProjectsFile = z.infer<typeof recentProjectsFileSchema>;
