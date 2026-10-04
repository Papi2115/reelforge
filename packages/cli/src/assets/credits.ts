/**
 * The "Credits" section for the video description (PLAN.md#12.9; reused by the publish kit,
 * 12.17): title, author, licence and link of every asset the film uses. Assets with an unverified
 * licence are marked and summarised in a warning line.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import type { AssetRecord } from '@reelforge/shared';
import { PROJECT_PATHS, projectPath } from '../project/paths.js';
import { cleanAuthor, sanitizeText, sanitizeUrl, TEXT_LIMITS } from './untrusted.js';

function creditLine(record: AssetRecord): string {
  const title = sanitizeText(record.title, TEXT_LIMITS.title) || record.id;
  const author = cleanAuthor(record.author);
  const licenceUrl = record.licence.url === null ? null : sanitizeUrl(record.licence.url);
  const licence = record.licence.verified
    ? `${sanitizeText(record.licence.id, TEXT_LIMITS.licence)}${licenceUrl === null ? '' : ` (${licenceUrl})`}`
    : 'licence UNVERIFIED';
  const link = sanitizeUrl(record.sourceUrl) ?? sanitizeUrl(record.downloadUrl) ?? '';
  const marker = record.licence.verified ? '' : ' [check licence]';
  return `- "${title.replaceAll('"', '”')}" by ${author}, ${licence}${link === '' ? '' : `, ${link}`}${marker}`;
}

/**
 * Markdown credits of `all` (in catalogue order). The user's own files (source `own`,
 * PLAN.md#12.12) are never listed: they need no credit.
 */
export function creditsMarkdown(all: readonly AssetRecord[]): string {
  const records = all.filter((record) => record.source !== 'own');
  if (records.length === 0) return 'Credits\n\n(no external assets used)\n';
  const unverified = records.filter((record) => !record.licence.verified).length;
  const lines = ['Credits', '', ...records.map(creditLine)];
  if (unverified > 0) {
    lines.push(
      '',
      `WARNING: ${String(unverified)} asset${unverified === 1 ? ' has' : 's have'} an unverified licence ([check licence]); confirm the licence or replace ${unverified === 1 ? 'it' : 'them'} before publishing.`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Asset ids referenced by any scene module or by storyboard.json. */
export async function usedAssetIds(root: string, ids: readonly string[]): Promise<Set<string>> {
  const texts: string[] = [];
  const scenes = projectPath(root, PROJECT_PATHS.scenes);
  if (existsSync(scenes)) {
    for (const name of await readdir(scenes)) {
      if (name.endsWith('.js'))
        texts.push(await readFile(projectPath(root, `${PROJECT_PATHS.scenes}/${name}`), 'utf8'));
    }
  }
  const storyboard = projectPath(root, PROJECT_PATHS.storyboard);
  if (existsSync(storyboard)) texts.push(await readFile(storyboard, 'utf8'));
  const all = texts.join('\n');
  return new Set(ids.filter((id) => new RegExp(`(?<![a-z0-9-])${id}(?![a-z0-9-])`).test(all)));
}
