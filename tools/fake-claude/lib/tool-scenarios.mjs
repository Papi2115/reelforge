// @ts-check
// Synthetic tool-use scenarios built from recorded templates (see ../README.md).

import path from 'node:path';
import { assistant, fakeUuid, okTemplate, result, toolResult } from './builders.mjs';
import { clone, loadFixture, modelFamily } from './fixtures.mjs';

/** @typedef {import('./fixtures.mjs').StreamEvent} StreamEvent */
/** @typedef {import('./fixtures.mjs').RunContext} RunContext */

/**
 * Read -> Edit -> Write with successful tool results (synthetic, built from recorded templates).
 * @param {RunContext} context
 * @returns {StreamEvent[]}
 */
export function toolsEditEvents(context) {
  const base = okTemplate(modelFamily(context.modelId));
  const scene = path.join(context.cwd, 'scenes', 's01.js');
  const notes = path.join(context.cwd, 'notes.txt');
  /**
   * @param {string} id
   * @param {string} name
   * @param {Record<string, unknown>} input
   * @returns {StreamEvent}
   */
  const toolUse = (id, name, input) => ({ type: 'tool_use', id, name, input });
  return [
    { ...base.init, tools: context.tools ?? ['Read', 'Edit', 'Write'] },
    assistant(base.text, 'msg_fake_01', { type: 'text', text: "I'll update the scene." }),
    assistant(base.text, 'msg_fake_01', toolUse('toolu_fake_read', 'Read', { file_path: scene })),
    toolResult('toolu_fake_read', '1\texport const meta = { title: "Old" };', false),
    assistant(
      base.text,
      'msg_fake_02',
      toolUse('toolu_fake_edit', 'Edit', {
        file_path: scene,
        old_string: 'title: "Old"',
        new_string: 'title: "New"',
      }),
    ),
    toolResult('toolu_fake_edit', `The file ${scene} has been updated successfully.`, false),
    assistant(
      base.text,
      'msg_fake_03',
      toolUse('toolu_fake_write', 'Write', { file_path: notes, content: 'hi' }),
    ),
    toolResult('toolu_fake_write', `File created successfully at: ${notes}`, false),
    base.rateLimit,
    assistant(base.text, 'msg_fake_04', { type: 'text', text: 'Done.' }),
    result(base.result, { text: 'Done.', isError: false, numTurns: 4 }),
  ];
}

/**
 * @param {string} id
 * @param {string} name
 * @param {Record<string, unknown>} input
 * @returns {StreamEvent}
 */
function toolUseBlock(id, name, input) {
  return { type: 'tool_use', id, name, input };
}

/**
 * Resolves sidecar writes against the cwd; a path that leaves the cwd is refused (the fake only
 * ever writes inside the project folder it was started in).
 * @param {string} cwd
 * @param {import('./select.mjs').FileWrite[]} writes
 * @returns {import('./select.mjs').FileWrite[]} absolute paths
 */
export function resolveWrites(cwd, writes) {
  return writes.map((write) => {
    const absolute = path.resolve(cwd, write.path);
    const relative = path.relative(cwd, absolute);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`fake-claude: tools-write path escapes the cwd: ${write.path}`);
    }
    return { path: absolute, content: write.content };
  });
}

/**
 * Canned stage output (prompt evals): one Write tool_use + successful tool_result per file (the
 * files themselves are written by the player), then the final text reply.
 * @param {RunContext} context
 * @param {import('./select.mjs').FileWrite[]} files absolute paths (see resolveWrites)
 * @param {string} reply
 * @returns {StreamEvent[]}
 */
export function toolsWriteEvents(context, files, reply) {
  const base = okTemplate(modelFamily(context.modelId));
  const writes = files.flatMap((file, index) => {
    const id = `toolu_fake_write_${String(index + 1)}`;
    return [
      assistant(
        base.text,
        `msg_fake_w${String(index + 1)}`,
        toolUseBlock(id, 'Write', { file_path: file.path, content: file.content }),
      ),
      toolResult(id, `File created successfully at: ${file.path}`, false),
    ];
  });
  return [
    { ...base.init, tools: context.tools ?? ['Read', 'Write'] },
    ...writes,
    base.rateLimit,
    assistant(base.text, 'msg_fake_wz', { type: 'text', text: reply }),
    result(base.result, { text: reply, isError: false, numTurns: files.length + 1 }),
  ];
}

/**
 * Escape attempts as the real CLI handles them under `dontAsk` (verified on 2.1.287, see
 * packages/claude-bridge/README.md "Permissions"): a Write outside the project is denied (`permission_denied` +
 * error tool_result + `result.permission_denials`), while a "read-only" `echo` runs anyway when no
 * PreToolUse bash guard is installed.
 * @param {RunContext} context
 * @returns {StreamEvent[]}
 */
export function toolsEscapeEvents(context) {
  const base = okTemplate(modelFamily(context.modelId));
  const outside = path.join(path.dirname(context.cwd), 'outside.txt');
  const writeId = 'toolu_fake_escape_write';
  const deniedTemplate = loadFixture('tools-read-png').find(
    (event) => event['type'] === 'system' && event['subtype'] === 'permission_denied',
  );
  if (deniedTemplate === undefined)
    throw new Error('fixture tools-read-png lacks permission_denied');
  /** @type {StreamEvent} */
  const denied = { ...clone(deniedTemplate), tool_use_id: writeId, uuid: fakeUuid() };
  const final = result(base.result, { text: 'Done.', isError: false, numTurns: 3 });
  final['permission_denials'] = [
    { tool_name: 'Write', tool_use_id: writeId, tool_input: { file_path: outside, content: 'x' } },
  ];
  return [
    { ...base.init, tools: context.tools ?? ['Read', 'Edit', 'Write', 'Bash'] },
    assistant(
      base.text,
      'msg_fake_e1',
      toolUseBlock(writeId, 'Write', { file_path: outside, content: 'x' }),
    ),
    denied,
    toolResult(writeId, String(denied['message']), true),
    assistant(
      base.text,
      'msg_fake_e2',
      toolUseBlock('toolu_fake_escape_bash', 'Bash', { command: 'echo pwned' }),
    ),
    toolResult('toolu_fake_escape_bash', 'pwned', false),
    base.rateLimit,
    assistant(base.text, 'msg_fake_e3', { type: 'text', text: 'Done.' }),
    final,
  ];
}
