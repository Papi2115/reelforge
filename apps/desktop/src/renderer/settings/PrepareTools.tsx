/**
 * First-run "Prepare tools" step (optional, skippable): is ffmpeg there, is whisper.cpp with the
 * chosen model installed — with the same one-click install as Settings → Tools (Words timed also
 * offers it later, when it is needed).
 */
import { useEffect, useState, type JSX } from 'react';
import type { FfmpegStatus } from '../../shared/settings-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { approxSize } from '../stages/words-setup.js';
import { useWhisperSetup } from './use-whisper-setup.js';
import { DownloadConfirm, InstallProgress } from './WhisperSetup.js';

const log = rendererLog('prepare-tools');

function Row(props: {
  readonly ok: boolean | undefined;
  readonly title: string;
  readonly children: JSX.Element | string;
}): JSX.Element {
  const tone = props.ok === undefined ? 'action' : props.ok ? 'ok' : 'error';
  return (
    <div className="prepare-row">
      <span className={`connect-dot tone-${tone}`} aria-hidden="true" />
      <div className="prepare-row-body">
        <p className="connect-headline">{props.title}</p>
        <div className="connect-detail">{props.children}</div>
      </div>
    </div>
  );
}

export function PrepareTools(): JSX.Element {
  const [ffmpeg, setFfmpeg] = useState<FfmpegStatus | undefined>(undefined);
  const whisper = useWhisperSetup();
  useEffect(() => {
    window.reelforge.getToolsStatus(false).then(
      (status) => {
        setFfmpeg(status.ffmpeg);
      },
      (reason: unknown) => {
        log.error(`getToolsStatus failed: ${errorMessage(reason)}`);
      },
    );
  }, []);
  const readiness = whisper.view.state?.readiness;
  const progress = whisper.view.progress;
  const running = progress?.phase === 'running';
  return (
    <div className="prepare-tools" aria-label="Tools">
      <Row ok={ffmpeg === undefined ? undefined : ffmpeg.status === 'found'} title="ffmpeg">
        {ffmpeg === undefined
          ? 'Looking for ffmpeg…'
          : ffmpeg.status === 'found'
            ? `Found: ffmpeg ${ffmpeg.version} (${ffmpeg.license}).`
            : 'Not found. Install ffmpeg (a build with libx264) and choose it in Settings → Tools; audio cleaning, mixing and export need it.'}
      </Row>
      <Row ok={readiness?.ready} title="whisper.cpp (word timing)">
        {readiness === undefined ? (
          'Checking…'
        ) : readiness.ready ? (
          `Installed, with the ${readiness.model} model.`
        ) : (
          <>
            <p>
              Times every spoken word. Downloaded once from the official sources (
              {approxSize(readiness.bytes)}
              ), checked against published hashes.
            </p>
            {!running && (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  whisper.request({ kind: 'setup' }, readiness.bytes);
                }}
              >
                Download whisper.cpp ({approxSize(readiness.bytes)})
              </button>
            )}
          </>
        )}
      </Row>
      {progress !== undefined && <InstallProgress progress={progress} onCancel={whisper.cancel} />}
      <p className="muted">
        Optional: you can also do this later in Settings → Tools, or when Words timed first needs
        it.
      </p>
      <DownloadConfirm setup={whisper} />
    </div>
  );
}
