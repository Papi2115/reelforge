/**
 * What a voice job reads from the project (PLAN.md#13.14): its channel (project.json#channelId,
 * absent or unknown = the default channel), the script text and its approval, the imported
 * voice-over record, the takes manifest, the generated words and the storyboard shots (for the
 * retake impact). Read-only; every file goes through its zod schema.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import {
  VOICE_FILES,
  WordsFileSchema,
  readTakesManifest,
  type ShotSpan,
  type WordsFile,
} from '@reelforge/pipeline';
import { loadChannels } from '@reelforge/project';
import {
  channelForProject,
  storyboardFileSchema,
  voiceoverRecordSchema,
  type Channel,
  type VoiceTakesFile,
  type VoiceoverRecord,
} from '@reelforge/shared';
import { FILES, inProject, loadJson, readProjectSnapshot } from '@reelforge/stages';

export interface VoiceProject {
  readonly dir: string;
  /** The project's channel; null with the reason when channels cannot be read. */
  readonly channel: Channel | null;
  readonly channelProblem: string | null;
  /** script.txt as on disk; null when there is none. */
  readonly scriptText: string | null;
  readonly approved: boolean;
  readonly record: VoiceoverRecord | null;
  readonly manifest: VoiceTakesFile | null;
  readonly manifestProblem: string | null;
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function readScript(dir: string): Promise<string | null> {
  try {
    return await readFile(inProject(dir, FILES.script), 'utf8');
  } catch {
    // No script yet (or unreadable): the panel says "approve the script first".
    return null;
  }
}

export async function readVoiceProject(
  dir: string,
  channelsFile: string,
  store: PipelineStateStore,
): Promise<VoiceProject> {
  const [snapshot, channels, scriptText, record, manifest] = await Promise.all([
    readProjectSnapshot(dir, store),
    loadChannels(channelsFile),
    readScript(dir),
    loadJson(inProject(dir, FILES.voiceoverRecord), voiceoverRecordSchema),
    readTakesManifest(dir),
  ]);
  const channelId = snapshot.project.status === 'ok' ? snapshot.project.value.channelId : undefined;
  return {
    dir,
    channel: channels.ok ? channelForProject(channels.value, { channelId }).channel : null,
    channelProblem: channels.ok ? null : channels.error.message,
    scriptText,
    approved: snapshot.stages['script']?.approvedAt !== undefined,
    record: record.status === 'ok' ? record.value : null,
    manifest: manifest.ok ? manifest.value : null,
    manifestProblem: manifest.ok ? null : manifest.error.message,
  };
}

/** The voice-over in use is the one Generate (or a retake) assembled last. */
export function usesGeneratedVoice(project: VoiceProject): boolean {
  const output = project.manifest?.output ?? null;
  return output !== null && project.record?.sha256 === output.sha256;
}

/** A generated voice exists, but the script is no longer the one it was made from. */
export function scriptChangedSince(project: VoiceProject): boolean {
  const manifest = project.manifest;
  if (manifest?.output === null || manifest === null || project.scriptText === null) return false;
  return manifest.scriptSha256 !== sha256Text(project.scriptText);
}

/** Shots of storyboard.json with their (old) times; empty without a storyboard. */
export async function storyboardShots(dir: string): Promise<ShotSpan[]> {
  const storyboard = await loadJson(inProject(dir, FILES.storyboard), storyboardFileSchema);
  if (storyboard.status !== 'ok') return [];
  return storyboard.value.shots.map((shot) => ({ id: shot.id, t0: shot.t0, t1: shot.t1 }));
}

/** timing/words.elevenlabs.json (the API's word times), null when absent or invalid. */
export async function apiWords(dir: string): Promise<WordsFile | null> {
  const words = await loadJson(inProject(dir, VOICE_FILES.apiWords), WordsFileSchema);
  return words.status === 'ok' ? words.value : null;
}
