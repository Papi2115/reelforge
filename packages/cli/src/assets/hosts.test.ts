import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bannedReason, blockedAddressReason, hostMatches } from './hosts.js';

describe('bannedReason', () => {
  it('bans video platforms, social networks, paid stock and sign-in hosts in every form', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=x',
      'https://m.youtube.com/shorts/x',
      'https://youtu.be/x',
      'https://rr3---sn-abc.googlevideo.com/videoplayback',
      'https://i.ytimg.com/vi/x/hqdefault.jpg',
      'https://player.vimeo.com/video/1',
      'https://www.netflix.com/title/1',
      'https://www.tiktok.com/@a/video/1',
      'https://scontent.cdninstagram.com/x.jpg',
      'https://www.gettyimages.com/photos/x',
      'https://login.example.com/x.png',
      'https://example.com/account/login?next=/x.png',
      'https://example.com/stream/master.m3u8',
      'https://YOUTUBE.COM./x',
    ]) {
      expect(bannedReason(new URL(url)), url).toBeDefined();
    }
  });

  it('lets ordinary open-licence hosts through', () => {
    for (const url of [
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/x.png',
      'https://images-assets.nasa.gov/image/x/x~large.jpg',
      'https://ia800204.us.archive.org/0/items/x/x.mp4',
      'https://notyoutube.com/x.png',
    ]) {
      expect(bannedReason(new URL(url)), url).toBeUndefined();
    }
  });

  it('matches whole domain labels only', () => {
    expect(hostMatches('upload.wikimedia.org', 'wikimedia.org')).toBe(true);
    expect(hostMatches('evilwikimedia.org', 'wikimedia.org')).toBe(false);
  });
});

describe('blockedAddressReason (SSRF)', () => {
  it('blocks loopback, private, link-local, metadata, CGNAT, multicast and IPv6 equivalents', () => {
    for (const address of [
      '127.0.0.1',
      '127.8.9.10',
      '10.0.0.1',
      '172.16.5.4',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::1',
      '::',
      'fe80::1',
      'fd00::1',
      'fc00::1',
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
      'fd00:ec2::254',
    ]) {
      expect(blockedAddressReason(address), address).toBeDefined();
    }
  });

  it('allows public addresses', () => {
    for (const address of ['93.184.216.34', '172.32.0.1', '8.8.8.8', '2606:4700::1111']) {
      expect(blockedAddressReason(address), address).toBeUndefined();
    }
  });
});

describe('the asset layer never starts processes', () => {
  it('no module under src/assets imports child_process or spawns anything', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
      );
    const sources = walk(import.meta.dirname).filter(
      (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
    );
    expect(sources.length).toBeGreaterThan(10);
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(
        /child_process|(?<![.\w])(?:spawn|execFile|exec|fork)\(|yt-dlp|youtube-dl/,
      );
    }
  });
});
