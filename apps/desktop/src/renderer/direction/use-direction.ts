/**
 * Live co-direction state of the open project (PLAN.md#12.14): directions.json from main, the
 * session's command history, and `submit(command)`: parse locally (instant), refuse locked shots,
 * write through main (atomic + commit); the preview swaps the direction in when the watcher sees
 * directions.json change. Commands Claude must do become an offer to rebuild the shot as variants.
 */
import {
  directedShotIds,
  parseDirectionCommand,
  type DirectionsFile,
  type ShotDirection,
  type TimedWord,
} from '@reelforge/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../log.js';
import {
  claudeOffer,
  EMPTY_SESSION,
  lockedStatus,
  markUndone,
  pushEntry,
  redoTarget,
  undoTarget,
  type BarStatus,
  type DirectionSession,
} from './direction-view.js';

interface ShotSpan {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
}

export interface UseDirectionOptions {
  readonly shots: readonly ShotSpan[];
  readonly words: readonly TimedWord[];
  /** Film time of the playhead at the moment of the call. */
  readonly getTime: () => number;
  /** Last point clicked in the preview (normalized), if any. */
  readonly point: { readonly x: number; readonly y: number } | null;
  readonly locked: ReadonlySet<string>;
  /** Advances when the project's video inputs changed (re-reads directions.json). */
  readonly revision: number;
  /** Starts a Claude rebuild of the shot as variants with `request` as the note. */
  readonly rebuildWithClaude: (shotId: string, request: string) => Promise<string | undefined>;
  /** Unlocks the shot; true when it worked. */
  readonly unlock: (shotId: string) => Promise<boolean>;
}

export interface DirectionControls {
  readonly directions: DirectionsFile | undefined;
  readonly directed: ReadonlySet<string>;
  readonly session: DirectionSession;
  readonly status: BarStatus;
  readonly busy: boolean;
  submit(command: string): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  clear(shotId: string): Promise<void>;
  acceptClaude(): Promise<void>;
  unlockAndRetry(): Promise<void>;
  dismiss(): void;
}

type Applied = 'ok' | 'failed';

export function useDirection(options: UseDirectionOptions): DirectionControls {
  const { shots, revision } = options;
  const [directions, setDirections] = useState<DirectionsFile | undefined>(undefined);
  const [session, setSession] = useState<DirectionSession>(EMPTY_SESSION);
  const [status, setStatus] = useState<BarStatus>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const latest = useRef(options);
  latest.current = options;
  const lastCommand = useRef<string | undefined>(undefined);

  useEffect(() => {
    let stale = false;
    window.reelforge.getDirections().then(
      (state) => {
        if (stale) return;
        if (state.status === 'ok') setDirections(state.directions);
        else setStatus({ kind: 'error', text: state.message });
      },
      (error: unknown) => {
        if (!stale) setStatus({ kind: 'error', text: errorMessage(error) });
      },
    );
    return () => {
      stale = true;
    };
  }, [revision]);

  const write = useCallback(
    async (
      shotId: string,
      next: ShotDirection | undefined,
      command: string,
      confirmation: string,
    ): Promise<Applied> => {
      if (latest.current.locked.has(shotId)) {
        setStatus(lockedStatus(shotId));
        return 'failed';
      }
      const started = performance.now();
      setBusy(true);
      try {
        const result = await window.reelforge.applyDirection({
          shotId,
          next: next ?? null,
          command,
        });
        if (result.status === 'ok') {
          setDirections(result.directions);
          setStatus({ kind: 'applied', text: confirmation, ms: performance.now() - started });
          return 'ok';
        }
        setStatus(
          result.status === 'locked'
            ? lockedStatus(result.shotId, result.message)
            : { kind: 'error', text: result.message },
        );
        return 'failed';
      } catch (error) {
        setStatus({ kind: 'error', text: errorMessage(error) });
        return 'failed';
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const undo = useCallback(async () => {
    const target = undoTarget(session);
    if (target === undefined) {
      setStatus({ kind: 'error', text: 'Nothing to undo in this session.' });
      return;
    }
    const applied = await write(
      target.shotId,
      target.before,
      `undo ${target.command}`,
      `Undid "${target.command}" on ${target.shotId}`,
    );
    if (applied === 'ok') setSession((current) => markUndone(current, target.id, true));
  }, [session, write]);

  const redo = useCallback(async () => {
    const target = redoTarget(session);
    if (target === undefined) {
      setStatus({ kind: 'error', text: 'Nothing to redo.' });
      return;
    }
    const applied = await write(target.shotId, target.after, target.command, target.confirmation);
    if (applied === 'ok') setSession((current) => markUndone(current, target.id, false));
  }, [session, write]);

  const record = useCallback(
    async (shotId: string, next: ShotDirection | undefined, command: string, text: string) => {
      const before = directions?.shots[shotId];
      const applied = await write(shotId, next, command, text);
      if (applied === 'ok') {
        setSession((current) =>
          pushEntry(current, { command, shotId, confirmation: text, before, after: next }),
        );
      }
    },
    [directions, write],
  );

  const submit = useCallback(
    async (command: string) => {
      const { getTime, words, point, locked } = latest.current;
      const playhead = getTime();
      const shot = shots.findLast((candidate) => candidate.t0 <= playhead) ?? shots[0];
      if (shot === undefined) {
        setStatus({ kind: 'error', text: 'No shots yet: run Storyboard first.' });
        return;
      }
      lastCommand.current = command;
      const parsed = parseDirectionCommand(command, {
        shot,
        current: directions?.shots[shot.id],
        words,
        playhead,
        point: point ?? undefined,
      });
      if (parsed.kind === 'undo') return undo();
      if (parsed.kind === 'redo') return redo();
      if (parsed.kind === 'error') {
        setStatus({ kind: 'error', text: parsed.message });
        return;
      }
      if (locked.has(shot.id)) {
        setStatus(lockedStatus(shot.id));
        return;
      }
      if (parsed.kind === 'needs-claude') {
        setStatus(claudeOffer(parsed.shotId, parsed.request));
        return;
      }
      await record(parsed.shotId, parsed.next, command, parsed.confirmation);
    },
    [directions, record, redo, shots, undo],
  );

  const clear = useCallback(
    (shotId: string) => record(shotId, undefined, 'clear directions', `Cleared ${shotId}`),
    [record],
  );

  const acceptClaude = useCallback(async () => {
    if (status.kind !== 'claude') return;
    const problem = await latest.current.rebuildWithClaude(status.shotId, status.request);
    setStatus(
      problem === undefined
        ? {
            kind: 'sent',
            text: `Claude is building 2 variants of ${status.shotId} (see Variants).`,
          }
        : { kind: 'error', text: problem },
    );
  }, [status]);

  const unlockAndRetry = useCallback(async () => {
    if (status.kind !== 'locked') return;
    const unlocked = await latest.current.unlock(status.shotId);
    if (!unlocked) return;
    // The lock set updates on the next render; the user re-sends the command (still typed).
    const command = lastCommand.current;
    setStatus({
      kind: 'sent',
      text:
        command === undefined
          ? `${status.shotId} unlocked.`
          : `${status.shotId} unlocked: press Enter to run "${command}" again.`,
    });
  }, [status]);

  const directed = useMemo(() => new Set(directedShotIds(directions, shots)), [directions, shots]);

  return {
    directions,
    directed,
    session,
    status,
    busy,
    submit,
    undo,
    redo,
    clear,
    acceptClaude,
    unlockAndRetry,
    dismiss: () => {
      setStatus({ kind: 'idle' });
    },
  };
}
