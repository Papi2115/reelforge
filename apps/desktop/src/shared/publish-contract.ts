/**
 * IPC payloads of the publish kit (PLAN.md#12.17) and the Sources panel (PLAN.md#12.18): the four
 * paste-ready texts of the finished film, saving them under `publish/`, and `claims.json` (Check
 * sources, attach a URL/document/note, change a claim's status). Merged into ipc-contract.ts.
 */
import { CLAIM_STATUSES, claimsFileSchema, publishSeoFileSchema } from '@reelforge/shared';
import { z } from 'zod';

/** Same names as the pipeline's `PUBLISH_FILES` (checked in publish-service.test.ts). */
export const PUBLISH_FILE_NAMES = [
  'description.txt',
  'chapters.txt',
  'tags.txt',
  'credits.txt',
] as const;
export const publishFileNameSchema = z.enum(PUBLISH_FILE_NAMES);
export type PublishFileNameView = z.infer<typeof publishFileNameSchema>;

export const publishKitViewSchema = z.object({
  files: z.array(z.object({ name: publishFileNameSchema, text: z.string() })),
  chapterCount: z.int().min(0),
  /** Why YouTube would show no chapters (null: chapters.txt is valid). */
  chapterProblem: z.string().nullable(),
  /** Titles of used assets with an unverified licence. */
  unverified: z.array(z.string()),
  warnings: z.array(z.string()),
  /** Where the description and tags came from: Claude's suggestion, the template, the script. */
  metaSource: z.enum(['claude', 'template', 'none']),
  /** Assets credited (the ones the scenes use). */
  creditedAssets: z.int().min(0),
});
export type PublishKitView = z.infer<typeof publishKitViewSchema>;

export const publishKitResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), kit: publishKitViewSchema }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type PublishKitResult = z.infer<typeof publishKitResultSchema>;

export const publishSaveResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('saved'),
    /** Project-relative paths written. */
    files: z.array(z.string()),
    committed: z.boolean(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type PublishSaveResult = z.infer<typeof publishSaveResultSchema>;

export const publishOpenResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('opened') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type PublishOpenResult = z.infer<typeof publishOpenResultSchema>;

export const claimsStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** null: no claims.json yet (or it could not be read: see `problem`). */
    file: claimsFileSchema.nullable(),
    hasScript: z.boolean(),
    /** The script changed since the last Check sources. */
    scriptChanged: z.boolean(),
    /** A Check sources turn is running. */
    checking: z.boolean(),
    problem: z.string().nullable(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ClaimsState = z.infer<typeof claimsStateSchema>;

export const claimsCheckResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    state: claimsStateSchema,
    /** Claims or source ids of Claude's reply that were dropped. */
    warnings: z.array(z.string()),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ClaimsCheckResult = z.infer<typeof claimsCheckResultSchema>;

const claimId = z.string().regex(/^c[1-9][0-9]{0,3}$/);
const optionalName = z.string().trim().max(60).optional();

export const claimEditRequestSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('attach'),
    claimId,
    source: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('url'),
        url: z.string().trim().min(1).max(2000),
        name: optionalName,
      }),
      z.strictObject({
        kind: z.literal('document'),
        document: z.string().trim().min(1).max(260),
        name: optionalName,
      }),
      z.strictObject({
        kind: z.literal('note'),
        note: z.string().trim().min(1).max(500),
        name: optionalName,
      }),
    ]),
  }),
  z.strictObject({
    op: z.literal('detach'),
    claimId,
    sourceId: z.string().regex(/^[ru][1-9][0-9]{0,3}$/),
  }),
  z.strictObject({ op: z.literal('status'), claimId, status: z.enum(CLAIM_STATUSES) }),
]);
export type ClaimEditRequest = z.infer<typeof claimEditRequestSchema>;

export const claimEditResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), state: claimsStateSchema }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ClaimEditResult = z.infer<typeof claimEditResultSchema>;

/** "Tags and timestamps" (PLAN.md#13.17): `publish/seo.json` of the open project. */
export const publishSeoStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** null: not generated yet (or unreadable: see `problem`). */
    seo: publishSeoFileSchema.nullable(),
    /** Length of the film in seconds (the chapters' end). */
    durationS: z.number().min(0),
    /** A generation is running. */
    generating: z.boolean(),
    problem: z.string().nullable(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type PublishSeoState = z.infer<typeof publishSeoStateSchema>;

export const publishSeoGenerateResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    state: publishSeoStateSchema,
    /** Why the deterministic fallback was written instead of Claude's answer (null: Claude's). */
    fallbackReason: z.string().nullable(),
    warnings: z.array(z.string()),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type PublishSeoGenerateResult = z.infer<typeof publishSeoGenerateResultSchema>;

export const PUBLISH_IPC = {
  publishKit: { name: 'publish:kit', request: z.null(), response: publishKitResultSchema },
  publishSave: { name: 'publish:save', request: z.null(), response: publishSaveResultSchema },
  publishOpenFolder: {
    name: 'publish:open-folder',
    request: z.null(),
    response: publishOpenResultSchema,
  },
  publishSeoState: {
    name: 'publish:seo-state',
    request: z.null(),
    response: publishSeoStateSchema,
  },
  publishSeoGenerate: {
    name: 'publish:seo-generate',
    request: z.null(),
    response: publishSeoGenerateResultSchema,
  },
  claimsState: { name: 'claims:state', request: z.null(), response: claimsStateSchema },
  claimsCheck: { name: 'claims:check', request: z.null(), response: claimsCheckResultSchema },
  claimsEdit: {
    name: 'claims:edit',
    request: claimEditRequestSchema,
    response: claimEditResultSchema,
  },
} as const;

export interface PublishApi {
  getPublishKit(): Promise<PublishKitResult>;
  savePublishKit(): Promise<PublishSaveResult>;
  openPublishFolder(): Promise<PublishOpenResult>;
  getPublishSeo(): Promise<PublishSeoState>;
  generatePublishSeo(): Promise<PublishSeoGenerateResult>;
  getClaimsState(): Promise<ClaimsState>;
  checkSources(): Promise<ClaimsCheckResult>;
  editClaim(request: ClaimEditRequest): Promise<ClaimEditResult>;
}
