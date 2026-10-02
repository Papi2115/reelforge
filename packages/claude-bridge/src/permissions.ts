/**
 * Per-stage tool access for the runtime Claude (PLAN.md#5.7). Two layers:
 * 1. CLI flags (`--tools`, `--allowedTools`, `--disallowedTools`, `--permission-mode dontAsk`,
 *    `--add-dir`, `--setting-sources project`, `--strict-mcp-config`): the CLI enforces them;
 *    anything not allowlisted is auto-denied under `dontAsk` (no hang).
 * 2. `checkToolUse` / `auditToolUses`: the same policy re-checked on the bridge side against the
 *    tool calls that actually happened, so a CLI that ever lets something through is caught.
 * Rule syntax verified against Claude Code 2.1.287 (see README "Permissions").
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildTurnArgs, type PermissionMode } from './args.js';
import type { StreamEvent } from './events.js';
import { isInsideDir } from './path-guard.js';
import type { Stage } from './session-types.js';

/** Stages that may search/fetch the web (PLAN.md#5.7: the Script pipeline stage = research + script). */
export const WEB_STAGES: ReadonlySet<Stage> = new Set<Stage>(['research', 'script']);
/** Stages that only look (frame critic): no file edits at all. */
export const READ_ONLY_STAGES: ReadonlySet<Stage> = new Set<Stage>(['critic']);
/** Project-relative folders the runtime Claude must never edit (bridge state, git internals). */
export const PROTECTED_PROJECT_DIRS: readonly string[] = ['.reelforge', '.git'];
/** Commands the Bash tool may run (the `reelforge` CLI of PLAN.md#5.6). */
export const DEFAULT_BASH_COMMANDS: readonly string[] = ['reelforge'];

const READ_TOOLS = ['Read', 'Glob', 'Grep'] as const;
const EDIT_TOOLS = ['Edit', 'Write'] as const;
const WEB_TOOLS = ['WebSearch', 'WebFetch'] as const;
const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const READ_TOOL_NAMES = new Set<string>(READ_TOOLS);
const WEB_TOOL_NAMES = new Set<string>(WEB_TOOLS);
/** Shell syntax that could chain/redirect/substitute past the command allowlist. */
const SHELL_METACHARACTERS = /[;&|`<>\n\r]|\$\(/;
/** Claude Code's own config/credentials: never readable by the runtime Claude. */
const CREDENTIAL_DENY_RULES = ['Read(~/.claude/**)', 'Read(~/.claude.json)'];

export interface StagePermissionOptions {
  /** Kit docs folder: added with `--add-dir`, readable, never editable. */
  readonly kitDocsDir?: string | undefined;
  /** Allowed Bash command names; default `['reelforge']`. */
  readonly bashCommands?: readonly string[] | undefined;
  /**
   * Node-compatible executable that runs the PreToolUse bash guard (`hooks/bash-guard.mjs`).
   * Without it the bridge relies on the allowlist + `auditToolUses` only (the CLI auto-approves
   * read-only shell commands such as `echo`, see README "Permissions").
   */
  readonly hookRuntime?: string | undefined;
  /**
   * Absolute path of `bash-guard.mjs` (only used with `hookRuntime`). Default: the package's own
   * `hooks/bash-guard.mjs`, which exists only when the package runs unbundled. Bundled hosts
   * (Electron main) must ship the file (e.g. in app resources) and pass its path here.
   */
  readonly hookScriptPath?: string | undefined;
}

/** Prefix of every block message of the bash guard hook (how a hook block is recognized). */
export const BASH_GUARD_MARKER = 'ReelForge bash guard:';

/** `hooks/bash-guard.mjs` next to a module dir of this package (`src/` or `dist/`), if it exists. */
export function bashGuardHookPathFrom(moduleDir: string | undefined): string | undefined {
  if (moduleDir === undefined || moduleDir === '') return undefined;
  const candidate = path.join(moduleDir, '..', 'hooks', 'bash-guard.mjs');
  return existsSync(candidate) ? candidate : undefined;
}

/**
 * The package's own hook script. Resolved on call, never at module load: bundlers rewrite
 * `import.meta.dirname` (ESM: the bundle's folder; CJS: undefined), which yields undefined here.
 */
export function defaultBashGuardHookPath(): string | undefined {
  const moduleDir: string | undefined = import.meta.dirname;
  return bashGuardHookPathFrom(moduleDir);
}

/**
 * Hook script for `options`: undefined without a `hookRuntime`, else `hookScriptPath` or the
 * package default. Throws when a runtime is set but the script does not exist (a missing script
 * would make the hook fail open). The SessionManager calls this once in its constructor.
 */
export function resolveBashGuardHookPath(options: StagePermissionOptions): string | undefined {
  if (options.hookRuntime === undefined) return undefined;
  const script = options.hookScriptPath ?? defaultBashGuardHookPath();
  if (script === undefined || !existsSync(script)) {
    throw new Error(
      `bash guard hook script not found (${script ?? 'no package default when bundled'}); pass permissions.hookScriptPath`,
    );
  }
  return script;
}

/** What the bridge re-checks on its side (mirrors the CLI flags). */
export interface ToolPolicy {
  readonly projectDir: string;
  readonly readOnlyDirs: readonly string[];
  readonly writable: boolean;
  readonly protectedDirs: readonly string[];
  readonly bashCommands: readonly string[];
  readonly web: boolean;
}

export interface StagePermissions {
  readonly tools: readonly string[];
  readonly allowedTools: readonly string[];
  readonly disallowedTools: readonly string[];
  readonly permissionMode: PermissionMode;
  readonly addDirs: readonly string[];
  readonly settingSources: 'project';
  /** `--settings` JSON with the PreToolUse bash guard, when a hook runtime was given. */
  readonly settings: string | undefined;
  readonly policy: ToolPolicy;
}

/** Edit rules scoped to the cwd (= project): `./**` is gitignore-style, relative to cwd. */
function projectEditRules(): string[] {
  return EDIT_TOOLS.map((tool) => `${tool}(./**)`);
}

/** Forward slashes + double quotes: valid in the hook shell on Windows (Git Bash) and POSIX. */
function quoteForHookShell(value: string): string {
  return `"${value.replaceAll('\\', '/').replaceAll('"', '\\"')}"`;
}

/** `--settings` JSON registering the bash guard as a PreToolUse hook for the Bash tool. */
export function bashGuardSettings(
  hookRuntime: string,
  hookScriptPath: string,
  bashCommands: readonly string[],
): string {
  const command = [hookRuntime, hookScriptPath, ...bashCommands].map(quoteForHookShell).join(' ');
  return JSON.stringify({
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command }] }] },
  });
}

function hookSettings(
  options: StagePermissionOptions,
  bashCommands: readonly string[],
): string | undefined {
  if (options.hookRuntime === undefined) return undefined;
  const script = options.hookScriptPath ?? resolveBashGuardHookPath(options);
  return script === undefined
    ? undefined
    : bashGuardSettings(options.hookRuntime, script, bashCommands);
}

function protectedEditRules(dirs: readonly string[]): string[] {
  return dirs.flatMap((dir) => EDIT_TOOLS.map((tool) => `${tool}(./${dir}/**)`));
}

export function permissionsForStage(
  stage: Stage,
  projectDir: string,
  options: StagePermissionOptions = {},
): StagePermissions {
  const web = WEB_STAGES.has(stage);
  const writable = !READ_ONLY_STAGES.has(stage);
  const bashCommands = options.bashCommands ?? DEFAULT_BASH_COMMANDS;
  const tools = [...READ_TOOLS, ...(writable ? EDIT_TOOLS : []), 'Bash', ...(web ? WEB_TOOLS : [])];
  const allowedTools = [
    ...READ_TOOLS,
    ...(writable ? projectEditRules() : []),
    ...bashCommands.flatMap((command) => [`Bash(${command})`, `Bash(${command} *)`]),
    ...(web ? WEB_TOOLS : []),
  ];
  const disallowedTools = [
    ...(writable ? protectedEditRules(PROTECTED_PROJECT_DIRS) : EDIT_TOOLS),
    'NotebookEdit',
    ...(web ? [] : WEB_TOOLS),
    ...CREDENTIAL_DENY_RULES,
  ];
  const kitDocsDir =
    options.kitDocsDir === undefined ? undefined : path.resolve(options.kitDocsDir);
  return {
    tools,
    allowedTools,
    disallowedTools,
    permissionMode: 'dontAsk',
    addDirs: kitDocsDir === undefined ? [] : [kitDocsDir],
    settingSources: 'project',
    settings: hookSettings(options, bashCommands),
    policy: {
      projectDir: path.resolve(projectDir),
      readOnlyDirs: kitDocsDir === undefined ? [] : [kitDocsDir],
      writable,
      protectedDirs: PROTECTED_PROJECT_DIRS,
      bashCommands,
      web,
    },
  };
}

/** The permission-related argv of a stage (as passed by the SessionManager). */
export function permissionArgs(permissions: StagePermissions): string[] {
  const all = buildTurnArgs({
    model: 'sonnet',
    tools: permissions.tools,
    allowedTools: permissions.allowedTools,
    disallowedTools: permissions.disallowedTools,
    permissionMode: permissions.permissionMode,
    addDirs: permissions.addDirs,
    settingSources: permissions.settingSources,
    settings: permissions.settings,
  });
  return all.slice(all.indexOf('--model') + 2);
}

export type ToolDecision =
  { readonly allow: true } | { readonly allow: false; readonly reason: string };

const ALLOW: ToolDecision = { allow: true };
const deny = (reason: string): ToolDecision => ({ allow: false, reason });

function stringField(input: unknown, key: string): string | undefined {
  if (typeof input !== 'object' || input === null || !(key in input)) return undefined;
  const value: unknown = (input as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/** Static (non-glob) prefix of an absolute glob pattern, e.g. `C:/x/**` -> `C:/x`. */
function globBase(pattern: string): string | undefined {
  if (!path.isAbsolute(pattern)) return undefined;
  const parts = pattern.split(/[\\/]/);
  const stop = parts.findIndex((part) => /[*?[\]{}]/.test(part));
  return stop === -1 ? pattern : parts.slice(0, stop).join(path.sep) || path.sep;
}

function checkRead(policy: ToolPolicy, input: unknown): ToolDecision {
  const targets = [
    stringField(input, 'file_path'),
    stringField(input, 'path'),
    globBase(stringField(input, 'pattern') ?? ''),
  ].filter((value): value is string => value !== undefined && value !== '');
  for (const target of targets) {
    const resolved = path.resolve(policy.projectDir, target);
    const readable = [policy.projectDir, ...policy.readOnlyDirs].some((dir) =>
      isInsideDir(dir, resolved),
    );
    if (!readable) return deny(`read outside the project: ${resolved}`);
  }
  return ALLOW;
}

function checkEdit(policy: ToolPolicy, input: unknown): ToolDecision {
  if (!policy.writable) return deny('this stage may not edit files');
  const target = stringField(input, 'file_path') ?? stringField(input, 'notebook_path');
  if (target === undefined) return deny('edit without a file path');
  const resolved = path.resolve(policy.projectDir, target);
  if (!isInsideDir(policy.projectDir, resolved)) {
    return deny(`edit outside the project: ${resolved}`);
  }
  if (policy.readOnlyDirs.some((dir) => isInsideDir(dir, resolved))) {
    return deny(`edit in a read-only folder: ${resolved}`);
  }
  const blocked = policy.protectedDirs.find((dir) =>
    isInsideDir(path.join(policy.projectDir, dir), resolved),
  );
  return blocked === undefined ? ALLOW : deny(`edit in protected folder ${blocked}: ${resolved}`);
}

function checkBash(policy: ToolPolicy, input: unknown): ToolDecision {
  const command = (stringField(input, 'command') ?? '').trim();
  if (SHELL_METACHARACTERS.test(command)) return deny(`shell operators in command: ${command}`);
  const name = command.split(/\s+/)[0] ?? '';
  return policy.bashCommands.includes(name) ? ALLOW : deny(`command not allowed: ${command}`);
}

/** PreToolUse-style decision for one tool call under `policy`. */
export function checkToolUse(policy: ToolPolicy, name: string, input: unknown): ToolDecision {
  if (READ_TOOL_NAMES.has(name)) return checkRead(policy, input);
  if (EDIT_TOOL_NAMES.has(name)) return checkEdit(policy, input);
  if (name === 'Bash') return checkBash(policy, input);
  if (WEB_TOOL_NAMES.has(name))
    return policy.web ? ALLOW : deny(`${name} only in the research/script stages`);
  return deny(`tool ${name} is not allowed`);
}

export interface ToolViolation {
  readonly toolUseId: string;
  readonly name: string;
  readonly reason: string;
  /** The CLI (mode/deny rule) or the bash guard hook refused the call: nothing happened. */
  readonly blockedByCli: boolean;
}

/** Tool calls of a turn that break `policy`; `blockedByCli: false` ones actually ran. */
export function auditToolUses(policy: ToolPolicy, events: readonly StreamEvent[]): ToolViolation[] {
  // Mode denials arrive as `permission_denied`; deny-rule hits only in `result.permission_denials`.
  const denied = new Set(
    events.flatMap((event) => {
      if (event.kind === 'permission-denied') return [event.toolUseId];
      if (event.kind === 'result') return event.permissionDenials.map((denial) => denial.toolUseId);
      const hookBlocked =
        event.kind === 'tool-result' && event.isError && event.text.includes(BASH_GUARD_MARKER);
      return hookBlocked ? [event.toolUseId] : [];
    }),
  );
  return events.flatMap((event): ToolViolation[] => {
    if (event.kind !== 'tool-use') return [];
    const decision = checkToolUse(policy, event.name, event.input);
    if (decision.allow) return [];
    return [
      {
        toolUseId: event.toolUseId,
        name: event.name,
        reason: decision.reason,
        blockedByCli: denied.has(event.toolUseId),
      },
    ];
  });
}
