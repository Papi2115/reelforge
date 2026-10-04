import { describe, expect, it } from 'vitest';
import { kitCatalogMarkdown, schemaType } from './catalog-markdown.js';
import { kitCatalog } from './kit.js';

describe('kitCatalogMarkdown', () => {
  it('documents every prop with its thumbnail, params, anchors and methods', () => {
    const catalog = kitCatalog();
    const markdown = kitCatalogMarkdown(catalog, {
      thumbnails: { calculator: 'kit-catalog/calculator.png' },
    });
    for (const entry of catalog.props)
      expect(markdown).toContain(`### \`kit.props.${entry.name}(params)\``);
    expect(markdown).toContain('![calculator](kit-catalog/calculator.png)');
    expect(markdown).toContain(
      '| `screen` | "blank" \\| "text" \\| "doom" \\| "glitch" | `"text"` |',
    );
    expect(markdown).toContain('- `screen.glitch(amount)`: glitch overlay 0..1');
    expect(markdown).toContain('- `keypad`: centre of the keypad');
    expect(markdown).toContain('### `kit.env.neonGrid(params)`');
    expect(markdown).toContain('| `fromGrid(');
    expect(markdown).toContain('## Characters (`kit.cast`)');
    for (const entry of catalog.cast)
      expect(markdown).toContain(`### \`kit.cast.${entry.name}(params)\``);
    expect(markdown.endsWith('\n')).toBe(true);
  });

  it('formats JSON Schema types compactly', () => {
    expect(schemaType({ type: 'array', items: { type: 'number' } })).toBe('number[]');
    expect(
      schemaType({ type: 'array', prefixItems: [{ type: 'number' }, { type: 'number' }] }),
    ).toBe('[number, number]');
    expect(schemaType({ anyOf: [{ type: 'number' }, {}] })).toBe('number | function | value');
    expect(schemaType({ type: 'integer' })).toBe('integer');
  });
});
