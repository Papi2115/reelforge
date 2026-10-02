// @ts-check
// Building blocks for synthetic streams: recorded templates (CLI 2.1.287) with replaced content.

import { clone, firstBlock, isRecord, loadFixture } from './fixtures.mjs';

/** @typedef {import('./fixtures.mjs').StreamEvent} StreamEvent */

let uuidCounter = 0;
/** @returns {string} */
export function fakeUuid() {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
}

/** @param {string} family */
export function okTemplate(family) {
  const events = loadFixture(`${family}-ok`);
  const find = (/** @type {(event: StreamEvent) => boolean} */ predicate) => {
    const found = events.find(predicate);
    if (found === undefined) throw new Error(`fixture ${family}-ok is missing an event`);
    return found;
  };
  return {
    events,
    init: find((event) => event['subtype'] === 'init'),
    text: find((event) => firstBlock(event)?.['type'] === 'text'),
    rateLimit: find((event) => event['type'] === 'rate_limit_event'),
    result: find((event) => event['type'] === 'result'),
  };
}

/**
 * @param {StreamEvent} template assistant event
 * @param {string} messageId
 * @param {StreamEvent} block
 * @returns {StreamEvent}
 */
export function assistant(template, messageId, block) {
  const copy = clone(template);
  const message = copy['message'];
  if (isRecord(message)) {
    message['id'] = messageId;
    message['content'] = [block];
  }
  copy['uuid'] = fakeUuid();
  return copy;
}

/**
 * @param {string} toolUseId
 * @param {string} content
 * @param {boolean} isError
 * @returns {StreamEvent}
 */
export function toolResult(toolUseId, content, isError) {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: [{ tool_use_id: toolUseId, type: 'tool_result', content, is_error: isError }],
    },
    parent_tool_use_id: null,
    session_id: '',
    uuid: fakeUuid(),
    timestamp: '2026-10-02T00:00:00.000Z',
    tool_use_result: isError ? `Error: ${content}` : { type: 'text', content },
  };
}

/**
 * @param {StreamEvent} template result event
 * @param {{ text: string, isError: boolean, numTurns?: number }} fields
 * @returns {StreamEvent}
 */
export function result(template, fields) {
  const copy = clone(template);
  copy['result'] = fields.text;
  copy['is_error'] = fields.isError;
  copy['subtype'] = 'success';
  copy['num_turns'] = fields.numTurns ?? 1;
  copy['uuid'] = fakeUuid();
  if (fields.isError) {
    copy['terminal_reason'] = 'api_error';
    copy['total_cost_usd'] = 0;
    copy['modelUsage'] = {};
  }
  return copy;
}

/**
 * @param {StreamEvent} template rate_limit_event
 * @param {'allowed' | 'allowed_warning' | 'rejected'} status
 * @param {number} resetsAt
 * @param {number} utilization
 * @returns {StreamEvent}
 */
export function rateLimitEvent(template, status, resetsAt, utilization) {
  const copy = clone(template);
  copy['rate_limit_info'] = {
    status,
    resetsAt,
    rateLimitType: 'five_hour',
    overageStatus: status === 'rejected' ? 'rejected' : 'allowed',
    isUsingOverage: false,
    unifiedWindows: {
      five_hour: { utilization, resetsAt },
      seven_day: { utilization: 0.4, resetsAt: resetsAt + 5 * 86400 },
    },
  };
  copy['uuid'] = fakeUuid();
  return copy;
}

/**
 * @param {string} text
 * @param {string | undefined} error assistant.error value, or undefined for none
 * @returns {StreamEvent}
 */
export function syntheticAssistant(text, error) {
  const template = loadFixture('not-logged-in').find((event) => event['type'] === 'assistant');
  if (template === undefined) throw new Error('fixture not-logged-in has no assistant event');
  const copy = assistant(template, fakeUuid(), { type: 'text', text });
  if (error === undefined) {
    delete copy['error'];
    delete copy['is_api_error_message'];
  } else {
    copy['error'] = error;
  }
  return copy;
}
