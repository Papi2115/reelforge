// @ts-check
// Scenario catalogue of fake-claude: each scenario turns the invocation context into a "plan"
// (lines to print, pacing, exit behaviour). See ../README.md for the documented list.

import { fakeUuid, okTemplate, rateLimitEvent, result, syntheticAssistant } from './builders.mjs';
import { adaptEvent, clone, loadFixture, modelFamily, overrideReply } from './fixtures.mjs';
import {
  resolveWrites,
  toolsEditEvents,
  toolsEscapeEvents,
  toolsWriteEvents,
} from './tool-scenarios.mjs';

/** @typedef {import('./fixtures.mjs').StreamEvent} StreamEvent */
/** @typedef {import('./fixtures.mjs').RunContext} RunContext */

export const SCENARIOS = /** @type {const} */ ([
  'ok',
  'tools-read-png',
  'tools-edit',
  'tools-escape',
  'tools-write',
  'resume',
  'slow',
  'hang',
  'crash',
  'garbage',
  'not-logged-in',
  'rate-limit',
  'limit-warning',
  'api-key',
  'resume-not-found',
]);

/** ASSUMED usage-limit shapes (never observed live, ADR-001): see README "Usage limit". */
export const LIMIT_SHAPES = /** @type {const} */ ([
  'full',
  'event-only',
  'error-only',
  'text-only',
]);

/** Verified on 2.1.287 (no model call): stderr text + `result.errors[0]` for an unknown id. */
export const SESSION_NOT_FOUND_TEXT = 'No conversation found with session ID:';

/**
 * Recorded `--resume <unknown id>` stream: one `result` line, no init (real CLI, exit 1).
 * @param {string} sessionId
 * @returns {Plan}
 */
export function sessionNotFoundPlan(sessionId) {
  const [template] = loadFixture('resume-not-found');
  if (template === undefined) throw new Error('fixture resume-not-found is empty');
  const message = `${SESSION_NOT_FOUND_TEXT} ${sessionId}`;
  return {
    lines: [{ ...clone(template), session_id: sessionId, uuid: fakeUuid(), errors: [message] }],
    exitCode: 1,
    lineDelayMs: 0,
    stderr: `${message}\n`,
  };
}

/** Default `resetsAt` (epoch seconds) of synthetic limit events; deterministic on purpose. */
export const DEFAULT_RESETS_AT = 1790902800;
export const LIMIT_TEXT = "You've hit your usage limit · resets 5am (UTC)";

/**
 * @typedef {object} ScenarioOptions
 * @property {string | undefined} reply          FAKE_CLAUDE_REPLY
 * @property {number | undefined} delayMs        FAKE_CLAUDE_DELAY_MS
 * @property {number | undefined} ticks          FAKE_CLAUDE_SLOW_TICKS
 * @property {string | undefined} limitShape     FAKE_CLAUDE_LIMIT_SHAPE
 * @property {number | undefined} resetsAt       FAKE_CLAUDE_RESETS_AT
 * @property {number | undefined} exitCode       FAKE_CLAUDE_EXIT_CODE
 * @property {boolean} resumed                   `--resume` was given
 * @property {import('./select.mjs').FileWrite[] | undefined} writes  sidecar `writes` (tools-write)
 */

/**
 * @typedef {object} Plan
 * @property {Array<StreamEvent | string>} lines  events (JSON-encoded) or raw text lines
 * @property {number} exitCode
 * @property {number} lineDelayMs                 pause before every line after the first
 * @property {string} [stderr]
 * @property {string} [truncatedTail]             written without a newline, then exit (crash)
 * @property {boolean} [hang]                     stay alive until killed
 * @property {import('./select.mjs').FileWrite[]} [files]  written (absolute paths) before the lines
 */

/**
 * @param {RunContext} context
 * @param {string} shape
 * @param {number} resetsAt
 * @returns {StreamEvent[]}
 */
function limitEvents(context, shape, resetsAt) {
  const base = okTemplate(modelFamily(context.modelId));
  const rejected = rateLimitEvent(base.rateLimit, 'rejected', resetsAt, 1);
  switch (shape) {
    case 'event-only':
      return [
        base.init,
        rejected,
        result(base.result, { text: 'API Error: request rejected', isError: true }),
      ];
    case 'error-only':
      return [
        base.init,
        syntheticAssistant('API Error: Rate limit reached', 'rate_limit'),
        result(base.result, { text: 'API Error: Rate limit reached', isError: true }),
      ];
    case 'text-only':
      return [
        base.init,
        syntheticAssistant(LIMIT_TEXT, undefined),
        result(base.result, { text: LIMIT_TEXT, isError: true }),
      ];
    default:
      return [
        base.init,
        rejected,
        syntheticAssistant(LIMIT_TEXT, 'rate_limit'),
        result(base.result, { text: LIMIT_TEXT, isError: true }),
      ];
  }
}

/**
 * @param {string} scenario
 * @param {RunContext} context
 * @param {ScenarioOptions} options
 * @returns {Plan}
 */
export function buildPlan(scenario, context, options) {
  const family = modelFamily(context.modelId);
  const adapt = (/** @type {StreamEvent[]} */ events) => {
    const adapted = events.map((event) => adaptEvent(event, context));
    return options.reply === undefined ? adapted : overrideReply(adapted, options.reply);
  };
  const ok = () => adapt(okTemplate(family).events);
  const exit = (/** @type {number} */ fallback) => options.exitCode ?? fallback;
  switch (scenario) {
    case 'ok':
      return { lines: ok(), exitCode: exit(0), lineDelayMs: options.delayMs ?? 0 };
    case 'tools-read-png':
      return {
        lines: adapt(loadFixture('tools-read-png')),
        exitCode: exit(0),
        lineDelayMs: options.delayMs ?? 0,
      };
    case 'tools-edit':
      return { lines: adapt(toolsEditEvents(context)), exitCode: exit(0), lineDelayMs: 0 };
    case 'tools-escape':
      return { lines: adapt(toolsEscapeEvents(context)), exitCode: exit(0), lineDelayMs: 0 };
    case 'tools-write': {
      const files = resolveWrites(context.cwd, options.writes ?? []);
      const events = toolsWriteEvents(context, files, options.reply ?? 'Done.');
      return { lines: adapt(events), files, exitCode: exit(0), lineDelayMs: 0 };
    }
    case 'resume':
      return {
        lines: adapt(loadFixture(options.resumed ? 'resume-2-recall' : 'resume-1-remember')),
        exitCode: exit(0),
        lineDelayMs: options.delayMs ?? 0,
      };
    case 'slow': {
      const [init, ...rest] = ok();
      const ticks = Array.from({ length: options.ticks ?? 40 }, (_, index) => ({
        type: 'system',
        subtype: 'thinking_tokens',
        estimated_tokens: (index + 1) * 50,
        estimated_tokens_delta: 50,
        session_id: context.sessionId,
        uuid: fakeUuid(),
      }));
      const lines = init === undefined ? rest : [init, ...ticks, ...rest];
      return { lines, exitCode: exit(0), lineDelayMs: options.delayMs ?? 250 };
    }
    case 'hang':
      return { lines: ok().slice(0, 1), exitCode: exit(0), lineDelayMs: 0, hang: true };
    case 'crash':
      return {
        lines: ok().filter(
          (event) => event['type'] !== 'result' && event['type'] !== 'rate_limit_event',
        ),
        exitCode: exit(1),
        lineDelayMs: options.delayMs ?? 0,
        stderr: 'fake-claude: simulated crash mid-stream\n',
        truncatedTail: '{"type":"assistant","message":{"model":"claude-',
      };
    case 'garbage': {
      const [init, ...rest] = ok();
      const junk = ['this is not json', '[1,2,3]', '{"type":"brand_new_event","payload":{"x":1}}'];
      const lines = init === undefined ? rest : [init, ...junk, ...rest];
      return { lines, exitCode: exit(0), lineDelayMs: 0 };
    }
    case 'not-logged-in':
      return { lines: adapt(loadFixture('not-logged-in')), exitCode: exit(1), lineDelayMs: 0 };
    case 'rate-limit':
      return {
        lines: adapt(
          limitEvents(context, options.limitShape ?? 'full', options.resetsAt ?? DEFAULT_RESETS_AT),
        ),
        exitCode: exit(1),
        lineDelayMs: 0,
      };
    case 'limit-warning': {
      const template = okTemplate(family);
      const warning = rateLimitEvent(
        template.rateLimit,
        'allowed_warning',
        options.resetsAt ?? DEFAULT_RESETS_AT,
        0.92,
      );
      const events = template.events.map((event) =>
        event['type'] === 'rate_limit_event' ? warning : event,
      );
      return { lines: adapt(events), exitCode: exit(0), lineDelayMs: 0 };
    }
    case 'resume-not-found':
      return options.resumed
        ? sessionNotFoundPlan(context.sessionId)
        : { lines: ok(), exitCode: exit(0), lineDelayMs: options.delayMs ?? 0 };
    case 'api-key': {
      const lines = adapt(okTemplate(family).events);
      const init = lines[0];
      if (init !== undefined) init['apiKeySource'] = 'ANTHROPIC_API_KEY';
      return { lines, exitCode: exit(0), lineDelayMs: options.delayMs ?? 200 };
    }
    default:
      return {
        lines: [],
        exitCode: 2,
        lineDelayMs: 0,
        stderr: `fake-claude: unknown scenario "${scenario}" (known: ${SCENARIOS.join(', ')})\n`,
      };
  }
}
