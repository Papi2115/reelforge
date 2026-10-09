import { describe, expect, it } from 'vitest';
import {
  frameFileName,
  parseRenderFramesArgs,
  parseTimes,
  UsageError,
} from './render-frames-args.js';

describe('render:frames arguments', () => {
  it('parses a scene invocation (with the pnpm `--` separator)', () => {
    expect(
      parseRenderFramesArgs([
        '--',
        '--scene',
        'examples/s00_hello.js',
        '--at',
        '0,2.5, 5',
        '--out',
        'frames',
      ]),
    ).toEqual({
      scene: 'examples/s00_hello.js',
      manifest: undefined,
      times: [0, 2.5, 5],
      out: 'frames',
      preset: undefined,
      format: undefined,
      words: undefined,
      duration: undefined,
      seed: undefined,
      lint: true,
      experimental: false,
      help: false,
    });
  });

  it('parses --experimental (showcase renders of experimental world styles)', () => {
    const argv = ['--scene', 'a.js', '--at', '1', '--preset', 'test-world', '--experimental'];
    expect(parseRenderFramesArgs(argv)).toMatchObject({
      preset: 'test-world',
      experimental: true,
    });
  });

  it('parses --format (portrait renders, PLAN.md#13.18)', () => {
    const argv = ['--scene', 'a.js', '--at', '1', '--format', 'portrait'];
    expect(parseRenderFramesArgs(argv).format).toBe('portrait');
  });

  it('parses a manifest invocation with a preset and --no-lint', () => {
    const args = parseRenderFramesArgs([
      '--manifest',
      'video.json',
      '--at',
      '1',
      '--preset',
      'noir-voxel',
      '--no-lint',
    ]);
    expect(args).toMatchObject({
      manifest: 'video.json',
      preset: 'noir-voxel',
      lint: false,
      times: [1],
    });
  });

  it.each([
    [[], /exactly one of --scene/],
    [['--scene', 'a.js', '--manifest', 'b.json', '--at', '1'], /exactly one of --scene/],
    [['--scene', 'a.js'], /--at is required/],
    [['--scene', 'a.js', '--at', 'soon'], /"soon" is not a time/],
    [['--scene', 'a.js', '--at', '1,-1'], /"-1" is not a time/],
    [['--scene', 'a.js', '--at', '-1'], /argument is ambiguous/],
    [['--scene', 'a.js', '--at', ','], /at least one time/],
    [['--scene', 'a.js', '--at', '1', '--duration', '0'], /--duration: "0" is not valid/],
    [['--scene', 'a.js', '--at', '1', '--seed', '1.5'], /--seed: "1.5" is not valid/],
    [['--manifest', 'v.json', '--at', '1', '--seed', '3'], /only apply to --scene/],
    [['--scene', 'a.js', '--at', '1', '--bogus'], /bogus/],
    [['--scene', 'a.js', '--at', '1', '--format', 'square'], /--format: "square"/],
  ])('rejects %j', (argv, message) => {
    expect(() => parseRenderFramesArgs(argv)).toThrow(UsageError);
    expect(() => parseRenderFramesArgs(argv)).toThrow(message);
  });

  it('accepts --help alone', () => {
    expect(parseRenderFramesArgs(['--help']).help).toBe(true);
  });

  it('names frames by scene and time', () => {
    expect(parseTimes('0,2.5')).toEqual([0, 2.5]);
    expect(frameFileName('s00_hello', 2.5)).toBe('s00_hello_t2.500.png');
    expect(frameFileName('s00_hello', 0)).toBe('s00_hello_t0.000.png');
  });
});
