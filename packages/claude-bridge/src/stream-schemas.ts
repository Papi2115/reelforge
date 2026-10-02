/**
 * Raw zod shapes of `claude -p --output-format stream-json --verbose` lines (CLI 2.1.287,
 * docs/spikes/01-claude-cli.md §2). Loose objects: unknown fields pass through untouched.
 */
import { z } from 'zod';

export const usageSchema = z.looseObject({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
});

export const initSchema = z.looseObject({
  subtype: z.literal('init'),
  session_id: z.string().min(1),
  model: z.string(),
  cwd: z.string(),
  tools: z.array(z.string()).optional(),
  apiKeySource: z.string().optional(),
  claude_code_version: z.string().optional(),
  permissionMode: z.string().optional(),
});

export const thinkingTokensSchema = z.looseObject({
  subtype: z.literal('thinking_tokens'),
  estimated_tokens: z.number(),
});

export const permissionDeniedSchema = z.looseObject({
  subtype: z.literal('permission_denied'),
  tool_name: z.string(),
  tool_use_id: z.string(),
  message: z.string().optional(),
});

export const assistantSchema = z.looseObject({
  message: z.looseObject({
    id: z.string(),
    model: z.string().optional(),
    content: z.array(z.unknown()),
  }),
  parent_tool_use_id: z.string().nullable().optional(),
  error: z.string().optional(),
});

export const textBlockSchema = z.looseObject({ type: z.literal('text'), text: z.string() });
export const thinkingBlockSchema = z.looseObject({ type: z.literal('thinking') });
export const toolUseBlockSchema = z.looseObject({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

export const userSchema = z.looseObject({
  message: z.looseObject({ content: z.union([z.string(), z.array(z.unknown())]) }),
});

export const toolResultBlockSchema = z.looseObject({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]).optional(),
  is_error: z.boolean().optional(),
});

export const imageItemSchema = z.looseObject({
  type: z.literal('image'),
  source: z.looseObject({ type: z.literal('base64'), media_type: z.string(), data: z.string() }),
});

const windowSchema = z.looseObject({
  utilization: z.number().optional(),
  resetsAt: z.number().optional(),
});

export const rateLimitSchema = z.looseObject({
  rate_limit_info: z.looseObject({
    status: z.string(),
    resetsAt: z.number().optional(),
    rateLimitType: z.string().optional(),
    utilization: z.number().optional(),
    unifiedWindows: z.record(z.string(), windowSchema).optional(),
  }),
});

const modelUsageSchema = z.looseObject({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  cacheReadInputTokens: z.number().optional(),
  cacheCreationInputTokens: z.number().optional(),
  costUSD: z.number().optional(),
  contextWindow: z.number().optional(),
});

export const resultSchema = z.looseObject({
  subtype: z.string(),
  is_error: z.boolean(),
  result: z.string().optional(),
  num_turns: z.number().optional(),
  duration_ms: z.number().optional(),
  total_cost_usd: z.number().optional(),
  usage: usageSchema.optional(),
  modelUsage: z.record(z.string(), modelUsageSchema).optional(),
  permission_denials: z
    .array(z.looseObject({ tool_name: z.string(), tool_use_id: z.string() }))
    .optional(),
  terminal_reason: z.string().optional(),
  session_id: z.string().optional(),
  /** Seen on pre-model failures, e.g. `No conversation found with session ID: <id>`. */
  errors: z.array(z.string()).optional(),
});
