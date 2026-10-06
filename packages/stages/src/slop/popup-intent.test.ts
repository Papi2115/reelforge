import { describe, expect, it } from 'vitest';
import {
  genericIntent,
  popupIntentFindings,
  popupSpecs,
  repeatedPopupFindings,
} from './popup-intent.js';
import { parseScene } from './source-text.js';

function program(body: string) {
  const parsed = parseScene(`const CLAIM = 'the dancers multiply day by day';
export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540] });
${body}
  return { page };
}`);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

const messages = (body: string): string[] =>
  popupIntentFindings(program(body), 'scenes/s07.js').map((entry) => entry.message);

describe('pop-up intents', () => {
  it('reads the intent (also through a const) and the mechanism the pull moves', () => {
    const specs = popupSpecs(
      program(`  page.popup({ intent: CLAIM, elements: [{ kind: 'flap', id: 'door' }, { kind: 'counter', id: 'n' }], pull: { at: 2, motions: [{ target: 'door', to: { open: 1 } }, { target: 'n', to: { value: 400 } }] } });
  page.popup({ elements: [], pull: { at: 1, drive: (p) => ({}) } });
  page.popup({ intent: 'x', elements: [] });`),
    );
    expect(specs).toEqual([
      {
        intent: 'the dancers multiply day by day',
        mechanism: 'counter.value + flap.open',
        line: 4,
      },
      { intent: undefined, mechanism: 'drive', line: 5 },
      { intent: 'x', mechanism: undefined, line: 6 },
    ]);
  });

  it('warns about a missing or generic intent, not a claim', () => {
    expect(messages(`  page.popup({ elements: [] });`)[0]).toContain('pop-up without an intent');
    expect(messages(`  page.popup({ intent: 'the reveal', elements: [] });`)[0]).toContain(
      'generic pop-up intent "the reveal"',
    );
    expect(messages(`  page.popup({ intent: CLAIM, elements: [] });`)).toEqual([]);
    expect(genericIntent('pop-up answer')).toBe(true);
    expect(genericIntent('the water level rises with the deaths')).toBe(false);
  });

  it('warns when a pop-up repeats an earlier intent or mechanism of the film', () => {
    const spec = (intent: string, mechanism?: string) => ({ intent, mechanism, line: 3 });
    const found = repeatedPopupFindings([
      { shotId: 's03', popups: [spec('the dancers multiply day by day', 'window.index')] },
      { shotId: 's07', popups: [spec('dancers multiply every day')] },
      { shotId: 's09', popups: [spec('the shrine opens to the pilgrims', 'window.index')] },
      { shotId: 's11', popups: [spec('the heat rises in the city', 'gauge.level')] },
    ]);
    expect([...found.keys()]).toEqual(['s07', 's09']);
    expect(found.get('s07')?.[0]?.message).toContain('pop-up repeats s03 (same intent');
    expect(found.get('s09')?.[0]?.message).toContain('same mechanism "window.index"');
  });
});
