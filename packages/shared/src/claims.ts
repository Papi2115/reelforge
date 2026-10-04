/**
 * `claims.json` (PLAN.md#12.18, ADR-016): the factual claims of the script with the sources pinned
 * to them. Claims are extracted by an on-demand "Check sources" turn (read-only, no web) from
 * `script.txt` and `research.md`; the user attaches URLs, documents or notes and may confirm a
 * claim. Tracked in git like the script. The source `name` is what an on-screen source chip shows
 * (never a URL).
 */
import { z } from 'zod';

export const CLAIMS_FILE = 'claims.json';
export const CLAIMS_FILE_VERSION = 1;

/** What a claim asserts (drives how carefully it must be sourced). */
export const CLAIM_KINDS = ['number', 'date', 'name', 'causal', 'quote'] as const;
export const claimKindSchema = z.enum(CLAIM_KINDS);
export type ClaimKind = z.infer<typeof claimKindSchema>;

/**
 * `sourced` = at least one pinned source supports it; `unsourced` = none (the report lists it);
 * `disputed` = sources disagree or contradict it; `user-confirmed` = the user vouches for it.
 */
export const CLAIM_STATUSES = ['sourced', 'unsourced', 'disputed', 'user-confirmed'] as const;
export const claimStatusSchema = z.enum(CLAIM_STATUSES);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

/** `research` = a link of research.md; the rest are added by the user. */
export const CLAIM_SOURCE_KINDS = ['research', 'url', 'document', 'note'] as const;
export const claimSourceKindSchema = z.enum(CLAIM_SOURCE_KINDS);
export type ClaimSourceKind = z.infer<typeof claimSourceKindSchema>;

export const MAX_CLAIMS = 120;
export const MAX_CLAIM_SOURCES = 200;
export const MAX_SOURCES_PER_CLAIM = 8;
export const SOURCE_NAME_MAX = 60;

/** `r<n>` = research.md link, `u<n>` = added by the user. */
export const claimSourceIdSchema = z
  .string()
  .regex(/^[ru][1-9][0-9]{0,3}$/, 'source id is r<n> (research.md) or u<n> (added by the user)');
export const claimIdSchema = z.string().regex(/^c[1-9][0-9]{0,3}$/, 'claim id is c<n>');

const httpUrl = z
  .string()
  .max(2000)
  .regex(/^https?:\/\/[^\s]+$/, 'an http(s) URL');

export const claimSourceSchema = z.strictObject({
  id: claimSourceIdSchema,
  kind: claimSourceKindSchema,
  /** Short display name ("nasa.gov", "Doom FAQ"): the source chip text. Never a URL. */
  name: z.string().trim().min(1).max(SOURCE_NAME_MAX),
  url: httpUrl.optional(),
  /** A document the user names (file name or project-relative path; never read by the app). */
  document: z.string().trim().min(1).max(260).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  /** The research.md line the link sits on (research sources). */
  excerpt: z.string().max(400).optional(),
});
export type ClaimSource = z.infer<typeof claimSourceSchema>;

export const claimSchema = z.strictObject({
  id: claimIdSchema,
  /** The claim as spoken (copied from the script). */
  text: z.string().trim().min(1).max(400),
  /** 0-based sentence of script.txt (`scriptSentences`). */
  sentence: z.int().min(0),
  /** First and last word index of `text` in script.txt (whitespace words), when found. */
  words: z.tuple([z.int().min(0), z.int().min(0)]).optional(),
  kind: claimKindSchema,
  sourceIds: z.array(claimSourceIdSchema).max(MAX_SOURCES_PER_CLAIM),
  status: claimStatusSchema,
  /** Why it is disputed / what the user checked. */
  note: z.string().trim().min(1).max(500).optional(),
});
export type Claim = z.infer<typeof claimSchema>;

export const claimsFileSchema = z
  .strictObject({
    version: z.literal(CLAIMS_FILE_VERSION),
    /** ISO time of the last "Check sources" turn (absent: claims edited by hand only). */
    checkedAt: z.string().optional(),
    /** `textFingerprint` of script.txt at that check (the UI warns when the script changed). */
    scriptFingerprint: z
      .string()
      .regex(/^[0-9a-f]{8}$/)
      .optional(),
    sources: z.array(claimSourceSchema).max(MAX_CLAIM_SOURCES),
    claims: z.array(claimSchema).max(MAX_CLAIMS),
  })
  .superRefine((file, ctx) => {
    const sourceIds = new Set<string>();
    file.sources.forEach((source, index) => {
      if (sourceIds.has(source.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate source id ${source.id}`,
          path: ['sources', index, 'id'],
        });
      }
      sourceIds.add(source.id);
    });
    const claimIds = new Set<string>();
    file.claims.forEach((claim, index) => {
      if (claimIds.has(claim.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate claim id ${claim.id}`,
          path: ['claims', index, 'id'],
        });
      }
      claimIds.add(claim.id);
      for (const id of claim.sourceIds) {
        if (!sourceIds.has(id)) {
          ctx.addIssue({
            code: 'custom',
            message: `${claim.id}: unknown source ${id}`,
            path: ['claims', index, 'sourceIds'],
          });
        }
      }
      if (claim.status === 'sourced' && claim.sourceIds.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${claim.id}: "sourced" needs a source`,
          path: ['claims', index, 'status'],
        });
      }
      if (claim.status === 'unsourced' && claim.sourceIds.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${claim.id}: "unsourced" with sources`,
          path: ['claims', index, 'status'],
        });
      }
    });
  });
export type ClaimsFile = z.infer<typeof claimsFileSchema>;

/** FNV-1a (32 bit) of a text as 8 hex digits: cheap change detection, not security. */
export function textFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface ScriptSentence {
  readonly text: string;
  /** Index of its first and last whitespace word in the whole script. */
  readonly firstWord: number;
  readonly lastWord: number;
}

/** Sentences of script.txt (split after . ! ? or at blank lines), with their word ranges. */
export function scriptSentences(script: string): ScriptSentence[] {
  const sentences: ScriptSentence[] = [];
  let current: string[] = [];
  let firstWord = 0;
  let wordIndex = 0;
  const flush = (): void => {
    if (current.length > 0) {
      sentences.push({ text: current.join(' '), firstWord, lastWord: wordIndex - 1 });
    }
    current = [];
    firstWord = wordIndex;
  };
  for (const paragraph of script.split(/\n\s*\n/)) {
    for (const word of paragraph.split(/\s+/).filter((token) => token !== '')) {
      current.push(word);
      wordIndex += 1;
      if (/[.!?…]["'”’)\]]*$/.test(word)) flush();
    }
    flush();
  }
  return sentences;
}

/** Lower-case letters/digits only, one space between tokens (for matching quotes). */
export function normalizeClaimText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Word range of `text` inside sentence `sentence` of the script, or undefined. */
export function claimWordRange(
  sentences: readonly ScriptSentence[],
  sentence: number,
  text: string,
): [number, number] | undefined {
  const found = sentences[sentence];
  const wanted = normalizeClaimText(text).split(' ');
  if (found === undefined || wanted[0] === '') return undefined;
  // One entry per token of the sentence, with the index of the word it belongs to.
  const tokens = found.text.split(' ').flatMap((word, index) =>
    normalizeClaimText(word)
      .split(' ')
      .filter((token) => token !== '')
      .map((token) => ({ token, word: found.firstWord + index })),
  );
  for (let start = 0; start + wanted.length <= tokens.length; start += 1) {
    if (wanted.every((token, offset) => tokens[start + offset]?.token === token)) {
      const first = tokens[start]?.word ?? found.firstWord;
      const last = tokens[start + wanted.length - 1]?.word ?? first;
      return [first, last];
    }
  }
  return undefined;
}
