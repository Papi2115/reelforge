/**
 * React glue of the player (PLAN.md#6.4): one Player per preview owner (start screen or project
 * workspace), its `<audio>` master clock element, its state as a store, and the global keyboard
 * shortcuts. App code: `performance.now`, rAF and timers are fine here (never in scenes).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { errorMessage, rendererLog } from '../log.js';
import { Player, type PlayerEnvironment, type PlayerState } from './player.js';
import { keyTargetOf, transportAction } from './transport-keys.js';

const log = rendererLog('player');

const browserEnvironment: PlayerEnvironment = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => {
    cancelAnimationFrame(handle);
  },
  setTimer: (callback, ms) => window.setTimeout(callback, ms),
  clearTimer: (handle) => {
    window.clearTimeout(handle);
  },
};

/** A player whose master clock is `audioUrl` (system clock when undefined). */
export function usePlayer(audioUrl: string | undefined): Player {
  const [player] = useState(
    () =>
      new Player(browserEnvironment, (error) => {
        log.warn(`audio playback failed, using the system clock: ${errorMessage(error)}`);
      }),
  );

  useEffect(
    () => () => {
      player.stop();
    },
    [player],
  );

  useEffect(() => {
    if (audioUrl === undefined) return;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = audioUrl;
    // Hidden, in the DOM only so the app tests can inspect the master clock element.
    audio.hidden = true;
    audio.dataset['testid'] = 'player-audio';
    document.body.appendChild(audio);
    player.attachMedia(audio);
    log.info(`master clock: ${audioUrl}`);
    return () => {
      player.attachMedia(undefined);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.remove();
    };
  }, [player, audioUrl]);

  return player;
}

export function usePlayerState(player: Player): PlayerState {
  return useSyncExternalStore(player.subscribe, player.getState);
}

/** Space / arrows / Home / End / J K L / M anywhere outside text fields. */
export function useTransportKeys(player: Player): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = transportAction({
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
        target: keyTargetOf(event.target),
      });
      if (!action) return;
      // Also keeps Space from "clicking" a focused button and arrows from scrolling.
      event.preventDefault();
      player.perform(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [player]);
}
