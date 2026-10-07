import { describe, expect, it } from 'vitest';
import { EscapeLayers } from './escape-layers.js';

describe('EscapeLayers', () => {
  it('lets only the newest open dialog react to Esc', () => {
    const layers = new EscapeLayers();
    const settings = layers.push();
    expect(layers.isTop(settings)).toBe(true);
    const shortcuts = layers.push();
    expect(layers.isTop(settings)).toBe(false);
    expect(layers.isTop(shortcuts)).toBe(true);
    layers.remove(shortcuts);
    expect(layers.isTop(settings)).toBe(true);
  });

  it('keeps the order when a lower dialog closes first', () => {
    const layers = new EscapeLayers();
    const first = layers.push();
    const second = layers.push();
    layers.remove(first);
    expect(layers.isTop(second)).toBe(true);
    layers.remove(first);
    layers.remove(second);
    expect(layers.isTop(second)).toBe(false);
  });
});
