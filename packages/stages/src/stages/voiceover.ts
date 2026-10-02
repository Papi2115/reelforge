/**
 * Voiceover import (PLAN.md#7.2): a recording (wav/mp3/m4a/ogg/flac) is copied to
 * `audio/vo.original.<ext>` with its sha256 in `.reelforge/voiceover.json`. Replacing it archives
 * the previous one as `audio/vo.original.prev.<ext>` (optional) and the runner marks everything
 * downstream stale. Importing the same file again changes nothing. Writes the VO <-> script
 * discrepancy report.
 */
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  VOICEOVER_EXTENSIONS,
  VOICEOVER_RECORD_VERSION,
  voiceoverExtensionSchema,
  voiceoverRecordSchema,
  type VoiceoverExtension,
  type VoiceoverRecord,
} from '@reelforge/shared';
import { readProjectText, sha256File, writeProjectJson } from '../files.js';
import { FILES, inProject, voiceoverOriginal, voiceoverPrevious } from '../paths.js';
import { loadJson } from '../snapshot.js';
import {
  stageError,
  type RequestOf,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';
import { formatDuration } from './script.js';
import { buildVoReport, writeVoReport } from './vo-report.js';

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function io<T>(what: string, action: () => Promise<T>): Promise<Result<T, StageError>> {
  try {
    return ok(await action());
  } catch (error) {
    return err(stageError('io', `${what}: ${describe(error)}`));
  }
}

async function checkSource(source: string): Promise<Result<VoiceoverExtension, StageError>> {
  const extension = voiceoverExtensionSchema.safeParse(path.extname(source).slice(1).toLowerCase());
  if (!extension.success) {
    return err(
      stageError(
        'invalid-input',
        `unsupported voice-over format "${path.extname(source)}" (use ${VOICEOVER_EXTENSIONS.join(', ')})`,
      ),
    );
  }
  const isFile = await stat(source).then(
    (info) => info.isFile(),
    () => false,
  );
  return isFile
    ? ok(extension.data)
    : err(stageError('invalid-input', `voice-over file not found: ${source}`));
}

/** Removes or archives the current recording; returns the archived one. */
async function retireCurrent(
  ctx: StageContext,
  archive: boolean,
  record: VoiceoverRecord | undefined,
): Promise<Result<VoiceoverRecord['previous'], StageError>> {
  const current = ctx.snapshot.voiceover;
  if (current === undefined) return ok(null);
  const currentPath = inProject(ctx.projectDir, current.file);
  if (!archive) {
    const removed = await io(`cannot remove ${current.file}`, () =>
      rm(currentPath, { force: true }),
    );
    return removed.ok ? ok(null) : removed;
  }
  for (const extension of VOICEOVER_EXTENSIONS) {
    const old = inProject(ctx.projectDir, voiceoverPrevious(extension));
    const removed = await io('cannot remove the older archive', () => rm(old, { force: true }));
    if (!removed.ok) return removed;
  }
  const previous = voiceoverPrevious(current.extension);
  const moved = await io(`cannot archive ${current.file}`, () =>
    rename(currentPath, inProject(ctx.projectDir, previous)),
  );
  if (!moved.ok) return moved;
  const hash =
    record?.file === current.file
      ? ok(record.sha256)
      : await sha256File(inProject(ctx.projectDir, previous));
  return hash.ok ? ok({ file: previous, sha256: hash.value }) : hash;
}

async function copyIn(source: string, target: string): Promise<Result<void, StageError>> {
  const tmp = `${target}.${randomUUID()}.tmp`;
  return io('cannot copy the voice-over into the project', async () => {
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await copyFile(source, tmp);
      await rename(tmp, target);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
  });
}

async function run(
  ctx: StageContext,
  request: RequestOf<'voiceover'>,
): Promise<Result<StageSummary, StageError>> {
  const source = path.resolve(request.source);
  const extension = await checkSource(source);
  if (!extension.ok) return extension;
  ctx.step('Hashing the recording', 10);
  const hash = await sha256File(source);
  if (!hash.ok) return hash;
  const stored = await loadJson(
    inProject(ctx.projectDir, FILES.voiceoverRecord),
    voiceoverRecordSchema,
  );
  const record = stored.status === 'ok' ? stored.value : undefined;
  const target = voiceoverOriginal(extension.value);
  if (
    ctx.snapshot.voiceover?.file === target &&
    record?.file === target &&
    record.sha256 === hash.value
  ) {
    return ok({
      message: 'the same recording is already imported',
      outputs: [],
      changed: false,
      warnings: [],
      metrics: { durationS: record.durationS },
    });
  }
  ctx.step('Copying into the project', 30);
  const previous = await retireCurrent(
    ctx,
    request.archivePrevious ?? ctx.settings.archivePreviousVoiceover,
    record,
  );
  if (!previous.ok) return previous;
  const copied = await copyIn(source, inProject(ctx.projectDir, target));
  if (!copied.ok) return copied;

  ctx.step('Measuring', 70);
  const warnings: string[] = [];
  let durationS: number | null = null;
  if (ctx.audio === undefined)
    warnings.push('ffmpeg is not configured: the recording length is unknown');
  else {
    const measured = await ctx.audio.durationS(inProject(ctx.projectDir, target), ctx.signal);
    if (measured.ok) durationS = measured.value;
    else if (measured.error.kind === 'cancelled') return err(stageError('cancelled', 'cancelled'));
    else warnings.push(`cannot measure the recording: ${measured.error.message}`);
  }
  const written = await writeProjectJson(
    ctx.projectDir,
    FILES.voiceoverRecord,
    voiceoverRecordSchema,
    {
      version: VOICEOVER_RECORD_VERSION,
      file: target,
      sha256: hash.value,
      sourceName: path.basename(source),
      importedAt: ctx.now().toISOString(),
      durationS,
      previous: previous.value,
    },
  );
  if (!written.ok) return written;
  const script = await readProjectText(ctx.projectDir, FILES.script);
  const report = await writeVoReport(
    ctx.projectDir,
    buildVoReport(durationS, script.ok ? script.value : undefined),
  );
  if (!report.ok) return report;
  const { verdict } = report.value;
  if (verdict === 'too-short' || verdict === 'too-long') warnings.push(...report.value.messages);
  const length = durationS === null ? '' : ` (${formatDuration(durationS)})`;
  return ok({
    message: `${ctx.snapshot.voiceover === undefined ? 'imported' : 'replaced with'} ${path.basename(source)}${length}`,
    outputs: [target],
    changed: true,
    warnings,
    metrics: {
      durationS,
      scriptWords: report.value.scriptWords,
      wordsPerMinute: report.value.wordsPerMinute,
      verdict: report.value.verdict,
    },
  });
}

export const voiceoverStage: StageDefinition<'voiceover'> = {
  id: 'voiceover',
  inputs: ['<recording: wav, mp3, m4a, ogg, flac>'],
  outputs: ['audio/vo.original.<ext>', FILES.voiceoverRecord],
  run,
};
