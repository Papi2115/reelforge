/**
 * Look `retro-ui` (PLAN.md#12.2, not built yet): retro-OS windows, terminal, browser,
 * documents/newspaper/files, CRT screens. Registration point: add the kit definitions to `kit`,
 * write `docs`, then flip `available` to true — nothing outside this folder needs an edit.
 */
import { defineLook } from '../types.js';

export const retroUiLook = defineLook({
  id: 'retro-ui',
  label: 'Retro UI / CRT',
  description:
    'retro-OS windows, terminals, browsers, documents and CRT screens with scanlines (proof on a screen or on paper)',
  rolls: ['B', 'C'],
  treatments: ['ui-mockup', 'kinetic-text', 'title-card'],
  docs: 'Look `retro-ui` is not available yet (PLAN.md#12.2).',
  soundPalette: 'retro-ui',
  variationBudget: 'retro-ui',
  available: false,
  kit: {},
});
