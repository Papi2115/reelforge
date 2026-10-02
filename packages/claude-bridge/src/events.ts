/**
 * `claude -p --output-format stream-json --verbose` line parser (PLAN.md#5.3): one JSON object per
 * line -> zod-validated, normalized `StreamEvent`s. Shapes follow docs/spikes/01-claude-cli.md §2;
 * unknown types/fields pass through (`unknown` keeps the raw object), non-JSON -> `parse-error`.
 */
import { z } from 'zod';
import {
  usageSchema,
  initSchema,
  thinkingTokensSchema,
  permissionDeniedSchema,
  assistantSchema,
  textBlockSchema,
  thinkingBlockSchema,
  toolUseBlockSchema,
  userSchema,
  toolResultBlockSchema,
  imageItemSchema,
  rateLimitSchema,
  resultSchema,
} from './stream-schemas.js';

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
}

export interface ModelUsage extends TokenUsage {
  readonly costUsd: number;
  readonly contextWindow: number | undefined;
}

export interface InlineImage {
  readonly mediaType: string;
  readonly base64: string;
}

export interface RateLimitWindow {
  readonly utilization: number | undefined;
  readonly resetsAt: number | undefined;
}

export interface InitEvent {
  readonly kind: 'init';
  readonly sessionId: string;
  readonly model: string;
  readonly cwd: string;
  readonly tools: readonly string[];
  /** `"none"` = subscription auth; anything else (or missing) trips the billing guard. */
  readonly apiKeySource: string | undefined;
  readonly version: string | undefined;
  readonly permissionMode: string | undefined;
}

export interface RateLimitEvent {
  readonly kind: 'rate-limit';
  /** Observed: `allowed`; from the CLI schema: `allowed_warning`, `rejected`. */
  readonly status: string;
  readonly rateLimitType: string | undefined;
  /** Epoch seconds. */
  readonly resetsAt: number | undefined;
  readonly windows: Readonly<Record<string, RateLimitWindow>>;
}

export interface ResultEvent {
  readonly kind: 'result';
  readonly subtype: string;
  /** Branch on this, never on `subtype` (errors arrive as `subtype:"success"`). */
  readonly isError: boolean;
  /** Only the final assistant text of the turn. */
  readonly text: string;
  readonly numTurns: number;
  readonly durationMs: number;
  readonly costUsd: number;
  readonly terminalReason: string | undefined;
  readonly sessionId: string | undefined;
  readonly permissionDenials: readonly { readonly toolName: string; readonly toolUseId: string }[];
  /** CLI-level errors without a model call (e.g. unknown `--resume` id). */
  readonly errors: readonly string[];
}

export interface UsageEvent {
  readonly kind: 'usage';
  /** List-price estimate (not a bill on subscription); a relative meter. */
  readonly costUsd: number;
  readonly usage: TokenUsage;
  readonly models: Readonly<Record<string, ModelUsage>>;
}

export type StreamEvent =
  | InitEvent
  | { readonly kind: 'thinking-progress'; readonly estimatedTokens: number }
  | { readonly kind: 'thinking'; readonly messageId: string }
  | {
      readonly kind: 'text';
      readonly messageId: string;
      readonly text: string;
      readonly parentToolUseId: string | null;
    }
  | {
      readonly kind: 'tool-use';
      readonly messageId: string;
      readonly toolUseId: string;
      readonly name: string;
      readonly input: unknown;
      readonly parentToolUseId: string | null;
    }
  | {
      readonly kind: 'tool-result';
      readonly toolUseId: string;
      readonly isError: boolean;
      readonly text: string;
      readonly images: readonly InlineImage[];
    }
  /** Assistant message carrying `error` (e.g. `authentication_failed`, `rate_limit`). */
  | {
      readonly kind: 'api-error';
      readonly messageId: string;
      readonly error: string;
      readonly text: string;
    }
  | {
      readonly kind: 'permission-denied';
      readonly toolName: string;
      readonly toolUseId: string;
      readonly message: string;
    }
  | RateLimitEvent
  | ResultEvent
  | UsageEvent
  | { readonly kind: 'system'; readonly subtype: string; readonly raw: Record<string, unknown> }
  | {
      readonly kind: 'unknown';
      readonly type: string;
      readonly raw: Record<string, unknown>;
      /** Set when a known `type` failed validation. */
      readonly issue: string | undefined;
    }
  | { readonly kind: 'parse-error'; readonly line: string; readonly message: string };

function tokenUsage(usage: z.infer<typeof usageSchema> | undefined): TokenUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheCreationInputTokens: usage?.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage?.cache_read_input_tokens ?? 0,
  };
}

function invalid(raw: Record<string, unknown>, error: z.ZodError): StreamEvent[] {
  return [{ kind: 'unknown', type: String(raw['type']), raw, issue: z.prettifyError(error) }];
}

function parseSystem(raw: Record<string, unknown>): StreamEvent[] {
  const subtype = typeof raw['subtype'] === 'string' ? raw['subtype'] : '';
  if (subtype === 'init') {
    const parsed = initSchema.safeParse(raw);
    if (!parsed.success) return invalid(raw, parsed.error);
    const init = parsed.data;
    return [
      {
        kind: 'init',
        sessionId: init.session_id,
        model: init.model,
        cwd: init.cwd,
        tools: init.tools ?? [],
        apiKeySource: init.apiKeySource,
        version: init.claude_code_version,
        permissionMode: init.permissionMode,
      },
    ];
  }
  if (subtype === 'thinking_tokens') {
    const parsed = thinkingTokensSchema.safeParse(raw);
    if (!parsed.success) return invalid(raw, parsed.error);
    return [{ kind: 'thinking-progress', estimatedTokens: parsed.data.estimated_tokens }];
  }
  if (subtype === 'permission_denied') {
    const parsed = permissionDeniedSchema.safeParse(raw);
    if (!parsed.success) return invalid(raw, parsed.error);
    const denied = parsed.data;
    return [
      {
        kind: 'permission-denied',
        toolName: denied.tool_name,
        toolUseId: denied.tool_use_id,
        message: denied.message ?? '',
      },
    ];
  }
  return [{ kind: 'system', subtype, raw }];
}

function parseAssistant(raw: Record<string, unknown>): StreamEvent[] {
  const parsed = assistantSchema.safeParse(raw);
  if (!parsed.success) return invalid(raw, parsed.error);
  const { message, error } = parsed.data;
  const parentToolUseId = parsed.data.parent_tool_use_id ?? null;
  const texts = message.content.flatMap((block) => {
    const text = textBlockSchema.safeParse(block);
    return text.success ? [text.data.text] : [];
  });
  if (error !== undefined) {
    return [{ kind: 'api-error', messageId: message.id, error, text: texts.join('\n') }];
  }
  return message.content.flatMap((block): StreamEvent[] => {
    const text = textBlockSchema.safeParse(block);
    if (text.success) {
      return [{ kind: 'text', messageId: message.id, text: text.data.text, parentToolUseId }];
    }
    const toolUse = toolUseBlockSchema.safeParse(block);
    if (toolUse.success) {
      const { id, name, input } = toolUse.data;
      return [
        { kind: 'tool-use', messageId: message.id, toolUseId: id, name, input, parentToolUseId },
      ];
    }
    return thinkingBlockSchema.safeParse(block).success
      ? [{ kind: 'thinking', messageId: message.id }]
      : [];
  });
}

function toolResultContent(content: string | unknown[] | undefined): {
  text: string;
  images: InlineImage[];
} {
  if (content === undefined) return { text: '', images: [] };
  if (typeof content === 'string') return { text: content, images: [] };
  const texts: string[] = [];
  const images: InlineImage[] = [];
  for (const item of content) {
    const text = textBlockSchema.safeParse(item);
    if (text.success) texts.push(text.data.text);
    const image = imageItemSchema.safeParse(item);
    if (image.success) {
      images.push({ mediaType: image.data.source.media_type, base64: image.data.source.data });
    }
  }
  return { text: texts.join('\n'), images };
}

function parseUser(raw: Record<string, unknown>): StreamEvent[] {
  const parsed = userSchema.safeParse(raw);
  if (!parsed.success) return invalid(raw, parsed.error);
  const { content } = parsed.data.message;
  if (typeof content === 'string') return [];
  return content.flatMap((block): StreamEvent[] => {
    const result = toolResultBlockSchema.safeParse(block);
    if (!result.success) return [];
    const { text, images } = toolResultContent(result.data.content);
    return [
      {
        kind: 'tool-result',
        toolUseId: result.data.tool_use_id,
        isError: result.data.is_error ?? false,
        text,
        images,
      },
    ];
  });
}

function parseRateLimit(raw: Record<string, unknown>): StreamEvent[] {
  const parsed = rateLimitSchema.safeParse(raw);
  if (!parsed.success) return invalid(raw, parsed.error);
  const info = parsed.data.rate_limit_info;
  const windows: Record<string, RateLimitWindow> = {};
  for (const [name, window] of Object.entries(info.unifiedWindows ?? {})) {
    windows[name] = { utilization: window.utilization, resetsAt: window.resetsAt };
  }
  return [
    {
      kind: 'rate-limit',
      status: info.status,
      rateLimitType: info.rateLimitType,
      resetsAt: info.resetsAt,
      windows,
    },
  ];
}

function parseResult(raw: Record<string, unknown>): StreamEvent[] {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) return invalid(raw, parsed.error);
  const result = parsed.data;
  const costUsd = result.total_cost_usd ?? 0;
  const models: Record<string, ModelUsage> = {};
  for (const [model, usage] of Object.entries(result.modelUsage ?? {})) {
    models[model] = {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheCreationInputTokens: usage.cacheCreationInputTokens ?? 0,
      cacheReadInputTokens: usage.cacheReadInputTokens ?? 0,
      costUsd: usage.costUSD ?? 0,
      contextWindow: usage.contextWindow,
    };
  }
  return [
    {
      kind: 'result',
      subtype: result.subtype,
      isError: result.is_error,
      text: result.result ?? '',
      numTurns: result.num_turns ?? 0,
      durationMs: result.duration_ms ?? 0,
      costUsd,
      terminalReason: result.terminal_reason,
      sessionId: result.session_id,
      permissionDenials: (result.permission_denials ?? []).map((denial) => ({
        toolName: denial.tool_name,
        toolUseId: denial.tool_use_id,
      })),
      errors: result.errors ?? [],
    },
    { kind: 'usage', costUsd, usage: tokenUsage(result.usage), models },
  ];
}

/** Parses one stdout line into zero or more events (one per assistant content block). */
export function parseStreamLine(line: string): StreamEvent[] {
  if (line.trim() === '') return [];
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch (error) {
    return [{ kind: 'parse-error', line, message: String(error) }];
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [{ kind: 'parse-error', line, message: 'not a JSON object' }];
  }
  const raw = value as Record<string, unknown>;
  switch (raw['type']) {
    case 'system':
      return parseSystem(raw);
    case 'assistant':
      return parseAssistant(raw);
    case 'user':
      return parseUser(raw);
    case 'rate_limit_event':
      return parseRateLimit(raw);
    case 'result':
      return parseResult(raw);
    default:
      return [{ kind: 'unknown', type: String(raw['type']), raw, issue: undefined }];
  }
}

/** Splits a byte stream (already decoded as UTF-8) into complete lines; CRLF tolerant. */
export class LineBuffer {
  private pending = '';

  push(chunk: string): string[] {
    const parts = (this.pending + chunk).split('\n');
    this.pending = parts.pop() ?? '';
    return parts.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
  }

  /** Returns the unterminated tail (e.g. a line cut off by a crash), if any. */
  flush(): string[] {
    const rest = this.pending;
    this.pending = '';
    return rest.trim() === '' ? [] : [rest];
  }
}
