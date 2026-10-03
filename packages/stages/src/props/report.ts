/**
 * `.reelforge/props-report.json` (schema in @reelforge/shared): every project prop the scene stage
 * built or tried to build (PLAN.md#7.4), sorted by name; serialized read-modify-write, atomic.
 */
import { JsonFileStore, err, ok, type Result } from '@reelforge/claude-bridge';
import {
  PROPS_REPORT_VERSION,
  propsReportSchema,
  type PropBuildRecord,
  type PropsReport,
} from '@reelforge/shared';
import { FILES, inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';

const EPOCH = new Date(0).toISOString();

const reports = new JsonFileStore<PropsReport>(propsReportSchema, () => ({
  version: PROPS_REPORT_VERSION,
  updatedAt: EPOCH,
  props: [],
}));

function reportFile(projectDir: string): string {
  return inProject(projectDir, FILES.propsReport);
}

export async function readPropsReport(
  projectDir: string,
): Promise<Result<PropsReport, StageError>> {
  const read = await reports.read(reportFile(projectDir));
  return read.ok ? read : err(stageError('io', `${FILES.propsReport}: ${read.error.message}`));
}

/** Stores `record` (replacing the one with the same name). */
export async function savePropRecord(
  projectDir: string,
  record: PropBuildRecord,
): Promise<Result<PropsReport, StageError>> {
  const written = await reports.update(reportFile(projectDir), (current) => ({
    version: PROPS_REPORT_VERSION,
    updatedAt: record.updatedAt,
    props: [...current.props.filter((entry) => entry.name !== record.name), record].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
  return written.ok
    ? ok(written.value)
    : err(stageError('io', `${FILES.propsReport}: ${written.error.message}`));
}
