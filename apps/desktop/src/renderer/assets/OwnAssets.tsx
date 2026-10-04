/**
 * "Your files" in the Assets dialog (PLAN.md#12.12): "Add my assets…" (main's file picker) and a
 * drop zone for images and videos, the list of the user's own files with thumbnails, a description
 * Claude reads (Describe), "Save to library" (PLAN.md#12.19) and Remove (asks first). Every control
 * is a native button, checkbox or form field (keyboard: Tab, Space, Enter, Escape cancels an edit).
 */
import { useState, type DragEvent, type JSX } from 'react';
import type { AssetView } from '../../shared/assets-contract.js';
import { projectMediaUrl } from '../../shared/player-contract.js';
import { droppedMedia, ownAssetMeta } from './assets-view.js';
import type { AssetsController } from './use-assets.js';

export function LibraryToggle(props: {
  readonly asset: AssetView;
  readonly busy: boolean;
  readonly onToggle: (save: boolean) => void;
}): JSX.Element {
  return (
    <label
      className="asset-library-toggle"
      title="Keep a copy in your asset library, so other projects can use it without downloading it again"
    >
      <input
        type="checkbox"
        checked={props.asset.inLibrary}
        disabled={props.busy}
        onChange={(event) => {
          props.onToggle(event.target.checked);
        }}
      />
      <span>Save to library</span>
    </label>
  );
}

function DescribeForm(props: {
  readonly asset: AssetView;
  readonly onSave: (title: string, description: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [title, setTitle] = useState(props.asset.title);
  const [description, setDescription] = useState(props.asset.description);
  return (
    <form
      className="own-asset-form"
      aria-label={`Describe ${props.asset.title}`}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave(title, description);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          props.onCancel();
        }
      }}
    >
      <label className="field">
        <span>Title</span>
        <input
          value={title}
          maxLength={200}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </label>
      <label className="field">
        <span>What it shows (Claude reads this)</span>
        <textarea
          value={description}
          maxLength={500}
          rows={2}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </label>
      <div className="asset-actions">
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" className="small-button" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function OwnAssetRow(props: {
  readonly asset: AssetView;
  readonly busy: boolean;
  readonly run: (action: () => Promise<{ message: string | null }>) => void;
  readonly controller: AssetsController;
}): JSX.Element {
  const { asset, controller } = props;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="asset-row own-asset-row">
      {asset.image === null ? (
        <span className="asset-thumb-small asset-thumb-missing">{asset.kind}</span>
      ) : (
        <img className="asset-thumb-small" src={projectMediaUrl(asset.image, 0)} alt="" />
      )}
      <span className="asset-row-text">
        {editing ? (
          <DescribeForm
            asset={asset}
            onCancel={() => {
              setEditing(false);
            }}
            onSave={(title, description) => {
              setEditing(false);
              props.run(() => controller.edit({ id: asset.id, title, description }));
            }}
          />
        ) : (
          <>
            <span className="asset-title">{asset.title}</span>
            <span className="asset-meta muted">
              <span className="mono">{asset.id}</span> · {ownAssetMeta(asset)}
            </span>
            <span className="own-asset-description">
              {asset.description === '' ? 'No description yet.' : asset.description}
            </span>
          </>
        )}
      </span>
      {!editing && (
        <span className="own-asset-actions">
          <LibraryToggle
            asset={asset}
            busy={props.busy}
            onToggle={(save) => {
              props.run(() => controller.setInLibrary(asset.id, save));
            }}
          />
          <button
            type="button"
            className="small-button"
            aria-label={`Describe ${asset.title}`}
            onClick={() => {
              setEditing(true);
            }}
          >
            Describe
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                className="small-button danger"
                aria-label={`Remove ${asset.title} from this project`}
                onClick={() => {
                  setConfirming(false);
                  props.run(() => controller.remove(asset.id));
                }}
              >
                Remove it
              </button>
              <button
                type="button"
                className="small-button"
                onClick={() => {
                  setConfirming(false);
                }}
              >
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              className="small-button"
              aria-label={`Remove ${asset.title}`}
              title="Remove it from this project (your original file is not touched)"
              onClick={() => {
                setConfirming(true);
              }}
            >
              Remove
            </button>
          )}
        </span>
      )}
    </li>
  );
}

export interface OwnAssetsProps {
  readonly assets: readonly AssetView[];
  readonly controller: AssetsController;
  readonly busy: boolean;
  /** Runs an action and shows its message. */
  readonly run: (action: () => Promise<{ message: string | null }>) => void;
  readonly onNotice: (message: string) => void;
}

export function OwnAssets({
  assets,
  controller,
  busy,
  run,
  onNotice,
}: OwnAssetsProps): JSX.Element {
  const [dragging, setDragging] = useState(false);
  const onDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragging(false);
    const paths = window.reelforge.droppedFilePaths([...event.dataTransfer.files]);
    const { accepted, skipped } = droppedMedia(paths);
    if (accepted.length === 0) {
      onNotice('Drop images or videos: PNG, JPG, WebP, GIF, MP4 or WebM.');
      return;
    }
    run(async () => {
      const result = await controller.importFiles(accepted);
      const note =
        skipped > 0
          ? ` ${String(skipped)} other file${skipped === 1 ? ' was' : 's were'} skipped.`
          : '';
      return { message: `${result.message ?? ''}${note}`.trim() };
    });
  };
  return (
    <section
      className={`own-assets${dragging ? ' own-assets-dragging' : ''}`}
      aria-label="Your files"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setDragging(true);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="own-assets-heading">
        <h3 className="section-title">Your files</h3>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => {
            run(() => controller.importFiles());
          }}
        >
          Add my assets…
        </button>
      </div>
      <p className="muted own-assets-hint">
        Add your photos, logos, screenshots and clips (PNG, JPG, WebP, GIF, MP4, WebM) or drop them
        here. They stay on this computer; the storyboard uses them as B-roll, also with research
        Off.
      </p>
      {assets.length === 0 ? (
        <p className="muted">No files of yours in this project yet.</p>
      ) : (
        <ul className="asset-list" aria-label="Your files in this project">
          {assets.map((asset) => (
            <OwnAssetRow
              key={asset.id}
              asset={asset}
              busy={busy}
              run={run}
              controller={controller}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
