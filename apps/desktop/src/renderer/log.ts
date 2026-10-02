/** Renderer logger: entries go to the main process log file (no console output in app code). */
import type { LogLevel } from '../shared/ipc-contract.js';

export interface RendererLog {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function rendererLog(scope: string): RendererLog {
  const write = (level: LogLevel, message: string): void => {
    window.reelforge.log({ level, scope, message: message.slice(0, 8_000) });
  };
  return {
    info: (message) => {
      write('info', message);
    },
    warn: (message) => {
      write('warn', message);
    },
    error: (message) => {
      write('error', message);
    },
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
