/**
 * `.reelforge/roles-report.json` (schema in @reelforge/shared): every project role the scene stage
 * built or tried to build (PLAN.md#12.20), sorted by id; serialized read-modify-write, atomic.
 */
import { JsonFileStore, err, ok, type Result } from '@reelforge/claude-bridge';
import {
  ROLES_REPORT_VERSION,
  rolesReportSchema,
  type RoleBuildRecord,
  type RolesReport,
} from '@reelforge/shared';
import { FILES, inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';

const EPOCH = new Date(0).toISOString();

const reports = new JsonFileStore<RolesReport>(rolesReportSchema, () => ({
  version: ROLES_REPORT_VERSION,
  updatedAt: EPOCH,
  roles: [],
}));

function reportFile(projectDir: string): string {
  return inProject(projectDir, FILES.rolesReport);
}

export async function readRolesReport(
  projectDir: string,
): Promise<Result<RolesReport, StageError>> {
  const read = await reports.read(reportFile(projectDir));
  return read.ok ? read : err(stageError('io', `${FILES.rolesReport}: ${read.error.message}`));
}

/** Stores `record` (replacing the one with the same id). */
export async function saveRoleRecord(
  projectDir: string,
  record: RoleBuildRecord,
): Promise<Result<RolesReport, StageError>> {
  const written = await reports.update(reportFile(projectDir), (current) => ({
    version: ROLES_REPORT_VERSION,
    updatedAt: record.updatedAt,
    roles: [...current.roles.filter((entry) => entry.id !== record.id), record].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  }));
  return written.ok
    ? ok(written.value)
    : err(stageError('io', `${FILES.rolesReport}: ${written.error.message}`));
}
