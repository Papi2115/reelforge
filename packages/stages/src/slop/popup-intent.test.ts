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
  it('reads the intent (also through a const) and the mechanism of every pop-up', () => {
    const specs = popupSpecs(
      program(`  page.popup({ intent: CLAIM, elements: [], pull: { at: 2, mechanism: 'slider' } });
  page.popup({ elements: [], motion: 'flap' });`),
    );
    expect(specs).toEqual([
      { intent: 'the dancers multiply day by day', mechanism: 'slider', line: 4 },
      { intent: undefined, mechanism: 'flap', line: 5 },
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
      { shotId: 's03', popups: [spec('the dancers multiply day by day', 'slider')] },
      { shotId: 's07', popups: [spec('dancers multiply every day')] },
      { shotId: 's09', popups: [spec('the shrine opens to the pilgrims', 'slider')] },
      { shotId: 's11', popups: [spec('the heat rises in the city', 'thermometer')] },
    ]);
    expect([...found.keys()]).toEqual(['s07', 's09']);
    expect(found.get('s07')?.[0]?.message).toContain('pop-up repeats s03 (same intent');
    expect(found.get('s09')?.[0]?.message).toContain('same mechanism "slider"');
  });
});
