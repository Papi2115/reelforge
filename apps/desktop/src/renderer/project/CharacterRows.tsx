/**
 * Project settings → Characters and Mascot (PLAN.md#12.20, ADR-025): the character style (pack or
 * the classic hoodie hero) and the film's mascot, as radio groups (arrow keys move the choice).
 * The mascot cards show the pack's preview sheet and are disabled with the classic hero.
 */
import { useId, type JSX } from 'react';
import {
  CHARACTER_CHOICES,
  CHARACTERS_NOTE,
  MASCOT_CLASSIC_NOTE,
  MASCOT_NOTE,
  MASCOT_SHEET_SIZE,
  mascotCards,
  type SpriteCrop,
} from './character-settings-view.js';
import mascotSheet from './mascots.png';
import { SettingRow, type RowProps } from './SettingRow.js';

export function CharactersRow({ settings, update }: RowProps): JSX.Element {
  const name = useId();
  return (
    <SettingRow title="People in the film" note={CHARACTERS_NOTE}>
      {(labelId) => (
        <div className="project-setting-choices" role="radiogroup" aria-labelledby={labelId}>
          {CHARACTER_CHOICES.map((choice) => (
            <label key={choice.value} className="settings-toggle">
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={settings.characters === choice.value}
                onChange={() => {
                  update({ characters: choice.value });
                }}
              />
              <span>
                <strong>{choice.title}</strong>
                <span className="muted">{choice.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </SettingRow>
  );
}

/** A mascot's crop of the preview sheet, at 1:1 so its pixels stay crisp. */
function MascotPreview({ crop }: { readonly crop: SpriteCrop | undefined }): JSX.Element {
  if (crop === undefined) {
    return (
      <span className="mascot-preview mascot-preview-none" aria-hidden="true">
        —
      </span>
    );
  }
  return (
    <span
      className="mascot-preview"
      aria-hidden="true"
      style={{
        width: `${String(crop.width)}px`,
        height: `${String(crop.height)}px`,
        backgroundImage: `url(${mascotSheet})`,
        backgroundSize: `${String(MASCOT_SHEET_SIZE.width)}px ${String(MASCOT_SHEET_SIZE.height)}px`,
        backgroundPosition: `-${String(crop.x)}px -${String(crop.y)}px`,
      }}
    />
  );
}

export function MascotRow({ settings, update }: RowProps): JSX.Element {
  const name = useId();
  const cards = mascotCards(settings);
  const classic = settings.characters !== 'pack';
  return (
    <SettingRow title="Mascot of this film" note={MASCOT_NOTE}>
      {(labelId) => (
        <>
          {classic && <p className="mascot-classic-note">{MASCOT_CLASSIC_NOTE}</p>}
          <div
            className="mascot-cards"
            role="radiogroup"
            aria-labelledby={labelId}
            aria-disabled={classic}
          >
            {cards.map((card) => (
              <label
                key={card.value}
                className={`settings-toggle mascot-card${card.disabled ? ' is-disabled' : ''}`}
              >
                <input
                  type="radio"
                  name={name}
                  value={card.value}
                  checked={card.checked}
                  disabled={card.disabled}
                  onChange={() => {
                    update({ mascot: card.value });
                  }}
                />
                <MascotPreview crop={card.crop} />
                <span className="mascot-card-text">
                  <strong>{card.title}</strong>
                  <span className="muted">{card.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </SettingRow>
  );
}
