import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentTypeFor, resolveAppAsset } from './app-asset.js';

const root = path.resolve('C:/Users/Zażółć Gęślą/Creatorize Suite/out/renderer');

describe('resolveAppAsset', () => {
  it('maps app URLs into the renderer root (spaces and Polish letters)', () => {
    const asset = resolveAppAsset(root, 'reelforge://app/engine/engine-frame.html');
    expect(asset).toEqual({
      ok: true,
      value: {
        file: path.join(root, 'engine', 'engine-frame.html'),
        contentType: 'text/html; charset=utf-8',
      },
    });
  });

  it('serves index.html for the bare origin and decodes escapes', () => {
    const index = resolveAppAsset(root, 'reelforge://app/');
    expect(index.ok && index.value.file).toBe(path.join(root, 'index.html'));
    const escaped = resolveAppAsset(root, 'reelforge://app/assets/z%C5%BC%20x.js');
    expect(escaped.ok && escaped.value.file).toBe(path.join(root, 'assets', 'zż x.js'));
  });

  it('keeps URL-normalized dot segments inside the root', () => {
    for (const url of [
      'reelforge://app/../secret.txt',
      'reelforge://app/%2e%2e/%2e%2e/secret.txt',
    ]) {
      const asset = resolveAppAsset(root, url);
      expect(asset.ok && asset.value.file, url).toBe(path.join(root, 'secret.txt'));
    }
  });

  it('rejects encoded traversal, other hosts and other schemes', () => {
    for (const url of [
      'reelforge://app/assets/..%2F..%2Fsecret.txt',
      'reelforge://app/..%5C..%5Csecret.txt',
      'reelforge://other/index.html',
      'file:///C:/Windows/win.ini',
      'reelforge://app/%E0%A4%A',
      'reelforge://app/a%00.js',
    ]) {
      expect(resolveAppAsset(root, url).ok, url).toBe(false);
    }
  });
});

describe('contentTypeFor', () => {
  it('knows the renderer asset types and falls back to octet-stream', () => {
    expect(contentTypeFor('a/index-3f2a.JS')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeFor('a/style.css')).toBe('text/css; charset=utf-8');
    expect(contentTypeFor('a/blob.bin')).toBe('application/octet-stream');
  });
});
