/**
 * Sketchbook guards from real run Sketchbook 4: a pop-up whose intent describes a motion or a
 * subject the card does not have (s05), red used for labels or too often (s05, s06, s12), and an
 * invented struck-out word (s11 "fact").
 */
import { describe, expect, it } from 'vitest';
import { parseScene } from '../slop/source-text.js';
import { buildVocabulary } from '../slop/vocabulary.js';
import { popupClaimFindings, redInkFindings, sketchbookSourceChecks } from './index.js';

const NARRATION =
  'On Martinmas the pig was slaughtered and salted. Historians debate the idea of a second sleep. The water level rises.';
const VOCABULARY = buildVocabulary([NARRATION]);

function program(body: string) {
  const parsed = parseScene(`export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540], stock: 'cartridge' });
  ctx.scene.add(page);
${body}
  return { page };
}`);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

const popupMessages = (body: string): string[] =>
  popupClaimFindings(program(body), 'scenes/s05.js').map((entry) => entry.message);
const redMessages = (body: string): string[] =>
  redInkFindings(program(body), 'scenes/s11.js', VOCABULARY).map((entry) => entry.message);

const S05 = `  page.use('pig', { x: 420, y: 330, h: 60 });
  page.use('salt-barrel', { x: 520, y: 330, h: 60 });
  page.popup({ intent: 'on Martinmas the pig is slaughtered: the ribbon swings the flap open on the pig and the salt barrel',
    elements: [{ kind: 'flap', id: 'veil', u: 200, v: 40, text: 'NOV' }, { kind: 'card', u: 200, v: 40, text: 'SLAUGHTERED', paper: 'sticky' }],
    pull: { at: 2.6, tab: 'ribbon', motions: [{ target: 'veil', to: { open: 1 } }] } });`;

describe('pop-up intent vs the card', () => {
  it('flags the real-run s05: the intent names the pig and the barrel, the card carries a word', () => {
    const [message, ...rest] = popupMessages(S05);
    expect(rest).toEqual([]);
    expect(message).toBe(
      "pop-up intent names pig, salt-barrel but no piece of the card carries them (scenes/s05.js:6): put the subject on a moving piece ({ kind: 'cutout', id, asset: 'pig' }) so the pull moves what the intent says, or rewrite the intent.",
    );
  });

  it('accepts the subject on a piece (asset id or its words)', () => {
    const fixed = S05.replace("text: 'SLAUGHTERED', paper: 'sticky'", "asset: 'pig'").replace(
      "text: 'NOV'",
      "text: 'SALT BARREL'",
    );
    expect(popupMessages(fixed)).toEqual([]);
  });

  it('flags a motion word the pulled piece cannot make', () => {
    const body = `  page.popup({ intent: 'the water level rises with every storm of the winter',
    elements: [{ kind: 'flap', id: 'door', u: 100, v: 30 }, { kind: 'gauge', id: 'tube', u: 200, v: 10 }],
    pull: { at: 2.6, motions: [{ target: 'door', to: { open: 1 } }] } });`;
    expect(popupMessages(body)).toEqual([
      'pop-up intent says "rises" but the pull only moves flap.open (scenes/s05.js:4): bind the pull to a piece that rise / fill / grows (gauge.level, block.rise, cutout.rise, counter.value, card.y, scale.value) or say in the intent what really moves.',
    ]);
    expect(
      popupMessages(
        body.replace("target: 'door', to: { open: 1 }", "target: 'tube', to: { level: 0.9 }"),
      ),
    ).toEqual([]);
    expect(
      popupMessages(
        body.replace("motions: [{ target: 'door', to: { open: 1 } }]", 'drive: (p) => ({})'),
      ),
    ).toEqual([]);
  });
});

describe('the red pen', () => {
  it('flags an invented word struck out (s11 "fact"), by literal box, shared variables or order', () => {
    const literal = `  page.write('fact', { x: 300, y: 200, size: 30, tool: 'pencil' });
  page.crossOut(296, 172, 70, 34, { tool: 'red', style: 'strike' });
  page.write('debated', { x: 300, y: 250, size: 30, tool: 'red' });`;
    expect(redMessages(literal)).toEqual([
      'struck-out "fact" (scenes/s11.js:4) is not in the narration or research (fact): a correction strikes a wrong idea the film really names; strike that, or drop the correction.',
    ]);
    const shared = `  const s = page.slots();
  page.write('debate', { ...s.label, at: 1 });
  page.write('fact', { ...s.note, at: 2 });
  page.crossOut(s.note.x - 4, s.note.y - 20, 80, 30, { tool: 'red' });`;
    expect(redMessages(shared)).toEqual([expect.stringContaining('struck-out "fact"')]);
    const sourced = literal.replace("'fact'", "'second sleep'");
    expect(redMessages(sourced)).toEqual([]);
  });

  it('allows one red word on the point, flags a second one as a label', () => {
    const point = "  page.write('second sleep', { x: 600, y: 120, size: 40, tool: 'red' });";
    expect(redMessages(point)).toEqual([]);
    const label = "  page.write('POTTAGE', { x: 200, y: 420, size: 30, tool: 'red' });";
    expect(redMessages(`${point}\n${label}`)).toEqual([
      'second red word "POTTAGE" on one page (scenes/s11.js:5): red marks only the one point of the page (the correction or the key number); write labels in felt-tip or marker.',
    ]);
  });

  it('flags more than three red marks on one page (s05: a loop and three ticks)', () => {
    const marks = [
      "  page.loop(500, 200, 90, 60, { tool: 'red' });",
      "  page.stroke([1, 2, 3, 4], { tool: 'red' });",
      "  page.stroke([5, 6, 7, 8], { tool: 'red' });",
      "  page.stroke([9, 9, 7, 7], { tool: 'red' });",
    ];
    expect(redMessages(marks.slice(0, 3).join('\n'))).toEqual([]);
    expect(redMessages(marks.join('\n'))).toEqual([
      '4 red marks on one page (scenes/s11.js:4, 5, 6, 7): red is the correction pen, one correction on the point per page; draw the rest in felt-tip, ballpoint or pencil.',
    ]);
  });

  it('runs both checks as the Sketchbook source checks', () => {
    const body = `${S05}\n  page.write('SALTED', { x: 600, y: 120, tool: 'red' });\n  page.write('NOV', { x: 90, y: 90, tool: 'red' });`;
    const found = sketchbookSourceChecks(program(body), 'scenes/s05.js', VOCABULARY);
    expect(found.map((entry) => [entry.source, entry.severity])).toEqual([
      ['slop', 'warning'],
      ['slop', 'warning'],
    ]);
  });
});
