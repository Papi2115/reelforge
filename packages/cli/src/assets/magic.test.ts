import { describe, expect, it } from 'vitest';
import { imageDimensions, sniffType } from './magic.js';
import { tinyMp4, tinyPng } from './testing/server.js';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

function jpeg(width: number, height: number): Uint8Array {
  // SOI, APP0 (length 4), SOF0 with height/width, EOI
  return bytes(
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0xff,
    0xd9,
  );
}

function webpVp8x(width: number, height: number): Uint8Array {
  const file = new Uint8Array(30);
  file.set(text('RIFF'), 0);
  file.set(text('WEBPVP8X'), 8);
  const w = width - 1;
  const h = height - 1;
  file.set(
    [w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff],
    24,
  );
  return file;
}

function webm(): Uint8Array {
  const file = new Uint8Array(64);
  file.set([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84], 0);
  file.set(text('webm'), 12);
  return file;
}

describe('sniffType', () => {
  it('recognises the six allowed types by content', () => {
    expect(sniffType(tinyPng(2, 2))?.mime).toBe('image/png');
    expect(sniffType(jpeg(10, 20))).toEqual({ mime: 'image/jpeg', kind: 'image', ext: 'jpg' });
    expect(sniffType(text('GIF89a\u0001\u0000\u0001\u0000'))?.ext).toBe('gif');
    expect(sniffType(webpVp8x(5, 6))?.mime).toBe('image/webp');
    expect(sniffType(tinyMp4())).toEqual({ mime: 'video/mp4', kind: 'video', ext: 'mp4' });
    expect(sniffType(webm())?.mime).toBe('video/webm');
  });

  it('rejects SVG, HTML, scripts, executables, archives, QuickTime/HEIC and Matroska', () => {
    const rejected: Uint8Array[] = [
      text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      text('<!doctype html><html>'),
      text('#!/bin/sh\nrm -rf /'),
      text('MZ\u0090\u0000'),
      bytes(0x7f, 0x45, 0x4c, 0x46),
      text('PK\u0003\u0004'),
      bytes(0x1f, 0x8b, 0x08),
      text('\u0000\u0000\u0000\u0014ftypqt  '),
      text('\u0000\u0000\u0000\u0018ftypheic'),
      bytes(0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x88, ...text('matroska')),
      new Uint8Array(0),
    ];
    for (const sample of rejected) expect(sniffType(sample)).toBeUndefined();
  });
});

describe('imageDimensions', () => {
  it('reads PNG, GIF, JPEG and WebP sizes', () => {
    expect(imageDimensions(tinyPng(64, 48), 'image/png')).toEqual({ width: 64, height: 48 });
    expect(imageDimensions(text('GIF89a\u0003\u0000\u0002\u0000'), 'image/gif')).toEqual({
      width: 3,
      height: 2,
    });
    expect(imageDimensions(jpeg(300, 200), 'image/jpeg')).toEqual({ width: 300, height: 200 });
    expect(imageDimensions(webpVp8x(1920, 1080), 'image/webp')).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(imageDimensions(tinyMp4(), 'video/mp4')).toBeUndefined();
    expect(imageDimensions(bytes(0xff, 0xd8, 0xff), 'image/jpeg')).toBeUndefined();
  });
});
