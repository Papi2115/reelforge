/**
 * Look `retro-ui` (PLAN.md#12.2): retro-OS windows, terminal, browser, documents (newspaper,
 * dossier, memo) and CRT screens, painted as pixel-art panels (palette-role canvases on unlit
 * nearest-filtered planes) in front of the `retroDesktop` backdrop. Everything is a pure function
 * of t and goes through the Style's post-fx like every other look.
 */
import { defineLook } from '../types.js';
import { retroBrowser } from './browser.js';
import { retroCrt } from './crt.js';
import { retroDesktop } from './desktop.js';
import { retroDocument } from './document.js';
import { retroTerminal } from './terminal.js';
import { retroWindow } from './window.js';

const DOCS = `Look \`retro-ui\` (B and C rolls): proof on a screen or on paper. Pixel-art panels (UI pixels on flat planes) in front of \`kit.env.retroDesktop\`. Every template has \`update(t)\` (call it every frame) and \`fitDistance(px = 2)\`; all timing is params (pass local times such as \`ctx.anchor('word').t\`).

Pick one hero template per shot:
- \`kit.props.retroWindow\`: dialog/error (\`content: 'dialog'\`, \`click\` presses OK), progress bar (\`fillStart/fillEnd\` on the spoken words), file icons, text, dithered image; \`stack: 1-2\` = many windows; \`open\`/\`close\` zoom.
- \`kit.props.retroTerminal\`: commands and logs; \`lines: [{ text, input: true, at }]\` typed at \`cps\`, output lines print, \`tone: 'alert'\` for errors.
- \`kit.props.retroBrowser\`: "it was online": \`typeAt\` types the URL, \`loadAt\` loads the page (interlaced photo), headline + photo + hit counter.
- \`kit.props.retroDocument\`: \`newspaper\` (masthead, headline, halftone photo), \`dossier\` (mugshot, fields with \`redactAt\` bars), \`memo\`; \`stamp: { text, at }\` slams on.
- \`kit.props.retroCrt\`: monitor/TV casing or bare tube; \`crt.show(child)\` shows a template through the tube (child built with \`frame: 'none'\` for terminals); \`tint: 'green' | 'amber'\` phosphor, \`powerOn\`/\`powerOff\`.
- \`kit.env.retroDesktop\`: \`os\` desktop (menu bar, icons, synthwave wallpaper) or \`desk\` (dark wall + voxel desk: \`crt.on(env, { at: 'desk' })\`, add \`kit.env.lights()\`).

Composition: the hero fills 50-80 % of the frame, at most one more template beside/behind it; desktop at z = 0, templates at z = 0.02, 0.04 (never further: parallax breaks the pixel grid); one \`pixel\` value for all. Colours are fixed by the look (accents: violet, teal, orange, pink, green).

Camera: frontal. Text beats: hold at \`d = hero.fitDistance(2)\` (1 UI px = 2 frame px; a 320x180 UI fills the frame) with \`ctx.camera.set({ position: [x, y, d], target: [x, y, 0], fov: 50 })\`; slide with \`ctx.camera.dolly\` moving start/end and target/targetEnd together (keeps pixels crisp). Push in from \`fitDistance(2)\` to \`fitDistance(3)\` in <= 0.6 s, then hold; no slow zooms or orbits over text. A CRT on the desk may crane/orbit <= 15 degrees.

Marks and annotations: \`marks: [{ text, at }]\` highlights a phrase (marker on paper, inverse video in terminals) and adds anchor \`mark:<text>\`. Point \`ctx.annotate\` at \`{ object, anchor }\`: \`title\`, \`close\`, \`button\`, \`bar\`, \`line:<i>\`, \`cursor\`, \`url\`, \`headline\`, \`photo\`, \`stamp\`, \`field:<i>\`, \`icon:<i>\`, \`clock\`; a CRT passes its child's anchors through (target the CRT). In-world text is the kit's caps pixel font: keep claims short (<= 28 characters a line); the shot's title or source goes in \`ctx.text\`.`;

export const retroUiLook = defineLook({
  id: 'retro-ui',
  label: 'Retro UI / CRT',
  description:
    'retro-OS windows, terminals, browsers, documents and CRT screens with scanlines (proof on a screen or on paper)',
  rolls: ['B', 'C'],
  treatments: ['ui-mockup', 'kinetic-text', 'title-card', 'montage/transition'],
  docs: DOCS,
  soundPalette: 'retro-ui',
  variationBudget: 'retro-ui',
  available: true,
  kit: {
    env: [retroDesktop],
    templates: [retroWindow, retroTerminal, retroBrowser, retroDocument, retroCrt],
  },
});
