/**
 * Child-process env sanitizing (CLAUDE.md §3.1, ADR-001): nothing may silently switch billing from
 * the user's subscription to an API/provider account, and markers of a parent Claude Code session
 * must not leak into the child.
 */

/** Exact names that would bill an API/provider account or inject credentials. */
export const BILLING_ENV_EXACT: readonly string[] = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_GATEWAY',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD',
  'CLAUDE_CODE_OAUTH_TOKEN',
];

/** Every var with these prefixes is dropped (unless allowlisted below). */
export const STRIPPED_ENV_PREFIXES: readonly string[] = [
  'ANTHROPIC_',
  'CLAUDE_CODE_',
  'CLAUDE_AGENT_SDK_',
];

/** Markers set by a parent Claude Code session. */
export const STRIPPED_ENV_MARKERS: readonly string[] = [
  'CLAUDECODE',
  'CLAUDE_PID',
  'CLAUDE_EFFORT',
];

/** Safe, useful user settings that are forwarded despite their prefix. */
export const FORWARDED_ENV_ALLOWLIST: readonly string[] = [
  'CLAUDE_CODE_GIT_BASH_PATH',
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
];

/** True when `name` must never reach a child `claude` process. */
export function isStrippedEnvName(name: string): boolean {
  const upper = name.toUpperCase();
  if (BILLING_ENV_EXACT.includes(upper)) return true;
  if (FORWARDED_ENV_ALLOWLIST.includes(upper)) return false;
  return (
    STRIPPED_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix)) ||
    STRIPPED_ENV_MARKERS.includes(upper)
  );
}

/**
 * Returns a sanitized copy of `env` for a child `claude` process. Windows env names are
 * case-insensitive, so matching is done on upper-cased names. The input is not mutated.
 */
export function sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && !isStrippedEnvName(name)) clean[name] = value;
  }
  return clean;
}
