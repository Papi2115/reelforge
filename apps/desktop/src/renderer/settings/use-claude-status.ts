/**
 * Claude Code connection for the status bar and the wizard: checked on start and re-checked when
 * the window regains focus (e.g. after logging in in the terminal). Main caches results briefly,
 * so a focus re-check of a connected CLI costs nothing; otherwise it forces a fresh check.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClaudeLoginResult, ClaudeStatus } from '../../shared/settings-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('claude');

export interface ClaudeStatusController {
  readonly status: ClaudeStatus | undefined;
  readonly checking: boolean;
  /** Result of the last "Open terminal and log in". */
  readonly login: ClaudeLoginResult | undefined;
  readonly recheck: () => void;
  readonly openLogin: () => void;
}

export function useClaudeStatus(): ClaudeStatusController {
  const [status, setStatus] = useState<ClaudeStatus | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [login, setLogin] = useState<ClaudeLoginResult | undefined>(undefined);
  const statusRef = useRef<ClaudeStatus | undefined>(undefined);

  const check = useCallback((refresh: boolean): void => {
    setChecking(true);
    window.reelforge
      .getClaudeStatus(refresh)
      .then(
        (next) => {
          statusRef.current = next;
          setStatus(next);
        },
        (reason: unknown) => {
          log.error(`getClaudeStatus failed: ${errorMessage(reason)}`);
        },
      )
      .finally(() => {
        setChecking(false);
      });
  }, []);

  useEffect(() => {
    check(false);
    const onFocus = (): void => {
      check(statusRef.current?.state !== 'connected');
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [check]);

  const openLogin = useCallback((): void => {
    window.reelforge.openClaudeLogin().then(setLogin, (reason: unknown) => {
      log.error(`openClaudeLogin failed: ${errorMessage(reason)}`);
      setLogin({ status: 'error', message: errorMessage(reason) });
    });
  }, []);

  const recheck = useCallback((): void => {
    setLogin(undefined);
    check(true);
  }, [check]);

  return { status, checking, login, recheck, openLogin };
}
