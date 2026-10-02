import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LineBuffer, parseStreamLine, type StreamEvent } from './events.js';
import { fakeFixturesDir, fixtureEvents } from './testing/fake-claude.js';

const kinds = (events: readonly StreamEvent[]): string[] => events.map((event) => event.kind);

describe('parseStreamLine on recorded CLI 2.1.287 streams', () => {
  const fixtures = readdirSync(fakeFixturesDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => name.replace(/\.jsonl$/, ''));

  it('validates every recorded line (no parse errors, no failed schemas)', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(7);
    for (const name of fixtures) {
      const events = fixtureEvents(name);
      // An unknown `--resume` id fails before the session starts: no init line.
      if (name !== 'resume-not-found') expect(events[0]?.kind, name).toBe('init');
      expect(events.at(-2)?.kind, name).toBe('result');
      expect(events.at(-1)?.kind, name).toBe('usage');
      const broken = events.filter(
        (event) => event.kind === 'parse-error' || event.kind === 'unknown',
      );
      expect(broken, name).toEqual([]);
    }
  });

  it('haiku-ok: init, thinking, text, rate limit, result + usage', () => {
    const events = fixtureEvents('haiku-ok');
    expect(kinds(events)).toEqual(['init', 'thinking', 'text', 'rate-limit', 'result', 'usage']);
    const [init] = events;
    expect(init).toMatchObject({
      kind: 'init',
      model: 'claude-haiku-4-5-20251001',
      apiKeySource: 'none',
      version: '2.1.287',
    });
    const result = events.find((event) => event.kind === 'result');
    expect(result).toMatchObject({ isError: false, text: 'ok', numTurns: 1 });
    const usage = events.find((event) => event.kind === 'usage');
    expect(usage?.kind === 'usage' && usage.usage.cacheReadInputTokens).toBe(17936);
    expect(usage?.kind === 'usage' && Object.keys(usage.models)).toEqual([
      'claude-haiku-4-5-20251001',
    ]);
  });

  it('tools-read-png: tool_use, image tool_result, permission_denied, error tool_result', () => {
    const events = fixtureEvents('tools-read-png');
    const toolUses = events.filter((event) => event.kind === 'tool-use');
    expect(toolUses.map((event) => event.name)).toEqual(['Read', 'Write']);
    const results = events.filter((event) => event.kind === 'tool-result');
    expect(results[0]?.images).toHaveLength(1);
    expect(results[0]?.images[0]?.mediaType).toBe('image/png');
    expect(results[1]?.isError).toBe(true);
    const denied = events.find((event) => event.kind === 'permission-denied');
    expect(denied).toMatchObject({ toolName: 'Write' });
    const result = events.find((event) => event.kind === 'result');
    expect(result?.kind === 'result' && result.permissionDenials).toEqual([
      { toolName: 'Write', toolUseId: toolUses[1]?.toolUseId },
    ]);
  });

  it('not-logged-in: api-error instead of text, is_error result despite subtype success', () => {
    const events = fixtureEvents('not-logged-in');
    expect(kinds(events)).toEqual(['init', 'api-error', 'result', 'usage']);
    expect(events[1]).toMatchObject({
      error: 'authentication_failed',
      text: 'Not logged in · Please run /login',
    });
    expect(events[2]).toMatchObject({ subtype: 'success', isError: true });
  });

  it('resume-not-found: a lone is_error result carrying `errors` (real 2.1.287 stream)', () => {
    const events = fixtureEvents('resume-not-found');
    expect(kinds(events)).toEqual(['result', 'usage']);
    expect(events[0]).toMatchObject({
      subtype: 'error_during_execution',
      isError: true,
      numTurns: 0,
      errors: ['No conversation found with session ID: 9b2f6c1e-1111-4222-8333-444455556666'],
    });
  });

  it('rate_limit_event: status, type, resetsAt and windows', () => {
    const event = fixtureEvents('opus-ok').find((candidate) => candidate.kind === 'rate-limit');
    expect(event).toMatchObject({
      status: 'allowed',
      rateLimitType: 'five_hour',
      resetsAt: 1790902800,
      windows: { five_hour: { utilization: 0.05 }, seven_day: { utilization: 0.02 } },
    });
  });
});

describe('parseStreamLine on malformed input', () => {
  it('turns non-JSON and non-object lines into parse-error events', () => {
    expect(parseStreamLine('not json')[0]?.kind).toBe('parse-error');
    expect(parseStreamLine('[1,2]')[0]).toMatchObject({
      kind: 'parse-error',
      message: 'not a JSON object',
    });
    expect(parseStreamLine('{"type":"assistant","mess')[0]?.kind).toBe('parse-error');
    expect(parseStreamLine('   ')).toEqual([]);
  });

  it('passes unknown types through with the raw object', () => {
    expect(parseStreamLine('{"type":"brand_new","x":1}')).toEqual([
      { kind: 'unknown', type: 'brand_new', raw: { type: 'brand_new', x: 1 }, issue: undefined },
    ]);
    expect(parseStreamLine('{"type":"system","subtype":"hook_started"}')[0]).toMatchObject({
      kind: 'system',
      subtype: 'hook_started',
    });
  });

  it('reports known types that fail validation as unknown with an issue', () => {
    const [event] = parseStreamLine('{"type":"result","subtype":"success"}');
    expect(event?.kind).toBe('unknown');
    expect(event?.kind === 'unknown' && event.issue).toMatch(/is_error/);
    const [init] = parseStreamLine('{"type":"system","subtype":"init"}');
    expect(init?.kind).toBe('unknown');
  });

  it('keeps an init without apiKeySource (the billing guard then fails closed)', () => {
    const [init] = parseStreamLine(
      '{"type":"system","subtype":"init","session_id":"s","model":"m","cwd":"c"}',
    );
    expect(init).toMatchObject({ kind: 'init', apiKeySource: undefined, tools: [] });
  });
});

describe('LineBuffer', () => {
  it('reassembles lines split across chunks and strips CR', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('{"a":')).toEqual([]);
    expect(buffer.push('1}\r\n{"b"')).toEqual(['{"a":1}']);
    expect(buffer.push(':2}\n\n')).toEqual(['{"b":2}', '']);
    expect(buffer.flush()).toEqual([]);
  });

  it('flushes an unterminated tail (crash mid-line)', () => {
    const buffer = new LineBuffer();
    buffer.push('{"type":"x"}\n{"type":"assis');
    expect(buffer.flush()).toEqual(['{"type":"assis']);
    expect(buffer.flush()).toEqual([]);
  });
});
