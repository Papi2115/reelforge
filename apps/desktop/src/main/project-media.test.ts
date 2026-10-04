import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectMediaUrl } from '../shared/player-contract.js';
import { parseByteRange, resolveProjectMedia } from './project-media.js';

// Absolute on every OS (`C:\…` on Windows, `/…` on POSIX): resolveProjectMedia resolves the dir.
const project = path.join(path.parse(process.cwd()).root, 'Creatorize Suite', 'Mój film');

describe('resolveProjectMedia', () => {
  it('maps media URLs to audio files inside the open project', () => {
    expect(resolveProjectMedia(project, projectMediaUrl('audio/vo.clean.wav', 3))).toEqual({
      ok: true,
      value: { file: path.join(project, 'audio', 'vo.clean.wav'), contentType: 'audio/wav' },
    });
    expect(
      resolveProjectMedia(project, projectMediaUrl('audio/głos nagrany.MP3', 0)),
    ).toMatchObject({
      ok: true,
      value: { file: path.join(project, 'audio', 'głos nagrany.MP3'), contentType: 'audio/mpeg' },
    });
  });

  it('serves frame images only from .reelforge/frames, with an optional thumbnail width', () => {
    expect(
      resolveProjectMedia(project, 'reelforge-media://project/.reelforge/frames/s02/a.png?w=160'),
    ).toEqual({
      ok: true,
      value: {
        file: path.join(project, '.reelforge', 'frames', 's02', 'a.png'),
        contentType: 'image/png',
        thumbnailWidth: 160,
      },
    });
    expect(
      resolveProjectMedia(project, 'reelforge-media://project/.reelforge/frames/sheet.png?w=x'),
    ).toMatchObject({ ok: true, value: { contentType: 'image/png' } });
    const refused = (url: string): boolean => !resolveProjectMedia(project, url).ok;
    expect(refused('reelforge-media://project/out/snapshots/a.png')).toBe(true);
    expect(refused('reelforge-media://project/.reelforge/frames/../../secret.png')).toBe(true);
    expect(refused('reelforge-media://project/.reelforge/frames/notes.txt')).toBe(true);
  });

  it('serves downloaded assets and proposal thumbnails (images only) from .reelforge/assets', () => {
    expect(
      resolveProjectMedia(project, projectMediaUrl('.reelforge/assets/thumbnails/p1-2.jpg', 1)),
    ).toEqual({
      ok: true,
      value: {
        file: path.join(project, '.reelforge', 'assets', 'thumbnails', 'p1-2.jpg'),
        contentType: 'image/jpeg',
      },
    });
    expect(
      resolveProjectMedia(project, projectMediaUrl('.reelforge/assets/web-x.gif', 0)),
    ).toMatchObject({ ok: true, value: { contentType: 'image/gif' } });
    const refused = (relative: string): boolean =>
      !resolveProjectMedia(project, projectMediaUrl(relative, 0)).ok;
    expect(refused('.reelforge/assets/proposals/1.json')).toBe(true);
    expect(refused('.reelforge/assets/clip.mp4')).toBe(true);
    expect(refused('.reelforge/assets/../../secret.png')).toBe(true);
    expect(
      resolveProjectMedia(project, 'reelforge-media://project/.reelforge/assets/..%2F..%2Fa.png')
        .ok,
    ).toBe(false);
    expect(refused('assets/photo.png')).toBe(true);
  });

  it('refuses other schemes, hosts, traversal, non-audio files and no open project', () => {
    const status = (dir: string | undefined, url: string): number | undefined => {
      const result = resolveProjectMedia(dir, url);
      return result.ok ? undefined : result.error.status;
    };
    expect(status(project, 'reelforge://app/audio/a.wav')).toBe(400);
    expect(status(project, 'reelforge-media://other/audio/a.wav')).toBe(400);
    expect(status(project, 'reelforge-media://project/..%2F..%2Fsecret.wav')).toBe(403);
    expect(status(project, 'reelforge-media://project/audio%5C..%5C..%5Cx.wav')).toBe(400);
    expect(status(project, 'reelforge-media://project/C%3A%2FWindows%2Fx.wav')).toBe(400);
    expect(status(project, 'reelforge-media://project/project.json')).toBe(403);
    expect(status(project, 'reelforge-media://project/%E0%A4%A')).toBe(400);
    expect(status(undefined, projectMediaUrl('audio/mix.wav', 0))).toBe(404);
  });
});

describe('parseByteRange', () => {
  it('parses open, closed and suffix ranges', () => {
    expect(parseByteRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
    expect(parseByteRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
    expect(parseByteRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
  });

  it('sends the whole file for no or unsupported headers', () => {
    expect(parseByteRange(null, 1000)).toBeUndefined();
    expect(parseByteRange('bytes=0-1,5-6', 1000)).toBeUndefined();
    expect(parseByteRange('items=0-1', 1000)).toBeUndefined();
    expect(parseByteRange('bytes=-', 1000)).toBeUndefined();
  });

  it('reports unsatisfiable ranges', () => {
    expect(parseByteRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=5-4', 1000)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-0', 1000)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=0-', 0)).toBe('unsatisfiable');
  });
});
