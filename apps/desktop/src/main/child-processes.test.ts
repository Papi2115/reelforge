import { EventEmitter } from 'node:events';
import { err, ok } from '@reelforge/claude-bridge';
import { describe, expect, it } from 'vitest';
import { createChildProcessRegistry } from './child-processes.js';
import { createLogger } from './logger.js';

class FakeChild extends EventEmitter {
  constructor(readonly pid: number | undefined) {
    super();
  }
}

describe('createChildProcessRegistry', () => {
  it('kills the trees of children that are still running', async () => {
    const killed: number[] = [];
    const lines: string[] = [];
    const registry = createChildProcessRegistry(
      (pid) => {
        killed.push(pid);
        return Promise.resolve(pid === 30 ? err('access denied') : ok(undefined));
      },
      createLogger((line) => lines.push(line)),
    );
    const exited = new FakeChild(10);
    registry.track(exited);
    registry.track(new FakeChild(20));
    registry.track(new FakeChild(30));
    registry.track(new FakeChild(undefined));
    exited.emit('exit');
    expect(registry.size).toBe(2);

    await registry.killAll();
    expect(killed).toEqual([20, 30]);
    expect(registry.size).toBe(0);
    expect(lines.join('')).toContain('could not kill process tree 30: access denied');
  });
});
