/**
 * Settings → Performance → "Appearance" → "Pixel titles" (PLAN.md#13.12, U13), on by default: panel,
 * step, section and dialog titles in the pixel face of the engine's display font
 * (fonts/pixel-titles.css). `useTitleFont` applies the choice to <html> as soon as the settings load.
 */
import { useEffect, useState, type JSX } from 'react';
import type { PageProps } from './GeneralSettings.js';
import { titleSizes } from './title-font.js';

export const PIXEL_TITLES_LABEL = 'Pixel titles';

export const PIXEL_TITLES_HINT =
  'Panel, step and dialog titles in the pixel font of your films. Off: plain system text everywhere.';

/**
 * `data-title-font` on <html> (`system` switches the pixel face off, fonts/pixel-titles.css) and
 * the face's sizes for the current display scaling, updated when the window moves to another
 * display or the zoom changes.
 */
export function useTitleFont(pixelTitles: boolean | undefined): void {
  useEffect(() => {
    if (pixelTitles === undefined) return;
    document.documentElement.setAttribute('data-title-font', pixelTitles ? 'pixel' : 'system');
  }, [pixelTitles]);
  const [ratio, setRatio] = useState(() => window.devicePixelRatio);
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${String(ratio)}dppx)`);
    const onChange = (): void => {
      setRatio(window.devicePixelRatio);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [ratio]);
  useEffect(() => {
    const sizes = titleSizes(ratio);
    const root = document.documentElement.style;
    root.setProperty('--title-size-small', `${String(sizes.small)}px`);
    root.setProperty('--title-size-large', `${String(sizes.large)}px`);
  }, [ratio]);
}

export function PixelTitles({ state, update }: PageProps): JSX.Element {
  return (
    <>
      <h3 className="settings-heading">Appearance</h3>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={state.settings.ui.pixelTitles}
          onChange={(event) => {
            update({ ui: { pixelTitles: event.target.checked } });
          }}
        />
        <span>
          <strong>{PIXEL_TITLES_LABEL}</strong>
          <span className="muted">{PIXEL_TITLES_HINT}</span>
        </span>
      </label>
    </>
  );
}
