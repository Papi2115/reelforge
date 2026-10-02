/** "Words timed" output: words.raw.json + script -> words.json (validated, written atomically). */
import { alignScript, type AlignmentResult } from './align.js';
import { readJsonFile, writeJsonAtomic, type JsonFileError } from '../schemas/json-file.js';
import {
  WORDS_FILE_VERSION,
  WordsFileSchema,
  WordsRawSchema,
  type WordsFile,
  type WordsRaw,
} from '../schemas/words.js';
import type { Result } from '../result.js';

export function buildWordsFile(
  result: AlignmentResult,
  meta: { readonly lang: string; readonly asrModel: string | null },
): WordsFile {
  return {
    version: WORDS_FILE_VERSION,
    lang: meta.lang,
    asrModel: meta.asrModel,
    words: result.words,
    mismatches: result.mismatches,
    stats: result.stats,
  };
}

/** Aligns the script to an in-memory words.raw.json. */
export function alignRawWords(scriptText: string, raw: WordsRaw): WordsFile {
  const result = alignScript(scriptText, raw.words, { lang: raw.decodedLang, audioS: raw.audioS });
  return buildWordsFile(result, { lang: raw.decodedLang, asrModel: raw.model });
}

export function writeWordsFile(
  filePath: string,
  file: WordsFile,
): Promise<Result<WordsFile, JsonFileError>> {
  return writeJsonAtomic(filePath, WordsFileSchema, file);
}

export function readWordsFile(filePath: string): Promise<Result<WordsFile, JsonFileError>> {
  return readJsonFile(filePath, WordsFileSchema);
}

export function readWordsRawFile(filePath: string): Promise<Result<WordsRaw, JsonFileError>> {
  return readJsonFile(filePath, WordsRawSchema);
}

/** Reads words.raw.json, aligns `scriptText` and writes words.json. */
export async function timeScriptWords(
  scriptText: string,
  rawPath: string,
  outPath: string,
): Promise<Result<WordsFile, JsonFileError>> {
  const raw = await readWordsRawFile(rawPath);
  if (!raw.ok) return raw;
  return writeWordsFile(outPath, alignRawWords(scriptText, raw.value));
}
