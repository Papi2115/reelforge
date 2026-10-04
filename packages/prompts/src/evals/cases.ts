/**
 * Eval cases (`packages/prompts/evals/cases/<id>/`): `case.json` (stage parameters + canned
 * fake-claude replies) and `project/`, a complete golden project. Each stage runs in a copy of
 * `project/` without that stage's outputs; fake-claude "writes" the golden outputs back.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  briefFileSchema,
  projectFileSchema,
  wordsFileSchema,
  type BriefFile,
  type ProjectFile,
  type WordsFile,
} from '@reelforge/shared';
import { z } from 'zod';
import { PROMPT_IDS } from '../catalog.js';
import { storyboardOutputSchema, type StoryboardOutput } from '../validators/storyboard.js';

/** Works from `src/evals` and `dist/evals`. */
export const EVAL_CASES_DIR = path.join(import.meta.dirname, '..', '..', 'evals', 'cases');

const shotIdList = z.array(z.string().min(1)).min(1);

export const evalCaseFileSchema = z.strictObject({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  summary: z.string().min(1),
  sceneBuild: z.strictObject({
    shotId: z.string().min(1),
    /** Props the canned/real reply should name on its `MISSING:` line (fake runs check it). */
    expectMissing: z.array(z.string().min(1)),
  }),
  sceneFix: z.strictObject({
    shotIds: shotIdList,
    scope: z.enum(['Selection', 'Shot', 'Whole video']),
    request: z.string().min(1),
    selection: z.string().min(1).optional(),
    critic: z.string().min(1).optional(),
  }),
  critic: z.strictObject({
    shotId: z.string().min(1),
    imagePaths: z.array(z.string().min(1)).min(1),
  }),
  /** The project prop the prop-build eval asks for (golden module: kit-ext/props/<name>.js). */
  propBuild: z.strictObject({
    name: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    description: z.string().min(1),
    shotIds: shotIdList,
  }),
  /** The project role the roles eval asks for (golden spec: characters/roles/<id>.json). */
  roleBuild: z.strictObject({
    id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    label: z.string().min(1),
    description: z.string().min(1),
    shotIds: shotIdList,
  }),
  /** chapters.txt the youtube-meta eval passes (the description must contain it). */
  youtubeMeta: z.strictObject({ chapters: z.string().min(1) }).optional(),
  /** Final reply of each stage in fake runs (objects are sent as JSON). */
  replies: z.record(
    z.enum(PROMPT_IDS),
    z.union([z.string().min(1), z.record(z.string(), z.unknown())]),
  ),
});
export type EvalCaseFile = z.infer<typeof evalCaseFileSchema>;

export interface EvalCase {
  readonly file: EvalCaseFile;
  /** Golden project folder (copied per stage). */
  readonly projectDir: string;
  readonly brief: BriefFile;
  readonly project: ProjectFile;
  readonly words: WordsFile;
  readonly storyboard: StoryboardOutput;
}

export class EvalCaseError extends Error {
  override readonly name = 'EvalCaseError';
}

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(JSON.parse(readFileSync(file, 'utf8')) as unknown);
  if (!parsed.success) throw new EvalCaseError(`${file}: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

export function listEvalCases(casesDir: string = EVAL_CASES_DIR): string[] {
  return readdirSync(casesDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(path.join(casesDir, entry.name, 'case.json')),
    )
    .map((entry) => entry.name)
    .sort();
}

/** Loads and validates a case; a broken fixture is a test bug, so it throws. */
export function loadEvalCase(id: string, casesDir: string = EVAL_CASES_DIR): EvalCase {
  const caseDir = path.join(casesDir, id);
  const projectDir = path.join(caseDir, 'project');
  const file = readJson(path.join(caseDir, 'case.json'), evalCaseFileSchema);
  if (file.id !== id) throw new EvalCaseError(`${caseDir}: case.json id is "${file.id}"`);
  return {
    file,
    projectDir,
    brief: readJson(path.join(projectDir, 'brief.json'), briefFileSchema),
    project: readJson(path.join(projectDir, 'project.json'), projectFileSchema),
    words: readJson(path.join(projectDir, 'timing', 'words.json'), wordsFileSchema),
    storyboard: readJson(path.join(projectDir, 'storyboard.json'), storyboardOutputSchema),
  };
}
